import { Server } from 'socket.io';
import { v4 as uuidv4 } from 'uuid';
import redis, { keys } from '../config/redis';
import { query } from '../config/database';
import { AuthenticatedSocket } from './index';
import { MATCHMAKING, GAME_CONFIG } from '../../../shared/constants';
import { TIME_CONTROLS } from '../../../shared/constants';
import type { GameType, TimePreset, ServerToClientEvents, ClientToServerEvents } from '../../../shared/types';

interface QueueEntry {
  userId: string;
  username: string;
  socketId: string;
  elo: number;
  joinedAt: number;
  eloRange: number;  // Current search range (expands over time)
}

// In-memory queue for fast matching (Redis-backed for persistence)
const queues: Map<string, QueueEntry[]> = new Map();

export function setupMatchmaking(
  io: Server<ClientToServerEvents, ServerToClientEvents>,
  socket: AuthenticatedSocket
) {
  // ---- JOIN QUEUE ----
  socket.on('join_queue', async (data) => {
    const { gameType, timeControl } = data;

    // Prevent double-queueing
    const existing = await redis.get(keys.queuePlayer(socket.userId));
    if (existing) {
      socket.emit('error', { code: 'ALREADY_IN_QUEUE', message: 'You are already in a queue' });
      return;
    }

    // Get player's ELO for this game type
    const ratingResult = await query(
      'SELECT elo_rating FROM player_ratings WHERE user_id = $1 AND game_type = $2',
      [socket.userId, gameType]
    );
    const elo = ratingResult.rows[0]?.elo_rating || 1200;

    const entry: QueueEntry = {
      userId: socket.userId,
      username: socket.username,
      socketId: socket.id,
      elo,
      joinedAt: Date.now(),
      eloRange: MATCHMAKING.INITIAL_ELO_RANGE,
    };

    const queueKey = `${gameType}:${timeControl}`;

    // Add to queue
    if (!queues.has(queueKey)) queues.set(queueKey, []);
    queues.get(queueKey)!.push(entry);

    // Track in Redis
    await redis.set(keys.queuePlayer(socket.userId), queueKey, 'EX', 300);

    console.log(`🔍 ${socket.username} joined ${gameType} ${timeControl} queue (ELO: ${elo})`);

    // Try to find a match immediately
    tryMatch(io, queueKey, gameType, timeControl as TimePreset);
  });

  // ---- LEAVE QUEUE ----
  socket.on('leave_queue', async () => {
    await removeFromQueue(socket.userId);
    socket.emit('queue_cancelled');
  });

  // ---- CREATE PRIVATE ROOM ----
  socket.on('create_private', async (data) => {
    const { gameType, timeControl } = data;
    const roomCode = generateRoomCode();
    const roomId = `game:${uuidv4()}`;

    const roomData = {
      id: roomId,
      gameType,
      timeControl,
      hostId: socket.userId,
      hostUsername: socket.username,
      hostSocketId: socket.id,
      status: 'waiting',
      code: roomCode,
      createdAt: Date.now(),
    };

    await redis.set(keys.privateRoom(roomCode), JSON.stringify(roomData), 'EX', GAME_CONFIG.PRIVATE_ROOM_TTL_SECONDS);

    socket.join(roomId);

    socket.emit('notification', {
      type: 'room_created',
      message: `Room created! Share code: ${roomCode}`,
      data: { roomCode, roomId },
    });

    console.log(`🏠 ${socket.username} created private room ${roomCode}`);
  });

  // ---- JOIN PRIVATE ROOM ----
  socket.on('join_private', async (data) => {
    const { roomCode } = data;

    const roomDataStr = await redis.get(keys.privateRoom(roomCode.toUpperCase()));
    if (!roomDataStr) {
      socket.emit('error', { code: 'ROOM_NOT_FOUND', message: 'Room not found or expired' });
      return;
    }

    const roomData = JSON.parse(roomDataStr);

    if (roomData.hostId === socket.userId) {
      socket.emit('error', { code: 'SELF_JOIN', message: 'Cannot join your own room' });
      return;
    }

    // Get both players' ELO
    const hostElo = await getPlayerElo(roomData.hostId, roomData.gameType);
    const guestElo = await getPlayerElo(socket.userId, roomData.gameType);

    socket.join(roomData.id);

    // Delete private room from Redis
    await redis.del(keys.privateRoom(roomCode.toUpperCase()));

    // Notify both players
    const tc = TIME_CONTROLS[roomData.timeControl as TimePreset];

    io.to(roomData.id).emit('match_found', {
      roomId: roomData.id,
      opponent: { id: '', username: '', email: '', avatarUrl: null, provider: 'credentials', isOnline: true, lastSeen: '', createdAt: '' },
      gameType: roomData.gameType,
      timeControl: tc,
    });

    console.log(`🤝 ${socket.username} joined private room ${roomCode}`);
  });
}

