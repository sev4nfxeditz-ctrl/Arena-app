import { Server, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import redis, { keys } from '../config/redis';
import { socketLogger } from '../config/logger';
import { socketMetrics, metrics } from '../services/monitoring';
import { withFallback } from '../services/resilience';
import { AuthPayload } from '../middleware/auth';
import { setupMatchmaking } from './matchmaking';
import { setupGameRoom } from './gameRoom';
import { setupChatHandler } from './chatHandler';

import type { ServerToClientEvents, ClientToServerEvents } from '../../../shared/types';

export interface AuthenticatedSocket extends Socket<ClientToServerEvents, ServerToClientEvents> {
  userId: string;
  username: string;
}

export function setupSocketHandlers(io: Server<ClientToServerEvents, ServerToClientEvents>) {
  // ---- Authentication Middleware ----
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token || socket.handshake.headers?.authorization?.split(' ')[1];

    if (!token) {
      socketLogger.authFail(socket.id, 'No token provided');
      return next(new Error('Authentication required'));
    }

    try {
      const decoded = jwt.verify(token, env.JWT_SECRET) as AuthPayload;
      (socket as AuthenticatedSocket).userId = decoded.userId;
      (socket as AuthenticatedSocket).username = decoded.username;
      next();
    } catch (err) {
      socketLogger.authFail(socket.id, (err as Error).message);
      next(new Error('Invalid token'));
    }
  });

  // ---- Connection Handler ----
  io.on('connection', async (rawSocket) => {
    const socket = rawSocket as AuthenticatedSocket;
    socketLogger.connection(socket.userId, socket.username, socket.id);
    socketMetrics.connection();

    // Track online status (with fallback if Redis is down)
    await withFallback(
      () => Promise.all([
        redis.sadd(keys.onlineUsers(), socket.userId),
        redis.set(keys.userSocket(socket.userId), socket.id, 'EX', 3600),
      ]),
      [0, null],
      'track-online-status'
    );

    // Check for reconnection (rejoining a game room)
    const existingRoom = await withFallback(
      () => redis.get(keys.reconnectToken(socket.userId)),
      null,
      'check-reconnection'
    );

    if (existingRoom) {
      socket.join(existingRoom);
      io.to(existingRoom).emit('opponent_reconnected');
      await redis.del(keys.reconnectToken(socket.userId)).catch(() => {});
      socketLogger.event(socket.userId, 'reconnected', { room: existingRoom });
    }

    // Join global chat
    socket.join('chat:global');

    // ---- Socket Event Logging Wrapper ----
    const originalOn = socket.on.bind(socket);
    socket.on = ((event: string, handler: (...args: any[]) => void) => {
      return originalOn(event, (...args: any[]) => {
        socketLogger.event(socket.userId, event);
        socketMetrics.event(event);
        try {
          handler(...args);
        } catch (err) {
          socketLogger.error(socket.userId, event, (err as Error).message);
          socketMetrics.error((err as Error).message, `socket.${event}`);
        }
      });
    }) as any;

    // ---- Setup Event Handlers ----
    setupMatchmaking(io, socket);
    setupGameRoom(io, socket);
    setupChatHandler(io, socket);

    // ---- Disconnection ----
    socket.on('disconnect', async (reason: string) => {
      socketLogger.disconnect(socket.userId, socket.username, reason);
      socketMetrics.disconnect();

      // Find active game rooms
      const rooms = Array.from(socket.rooms).filter(r => r.startsWith('game:'));
      for (const room of rooms) {
        // Set reconnection token (30s TTL)
        await withFallback(
          () => redis.set(keys.reconnectToken(socket.userId), room, 'EX', 30),
          null,
          'set-reconnect-token'
        );

        // Notify opponent
        socket.to(room).emit('opponent_disconnected', { timeout: 30000 });

        // Schedule auto-forfeit after 30s
        setTimeout(async () => {
          const reconnected = await redis.get(keys.reconnectToken(socket.userId)).catch(() => null);
          if (reconnected) {
            io.to(room).emit('game_over', {
              result: 'forfeit',
              winnerId: null,
            });
          }
        }, 30000);
      }

      // Remove from online tracking
      await withFallback(
        () => Promise.all([
          redis.srem(keys.onlineUsers(), socket.userId),
          redis.del(keys.userSocket(socket.userId)),
        ]),
        [0, 0],
        'remove-online-status'
      );
    });
  });

  // ---- Online Count Broadcast (every 10s) ----
  setInterval(async () => {
    try {
      const count = await redis.scard(keys.onlineUsers());
      metrics.setGauge('players.online', count);
      io.emit('notification', {
        type: 'online_count',
        message: `${count} players online`,
        data: { count },
      });
    } catch {}
  }, 10000);
}
