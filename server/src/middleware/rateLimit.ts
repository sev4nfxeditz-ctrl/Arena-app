import redis, { keys } from '../config/redis';

interface RateLimitConfig {
  maxRequests: number;
  windowSeconds: number;
}

export async function checkRateLimit(
  identifier: string,
  config: RateLimitConfig
): Promise<{ allowed: boolean; remaining: number; resetIn: number }> {
  const key = `arena:ratelimit:${identifier}`;

  const multi = redis.multi();
  multi.incr(key);
  multi.ttl(key);
  const results = await multi.exec();

  const count = (results?.[0]?.[1] as number) || 0;
  const ttl = (results?.[1]?.[1] as number) || -1;

  // Set expiry on first request in window
  if (ttl === -1) {
    await redis.expire(key, config.windowSeconds);
  }

  const allowed = count <= config.maxRequests;
  const remaining = Math.max(0, config.maxRequests - count);
  const resetIn = ttl > 0 ? ttl : config.windowSeconds;

  return { allowed, remaining, resetIn };
}

// Middleware factory for Express routes
import { Request, Response, NextFunction } from 'express';
import { AuthRequest } from './auth';

export function rateLimitMiddleware(maxRequests: number, windowSeconds: number) {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    const identifier = (req.user?.userId || req.ip || 'unknown') + ':' + req.path;
    const result = await checkRateLimit(identifier, { maxRequests, windowSeconds });

    res.set('X-RateLimit-Limit', maxRequests.toString());
    res.set('X-RateLimit-Remaining', result.remaining.toString());
    res.set('X-RateLimit-Reset', result.resetIn.toString());

    if (!result.allowed) {
      return res.status(429).json({
        success: false,
        error: 'Too many requests. Please slow down.',
        retryAfter: result.resetIn,
      });
    }

    next();
  };
}
