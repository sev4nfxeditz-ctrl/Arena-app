// ============================================
// Monitoring & Metrics — Arena Pro
// In-memory metrics collection, health checks,
// dashboard API, and error alerting
// ============================================

import { Router, Request, Response } from 'express';
import redis, { keys } from '../config/redis';
import { query } from '../config/database';
import { asyncHandler } from '../middleware/errorHandler';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import logger from '../config/logger';

// ---- In-Memory Metrics Store ----
class MetricsCollector {
  private counters: Map<string, number> = new Map();
  private gauges: Map<string, number> = new Map();
  private histograms: Map<string, number[]> = new Map();
  private errors: { timestamp: number; message: string; stack?: string; category?: string }[] = [];
  private startTime = Date.now();

  // Counters (always increasing)
  increment(name: string, amount = 1): void {
    this.counters.set(name, (this.counters.get(name) || 0) + amount);
  }

  getCounter(name: string): number {
    return this.counters.get(name) || 0;
  }

  // Gauges (current value)
  setGauge(name: string, value: number): void {
    this.gauges.set(name, value);
  }

  getGauge(name: string): number {
    return this.gauges.get(name) || 0;
  }

  // Histograms (distribution of values)
  recordHistogram(name: string, value: number): void {
    if (!this.histograms.has(name)) this.histograms.set(name, []);
    const arr = this.histograms.get(name)!;
    arr.push(value);
    // Keep last 1000 values
    if (arr.length > 1000) arr.splice(0, arr.length - 1000);
  }

  getHistogramStats(name: string): { avg: number; p50: number; p95: number; p99: number; count: number } {
    const arr = this.histograms.get(name) || [];
    if (arr.length === 0) return { avg: 0, p50: 0, p95: 0, p99: 0, count: 0 };

    const sorted = [...arr].sort((a, b) => a - b);
    const avg = sorted.reduce((s, v) => s + v, 0) / sorted.length;

    return {
      avg: Math.round(avg * 100) / 100,
      p50: sorted[Math.floor(sorted.length * 0.5)] || 0,
      p95: sorted[Math.floor(sorted.length * 0.95)] || 0,
      p99: sorted[Math.floor(sorted.length * 0.99)] || 0,
      count: sorted.length,
    };
  }

  // Error tracking
  recordError(message: string, stack?: string, category?: string): void {
    this.errors.push({ timestamp: Date.now(), message, stack, category });
    // Keep last 100 errors
    if (this.errors.length > 100) this.errors.splice(0, this.errors.length - 100);
    this.increment('errors.total');
  }

  getRecentErrors(limit = 20): typeof this.errors {
    return this.errors.slice(-limit);
  }

  // Uptime
  getUptime(): number {
    return Math.round((Date.now() - this.startTime) / 1000);
  }

  // Full snapshot for dashboard
  getSnapshot(): any {
    const snapshot: any = {
      uptime: this.getUptime(),
      counters: Object.fromEntries(this.counters),
      gauges: Object.fromEntries(this.gauges),
      histograms: {},
      recentErrors: this.getRecentErrors(10),
    };

    for (const [name] of this.histograms) {
      snapshot.histograms[name] = this.getHistogramStats(name);
    }

    return snapshot;
  }

  // Reset (for testing)
  reset(): void {
    this.counters.clear();
    this.gauges.clear();
    this.histograms.clear();
    this.errors = [];
  }
}

export const metrics = new MetricsCollector();

// ---- Express Request Metrics Middleware ----
import { NextFunction } from 'express';

export function metricsMiddleware(req: Request, res: Response, next: NextFunction) {
  const start = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - start;
    const route = `${req.method} ${req.route?.path || req.path}`;

    metrics.increment('http.requests.total');
    metrics.increment(`http.status.${res.statusCode}`);
    metrics.recordHistogram('http.response_time_ms', duration);

    if (res.statusCode >= 400) {
      metrics.increment('http.errors');
    }
    if (res.statusCode >= 500) {
      metrics.increment('http.server_errors');
    }
  });

  next();
}