// ---- Matchmaking Logic ----
async function tryMatch(
  io: Server<ClientToServerEvents, ServerToClientEvents>,
  queueKey: string,
  gameType: string,
  timeControl: TimePreset
) {
  const queue = queues.get(queueKey);
  if (!queue || queue.length < 2) return;

  // Sort by ELO for efficient pairing
  queue.sort((a, b) => a.elo - b.elo);

  for (let i = 0; i < queue.length - 1; i++) {
    for (let j = i + 1; j < queue.length; j++) {
      const p1 = queue[i];
      const p2 = queue[j];
      const eloDiff = Math.abs(p1.elo - p2.elo);

      // Check if within search range (use wider range for player who waited longer)
      const maxRange = Math.max(p1.eloRange, p2.eloRange);
      if (eloDiff <= maxRange) {
        // Match found!
        queue.splice(j, 1);
        queue.splice(i, 1);

        await redis.del(keys.queuePlayer(p1.userId));
        await redis.del(keys.queuePlayer(p2.userId));

        const roomId = `game:${uuidv4()}`;
        const tc = TIME_CONTROLS[timeControl];

        // Notify both players
        const p1Socket = io.sockets.sockets.get(p1.socketId);
        const p2Socket = io.sockets.sockets.get(p2.socketId);

        if (p1Socket) p1Socket.join(roomId);
        if (p2Socket) p2Socket.join(roomId);

        io.to(roomId).emit('match_found', {
          roomId,
          opponent: { id: '', username: '', email: '', avatarUrl: null, provider: 'credentials', isOnline: true, lastSeen: '', createdAt: '' },
          gameType: gameType as GameType,
          timeControl: tc,
        });

        console.log(`✅ Match: ${p1.username} (${p1.elo}) vs ${p2.username} (${p2.elo}) in ${gameType}`);

        // Store room data in Redis for game room handler
        const roomState = {
          roomId,
          gameType,
          timeControl,
          player1: { userId: p1.userId, username: p1.username, socketId: p1.socketId, elo: p1.elo },
          player2: { userId: p2.userId, username: p2.username, socketId: p2.socketId, elo: p2.elo },
          status: 'playing',
          startedAt: Date.now(),
        };
        await redis.set(keys.gameRoom(roomId), JSON.stringify(roomState), 'EX', 7200);

        return;
      }
    }
  }

  // No match found — expand search ranges for waiting players
  for (const entry of queue) {
    const waitTime = Date.now() - entry.joinedAt;
    if (waitTime > MATCHMAKING.RANGE_EXPAND_INTERVAL_MS) {
      entry.eloRange = Math.min(
        MATCHMAKING.MAX_ELO_RANGE,
        entry.eloRange + MATCHMAKING.RANGE_EXPAND_AMOUNT
      );
    }
  }
}

// Periodically try to match players
setInterval(() => {
  for (const [queueKey, queue] of queues.entries()) {
    if (queue.length >= 2) {
      const [gameType, timeControl] = queueKey.split(':');
      tryMatch(
        (global as any).__io, // Will be set in index.ts
        queueKey,
        gameType,
        timeControl as TimePreset
      );
    }
  }
}, MATCHMAKING.QUEUE_POLL_INTERVAL_MS);

// ---- Helper Functions ----
async function removeFromQueue(userId: string) {
  const queueKey = await redis.get(keys.queuePlayer(userId));
  if (queueKey) {
    const queue = queues.get(queueKey);
    if (queue) {
      const idx = queue.findIndex(e => e.userId === userId);
      if (idx !== -1) queue.splice(idx, 1);
    }
    await redis.del(keys.queuePlayer(userId));
  }
}

async function getPlayerElo(userId: string, gameType: string): Promise<number> {
  const result = await query(
    'SELECT elo_rating FROM player_ratings WHERE user_id = $1 AND game_type = $2',
    [userId, gameType]
  );
  return result.rows[0]?.elo_rating || 1200;
}

function generateRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Removed ambiguous chars (0/O, 1/I)
  let code = '';
  for (let i = 0; i < GAME_CONFIG.PRIVATE_ROOM_CODE_LENGTH; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}
