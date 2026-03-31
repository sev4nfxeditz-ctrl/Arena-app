import { Server, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import redis, { keys } from '../config/redis';
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
      return next(new Error('Authentication required'));
    }

    try {
      const decoded = jwt.verify(token, env.JWT_SECRET) as AuthPayload;
      (socket as AuthenticatedSocket).userId = decoded.userId;
      (socket as AuthenticatedSocket).username = decoded.username;
      next();
    } catch {
      next(new Error('Invalid token'));
    }
  });

  // ---- Connection Handler ----
  io.on('connection', async (rawSocket) => {
    const socket = rawSocket as AuthenticatedSocket;
    console.log(`⚡ ${socket.username} connected (${socket.id})`);

    // Track online status
    await redis.sadd(keys.onlineUsers(), socket.userId);
    await redis.set(keys.userSocket(socket.userId), socket.id, 'EX', 3600);

    // Check for reconnection (rejoining a game room)
    const existingRoom = await redis.get(keys.reconnectToken(socket.userId));
    if (existingRoom) {
      socket.join(existingRoom);
      io.to(existingRoom).emit('opponent_reconnected');
      await redis.del(keys.reconnectToken(socket.userId));
      console.log(`🔄 ${socket.username} reconnected to room ${existingRoom}`);
    }

    // Join global chat
    socket.join('chat:global');

    // ---- Setup Event Handlers ----
    setupMatchmaking(io, socket);
    setupGameRoom(io, socket);
    setupChatHandler(io, socket);

    // ---- Disconnection ----
    socket.on('disconnect', async () => {
      console.log(`💤 ${socket.username} disconnected`);

      // Find active game rooms
      const rooms = Array.from(socket.rooms).filter(r => r.startsWith('game:'));
      for (const room of rooms) {
        const roomId = room.replace('game:', '');

        // Set reconnection token (30s TTL)
        await redis.set(keys.reconnectToken(socket.userId), room, 'EX', 30);

        // Notify opponent
        socket.to(room).emit('opponent_disconnected', { timeout: 30000 });

        // Schedule auto-forfeit after 30s
        setTimeout(async () => {
          const reconnected = await redis.get(keys.reconnectToken(socket.userId));
          if (reconnected) {
            // Player didn't reconnect — auto-forfeit
            // This will be handled by the game room handler
            io.to(room).emit('game_over', {
              result: 'forfeit',
              winnerId: null, // Will be determined by game room
            });
          }
        }, 30000);
      }

      // Remove from online tracking
      await redis.srem(keys.onlineUsers(), socket.userId);
      await redis.del(keys.userSocket(socket.userId));
    });
  });

  // ---- Online Count Broadcast (every 10s) ----
  setInterval(async () => {
    try {
      const count = await redis.scard(keys.onlineUsers());
      io.emit('notification', {
        type: 'online_count',
        message: `${count} players online`,
        data: { count },
      });
    } catch {}
  }, 10000);
}