// ---- Socket Metrics Helpers ----
export const socketMetrics = {
  connection: () => {
    metrics.increment('socket.connections.total');
    metrics.setGauge('socket.connections.active', metrics.getGauge('socket.connections.active') + 1);
  },

  disconnect: () => {
    metrics.setGauge('socket.connections.active', Math.max(0, metrics.getGauge('socket.connections.active') - 1));
  },

  event: (eventName: string) => {
    metrics.increment('socket.events.total');
    metrics.increment(`socket.events.${eventName}`);
  },

  gameStart: (gameType: string) => {
    metrics.increment('games.started.total');
    metrics.increment(`games.started.${gameType}`);
    metrics.setGauge('games.active', metrics.getGauge('games.active') + 1);
  },

  gameEnd: (gameType: string, durationMs: number) => {
    metrics.increment('games.completed.total');
    metrics.increment(`games.completed.${gameType}`);
    metrics.setGauge('games.active', Math.max(0, metrics.getGauge('games.active') - 1));
    metrics.recordHistogram('games.duration_ms', durationMs);
  },

  matchmakingTime: (durationMs: number) => {
    metrics.recordHistogram('matchmaking.wait_time_ms', durationMs);
  },

  moveTime: (durationMs: number) => {
    metrics.recordHistogram('games.move_time_ms', durationMs);
  },

  error: (message: string, category?: string) => {
    metrics.recordError(message, undefined, category);
  },
};

// ---- Monitoring Dashboard API Routes ----
const router = Router();

// GET /api/monitoring/health — Extended health check
router.get('/health', asyncHandler(async (_req: Request, res: Response) => {
  const checks: Record<string, { status: string; latency?: number }> = {};

  // PostgreSQL check
  try {
    const dbStart = Date.now();
    await query('SELECT 1');
    checks.postgresql = { status: 'ok', latency: Date.now() - dbStart };
  } catch {
    checks.postgresql = { status: 'error' };
  }

  // Redis check
  try {
    const redisStart = Date.now();
    await redis.ping();
    checks.redis = { status: 'ok', latency: Date.now() - redisStart };
  } catch {
    checks.redis = { status: 'error' };
  }

  const allOk = Object.values(checks).every(c => c.status === 'ok');

  res.status(allOk ? 200 : 503).json({
    status: allOk ? 'healthy' : 'degraded',
    uptime: metrics.getUptime(),
    timestamp: new Date().toISOString(),
    checks,
  });
}));

// GET /api/monitoring/metrics — Full metrics snapshot
router.get('/metrics', asyncHandler(async (_req: Request, res: Response) => {
  const onlineCount = await redis.scard(keys.onlineUsers()).catch(() => 0);

  const snapshot = metrics.getSnapshot();
  snapshot.gauges['players.online'] = onlineCount;

  res.json({
    success: true,
    data: snapshot,
  });
}));

// GET /api/monitoring/dashboard — Formatted dashboard data
router.get('/dashboard', asyncHandler(async (_req: Request, res: Response) => {
  const onlineCount = await redis.scard(keys.onlineUsers()).catch(() => 0);

  const dashboard = {
    overview: {
      uptime: formatUptime(metrics.getUptime()),
      onlinePlayers: onlineCount,
      activeGames: metrics.getGauge('games.active'),
      totalGamesPlayed: metrics.getCounter('games.completed.total'),
      totalConnections: metrics.getCounter('socket.connections.total'),
    },
    performance: {
      httpResponseTime: metrics.getHistogramStats('http.response_time_ms'),
      gameMoveTIme: metrics.getHistogramStats('games.move_time_ms'),
      matchmakingWait: metrics.getHistogramStats('matchmaking.wait_time_ms'),
      gameDuration: metrics.getHistogramStats('games.duration_ms'),
    },
    traffic: {
      totalHttpRequests: metrics.getCounter('http.requests.total'),
      httpErrors: metrics.getCounter('http.errors'),
      serverErrors: metrics.getCounter('http.server_errors'),
      socketEvents: metrics.getCounter('socket.events.total'),
    },
    games: {
      chess: {
        started: metrics.getCounter('games.started.chess'),
        completed: metrics.getCounter('games.completed.chess'),
      },
      checkers: {
        started: metrics.getCounter('games.started.checkers'),
        completed: metrics.getCounter('games.completed.checkers'),
      },
      tictactoe: {
        started: metrics.getCounter('games.started.tictactoe'),
        completed: metrics.getCounter('games.completed.tictactoe'),
      },
    },
    errors: metrics.getRecentErrors(20),
    timestamp: new Date().toISOString(),
  };

  res.json({ success: true, data: dashboard });
}));

// GET /api/monitoring/errors — Recent errors
router.get('/errors', asyncHandler(async (_req: Request, res: Response) => {
  const limit = parseInt(_req.query.limit as string) || 50;
  res.json({
    success: true,
    data: metrics.getRecentErrors(limit),
  });
}));

function formatUptime(seconds: number): string {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  const parts = [];
  if (d > 0) parts.push(`${d}d`);
  if (h > 0) parts.push(`${h}h`);
  if (m > 0) parts.push(`${m}m`);
  parts.push(`${s}s`);
  return parts.join(' ');
}

export default router;
