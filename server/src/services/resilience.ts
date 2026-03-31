// ============================================
// Retry & Resilience Utilities — Arena Pro
// Retry logic, circuit breaker, graceful degradation
// ============================================

import logger from '../config/logger';

// ---- Retry with Exponential Backoff ----
export interface RetryConfig {
  maxRetries: number;
  baseDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
  retryOn?: (error: any) => boolean; // Custom predicate — only retry when this returns true
}

const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  baseDelayMs: 200,
  maxDelayMs: 5000,
  backoffMultiplier: 2,
};

export async function withRetry<T>(
  operation: () => Promise<T>,
  label: string,
  config: Partial<RetryConfig> = {}
): Promise<T> {
  const cfg = { ...DEFAULT_RETRY_CONFIG, ...config };
  let lastError: any;

  for (let attempt = 0; attempt <= cfg.maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;

      // Check if we should retry this type of error
      if (cfg.retryOn && !cfg.retryOn(error)) {
        throw error; // Don't retry — error type not retriable
      }

      if (attempt < cfg.maxRetries) {
        const delay = Math.min(
          cfg.baseDelayMs * Math.pow(cfg.backoffMultiplier, attempt),
          cfg.maxDelayMs
        );
        // Add jitter (±25%) to prevent thundering herd
        const jitter = delay * 0.25 * (Math.random() * 2 - 1);
        const finalDelay = Math.max(0, delay + jitter);

        logger.warn(`Retry ${attempt + 1}/${cfg.maxRetries} for "${label}" in ${Math.round(finalDelay)}ms`, {
          category: 'RETRY',
          label,
          attempt: attempt + 1,
          delay: Math.round(finalDelay),
          error: (error as Error).message,
        });

        await sleep(finalDelay);
      }
    }
  }

  logger.error(`All ${cfg.maxRetries} retries exhausted for "${label}"`, {
    category: 'RETRY',
    label,
    error: lastError?.message,
  });

  throw lastError;
}

// ---- Circuit Breaker ----
enum CircuitState {
  CLOSED = 'CLOSED',     // Normal — requests pass through
  OPEN = 'OPEN',         // Failing — requests blocked
  HALF_OPEN = 'HALF_OPEN' // Testing — one request allowed through
}

interface CircuitBreakerConfig {
  failureThreshold: number;   // Number of failures to trip the circuit
  resetTimeoutMs: number;     // Time in OPEN state before trying HALF_OPEN
  successThreshold: number;   // Successes needed in HALF_OPEN to close
}

export class CircuitBreaker {
  private state: CircuitState = CircuitState.CLOSED;
  private failureCount = 0;
  private successCount = 0;
  private lastFailureTime = 0;
  private readonly config: CircuitBreakerConfig;
  private readonly name: string;

  constructor(name: string, config: Partial<CircuitBreakerConfig> = {}) {
    this.name = name;
    this.config = {
      failureThreshold: config.failureThreshold ?? 5,
      resetTimeoutMs: config.resetTimeoutMs ?? 30000,
      successThreshold: config.successThreshold ?? 2,
    };
  }

  async execute<T>(operation: () => Promise<T>, fallback?: () => T): Promise<T> {
    // Check if circuit should transition from OPEN → HALF_OPEN
    if (this.state === CircuitState.OPEN) {
      if (Date.now() - this.lastFailureTime >= this.config.resetTimeoutMs) {
        this.state = CircuitState.HALF_OPEN;
        this.successCount = 0;
        logger.info(`Circuit "${this.name}" → HALF_OPEN`, { category: 'CIRCUIT_BREAKER', name: this.name });
      } else {
        // Circuit is OPEN — use fallback or throw
        logger.debug(`Circuit "${this.name}" is OPEN — blocking request`, { category: 'CIRCUIT_BREAKER', name: this.name });
        if (fallback) return fallback();
        throw new Error(`Circuit breaker "${this.name}" is OPEN`);
      }
    }

    try {
      const result = await operation();

      // Success handling
      if (this.state === CircuitState.HALF_OPEN) {
        this.successCount++;
        if (this.successCount >= this.config.successThreshold) {
          this.state = CircuitState.CLOSED;
          this.failureCount = 0;
          logger.info(`Circuit "${this.name}" → CLOSED (recovered)`, { category: 'CIRCUIT_BREAKER', name: this.name });
        }
      } else {
        this.failureCount = Math.max(0, this.failureCount - 1); // Decay on success
      }

      return result;
    } catch (error) {
      this.failureCount++;
      this.lastFailureTime = Date.now();

      if (this.state === CircuitState.HALF_OPEN) {
        // Failed during testing — re-open
        this.state = CircuitState.OPEN;
        logger.warn(`Circuit "${this.name}" → OPEN (half-open test failed)`, { category: 'CIRCUIT_BREAKER', name: this.name });
      } else if (this.failureCount >= this.config.failureThreshold) {
        this.state = CircuitState.OPEN;
        logger.error(`Circuit "${this.name}" → OPEN (${this.failureCount} failures)`, { category: 'CIRCUIT_BREAKER', name: this.name });
      }

      if (fallback) return fallback();
      throw error;
    }
  }

  getState(): { state: CircuitState; failures: number } {
    return { state: this.state, failures: this.failureCount };
  }
}

// ---- Graceful Degradation Wrapper ----
/**
 * Wraps an operation with fallback behavior.
 * If the primary operation fails, returns the fallback value.
 * Logs the failure but doesn't throw.
 */
export async function withFallback<T>(
  operation: () => Promise<T>,
  fallbackValue: T,
  label: string
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    logger.warn(`Degraded: "${label}" using fallback`, {
      category: 'FALLBACK',
      label,
      error: (error as Error).message,
    });
    return fallbackValue;
  }
}

// ---- Timeout Wrapper ----
export async function withTimeout<T>(
  operation: () => Promise<T>,
  timeoutMs: number,
  label: string
): Promise<T> {
  return Promise.race([
    operation(),
    new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(new Error(`Timeout: "${label}" exceeded ${timeoutMs}ms`));
      }, timeoutMs);
    }),
  ]);
}

// ---- Helper ----
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ---- Pre-built Circuit Breakers ----
export const dbCircuit = new CircuitBreaker('PostgreSQL', {
  failureThreshold: 5,
  resetTimeoutMs: 30000,
  successThreshold: 2,
});

export const redisCircuit = new CircuitBreaker('Redis', {
  failureThreshold: 10,
  resetTimeoutMs: 15000,
  successThreshold: 3,
});
