// ============================================
// Structured Logger — Arena Pro
// Uses Winston for production-grade logging
// with request, socket, error, and game event tracking
// ============================================

import { createLogger, format, transports, Logger } from 'winston';
import { env } from './env';

const { combine, timestamp, printf, colorize, json, errors } = format;

// ---- Custom format for development ----
const devFormat = printf(({ level, message, timestamp, category, userId, ...meta }) => {
  const cat = category ? `[${category}]` : '';
  const user = userId ? `(${userId})` : '';
  const extra = Object.keys(meta).length > 0 ? ` ${JSON.stringify(meta)}` : '';
  return `${timestamp} ${level} ${cat}${user} ${message}${extra}`;
});

// ---- Create main logger ----
const logger: Logger = createLogger({
  level: env.NODE_ENV === 'production' ? 'info' : 'debug',
  defaultMeta: { service: 'arena-server' },
  format: combine(
    errors({ stack: true }),
    timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
  ),
  transports: [
    // Console output
    new transports.Console({
      format: env.NODE_ENV === 'production'
        ? combine(json())
        : combine(colorize(), devFormat),
    }),

    // Error log file
    new transports.File({
      filename: 'logs/error.log',
      level: 'error',
      format: combine(json()),
      maxsize: 10 * 1024 * 1024, // 10MB
      maxFiles: 5,
      tailable: true,
    }),

    // Combined log file
    new transports.File({
      filename: 'logs/combined.log',
      format: combine(json()),
      maxsize: 20 * 1024 * 1024, // 20MB
      maxFiles: 10,
      tailable: true,
    }),

    // Game events log (separate for analysis)
    new transports.File({
      filename: 'logs/game-events.log',
      level: 'info',
      format: combine(json()),
      maxsize: 20 * 1024 * 1024,
      maxFiles: 10,
      tailable: true,
    }),
  ],

  // Don't crash on unhandled rejections
  exitOnError: false,
});

// ---- Specialized loggers (child loggers with category metadata) ----

/** HTTP request logging */
export const httpLogger = {
  request: (method: string, path: string, statusCode: number, duration: number, ip?: string) => {
    logger.info('HTTP request', {
      category: 'HTTP',
      method,
      path,
      statusCode,
      duration,
      ip,
    });
  },

  error: (method: string, path: string, statusCode: number, error: string, ip?: string) => {
    logger.error('HTTP error', {
      category: 'HTTP',
      method,
      path,
      statusCode,
      error,
      ip,
    });
  },
};

/** Socket event logging */
export const socketLogger = {
  connection: (userId: string, username: string, socketId: string) => {
    logger.info(`Player connected: ${username}`, {
      category: 'SOCKET',
      event: 'connect',
      userId,
      username,
      socketId,
    });
  },

  disconnect: (userId: string, username: string, reason: string) => {
    logger.info(`Player disconnected: ${username} (${reason})`, {
      category: 'SOCKET',
      event: 'disconnect',
      userId,
      username,
      reason,
    });
  },

  event: (userId: string, eventName: string, data?: any) => {
    logger.debug(`Socket event: ${eventName}`, {
      category: 'SOCKET',
      event: eventName,
      userId,
      data: data ? JSON.stringify(data).substring(0, 200) : undefined,
    });
  },

  error: (userId: string, eventName: string, error: string) => {
    logger.error(`Socket error: ${eventName}`, {
      category: 'SOCKET',
      event: eventName,
      userId,
      error,
    });
  },

  authFail: (socketId: string, reason: string) => {
    logger.warn(`Socket auth failed: ${reason}`, {
      category: 'SOCKET',
      event: 'auth_fail',
      socketId,
      reason,
    });
  },
};

/** Game event logging */
export const gameLogger = {
  matchFound: (roomId: string, player1: string, player2: string, gameType: string) => {
    logger.info(`Match found: ${player1} vs ${player2}`, {
      category: 'GAME',
      event: 'match_found',
      roomId,
      player1,
      player2,
      gameType,
    });
  },

  gameStart: (roomId: string, gameType: string, mode: string) => {
    logger.info(`Game started: ${roomId}`, {
      category: 'GAME',
      event: 'game_start',
      roomId,
      gameType,
      mode,
    });
  },

  move: (roomId: string, userId: string, notation: string, moveNumber: number) => {
    logger.debug(`Move: ${notation} (#${moveNumber})`, {
      category: 'GAME',
      event: 'move',
      roomId,
      userId,
      notation,
      moveNumber,
    });
  },

  invalidMove: (roomId: string, userId: string, error: string) => {
    logger.warn(`Invalid move attempt`, {
      category: 'GAME',
      event: 'invalid_move',
      roomId,
      userId,
      error,
    });
  },

  gameOver: (roomId: string, result: string, reason: string, duration: number) => {
    logger.info(`Game over: ${reason}`, {
      category: 'GAME',
      event: 'game_over',
      roomId,
      result,
      reason,
      duration,
    });
  },

  eloUpdate: (userId: string, gameType: string, before: number, after: number) => {
    logger.info(`ELO update: ${before} → ${after} (${after - before >= 0 ? '+' : ''}${after - before})`, {
      category: 'GAME',
      event: 'elo_update',
      userId,
      gameType,
      before,
      after,
      change: after - before,
    });
  },
};

/** Matchmaking logging */
export const matchmakingLogger = {
  joinQueue: (userId: string, gameType: string, elo: number) => {
    logger.info(`Player joined queue`, {
      category: 'MATCHMAKING',
      event: 'join_queue',
      userId,
      gameType,
      elo,
    });
  },

  leaveQueue: (userId: string) => {
    logger.info(`Player left queue`, {
      category: 'MATCHMAKING',
      event: 'leave_queue',
      userId,
    });
  },

  queueSize: (queueKey: string, size: number) => {
    logger.debug(`Queue size: ${size}`, {
      category: 'MATCHMAKING',
      event: 'queue_size',
      queueKey,
      size,
    });
  },
};

/** Anti-cheat logging */
export const antiCheatLogger = {
  suspicion: (userId: string, type: string, details: any, severity: 'low' | 'medium' | 'high') => {
    const lvl = severity === 'high' ? 'error' : severity === 'medium' ? 'warn' : 'info';
    logger.log(lvl, `Anti-cheat alert: ${type}`, {
      category: 'ANTICHEAT',
      event: 'suspicion',
      userId,
      type,
      severity,
      details,
    });
  },

  flagged: (userId: string, roomId: string, reason: string) => {
    logger.error(`Player flagged: ${reason}`, {
      category: 'ANTICHEAT',
      event: 'flagged',
      userId,
      roomId,
      reason,
    });
  },
};

/** System / infrastructure logging */
export const systemLogger = {
  startup: (port: number, env: string) => {
    logger.info(`Server started on port ${port}`, {
      category: 'SYSTEM',
      event: 'startup',
      port,
      env,
    });
  },

  dbConnected: () => logger.info('PostgreSQL connected', { category: 'SYSTEM', event: 'db_connect' }),
  dbError: (err: string) => logger.error(`PostgreSQL error: ${err}`, { category: 'SYSTEM', event: 'db_error', error: err }),
  redisConnected: () => logger.info('Redis connected', { category: 'SYSTEM', event: 'redis_connect' }),
  redisError: (err: string) => logger.error(`Redis error: ${err}`, { category: 'SYSTEM', event: 'redis_error', error: err }),

  shutdown: (reason: string) => {
    logger.info(`Server shutting down: ${reason}`, {
      category: 'SYSTEM',
      event: 'shutdown',
      reason,
    });
  },
};

export default logger;
