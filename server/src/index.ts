import express from 'express';
import http from 'http';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import { Server as SocketIOServer } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';

import { env } from './config/env';
import { testConnection } from './config/database';
import redis, { connectRedis } from './config/redis';
import logger, { systemLogger } from './config/logger';

import { errorHandler } from './middleware/errorHandler';
import { metricsMiddleware, metrics } from './services/monitoring';
import monitoringRoutes from './services/monitoring';

import authRoutes from './routes/auth';
import userRoutes from './routes/users';
import matchRoutes from './routes/matches';
import leaderboardRoutes from './routes/leaderboard';
import chatRoutes from './routes/chat';
import { setupSocketHandlers } from './socket';

import type { ServerToClientEvents, ClientToServerEvents } from '../../shared/types';

async function main() {
  // ---- Express App ----
  const app = express();
  const server = http.createServer(app);

  // ---- Middleware ----
  app.use(helmet({ contentSecurityPolicy: false }));
  app.use(compression());
  app.use(cors({
    origin: env.CORS_ORIGIN.split(','),
    credentials: true,
  }));
  app.use(express.json({ limit: '1mb' }));

  // Request logging + metrics
  app.use(metricsMiddleware);
  app.use((req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
      const duration = Date.now() - start;
      const level = res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info';
      logger.log(level, `${req.method} ${req.path} ${res.statusCode} ${duration}ms`, {
        category: 'HTTP',
        method: req.method,
        path: req.path,
        statusCode: res.statusCode,
        duration,
        ip: req.ip,
      });
    });
    next();
  });

  // ---- REST API Routes ----
  app.get('/health', (_req, res) => {
    res.json({
      status: 'ok',
      uptime: metrics.getUptime(),
      timestamp: new Date().toISOString(),
    });
  });

  app.use('/api/auth', authRoutes);
  app.use('/api/users', userRoutes);
  app.use('/api/matches', matchRoutes);
  app.use('/api/leaderboard', leaderboardRoutes);
  app.use('/api/chat', chatRoutes);
  app.use('/api/monitoring', monitoringRoutes);

  // ---- Error Handler ----
  app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    metrics.recordError(err.message, err.stack, 'HTTP');
    logger.error(`Unhandled error: ${err.message}`, {
      category: 'HTTP',
      method: req.method,
      path: req.path,
      stack: err.stack,
    });
    errorHandler(err, req, res, next);
  });

  // ---- Socket.IO ----
  const io = new SocketIOServer<ClientToServerEvents, ServerToClientEvents>(server, {
    cors: {
      origin: env.CORS_ORIGIN.split(','),
      credentials: true,
    },
    pingTimeout: 60000,
    pingInterval: 25000,
    transports: ['websocket', 'polling'],
  });

  // ---- Connect Services ----
  try {
    await testConnection();
    systemLogger.dbConnected();
  } catch (err) {
    systemLogger.dbError((err as Error).message);
  }

  try {
    await connectRedis();
    systemLogger.redisConnected();

    // Redis adapter for horizontal scaling
    const pubClient = redis.duplicate();
    const subClient = redis.duplicate();
    io.adapter(createAdapter(pubClient, subClient));
    logger.info('Socket.IO Redis adapter connected', { category: 'SYSTEM' });
  } catch (err) {
    systemLogger.redisError((err as Error).message);
    logger.warn('Falling back to in-memory adapter', { category: 'SYSTEM' });
  }

  // ---- Setup Socket Handlers ----
  setupSocketHandlers(io);

  // Store io reference for matchmaking interval
  (global as any).__io = io;

  // ---- Start Server ----
  server.listen(env.PORT, () => {
    systemLogger.startup(env.PORT, env.NODE_ENV);
    console.log(`
    ⚡ Arena Pro Server
    🌍 Environment: ${env.NODE_ENV}
    🚀 Listening on port ${env.PORT}
    📡 WebSocket ready
    📊 Monitoring: http://localhost:${env.PORT}/api/monitoring/dashboard
    🔗 CORS origin: ${env.CORS_ORIGIN}
    `);
  });

  // ---- Graceful Shutdown ----
  const shutdown = async (signal: string) => {
    systemLogger.shutdown(signal);
    console.log(`\n🛑 Shutting down (${signal})...`);

    // Stop accepting new connections
    server.close();

    // Close Socket.IO
    io.close();

    // Flush logger
    logger.end();

    // Close Redis
    try { await redis.quit(); } catch {}

    process.exit(0);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  // ---- Global Error Handlers ----
  process.on('unhandledRejection', (reason: any) => {
    logger.error('Unhandled rejection', {
      category: 'SYSTEM',
      error: reason?.message || String(reason),
      stack: reason?.stack,
    });
    metrics.recordError(reason?.message || 'Unhandled rejection', reason?.stack, 'SYSTEM');
  });

  process.on('uncaughtException', (error) => {
    logger.error('Uncaught exception — shutting down', {
      category: 'SYSTEM',
      error: error.message,
      stack: error.stack,
    });
    metrics.recordError(error.message, error.stack, 'SYSTEM');
    shutdown('uncaughtException');
  });
}

main().catch((err) => {
  console.error('💥 Fatal error starting server:', err);
  process.exit(1);
});
