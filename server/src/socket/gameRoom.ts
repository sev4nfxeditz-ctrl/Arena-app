import { Server } from 'socket.io';
import redis, { keys } from '../config/redis';
import { AuthenticatedSocket } from './index';
import { getEngine } from '../game/engine';
import { getTicTacToeAIMove } from '../ai/tictactoe-ai';
import { getCheckersAIMove } from '../ai/checkers-ai';
import { updatePlayerRatings } from '../services/elo';
import { saveMatch } from '../services/matchService';
import { antiCheat } from '../services/anticheat';
import { withRetry, withFallback } from '../services/resilience';
import { gameLogger } from '../config/logger';
import { socketMetrics, metrics } from '../services/monitoring';
import { TIME_CONTROLS } from '../../../shared/constants';
import type { GameType, TimePreset, ServerToClientEvents, ClientToServerEvents, PlayerTimers } from '../../../shared/types';

interface RoomState {
  roomId: string;
  gameType: GameType;
  timeControl: TimePreset;
  gameState: any;
  player1: { userId: string; username: string; socketId: string; elo: number };
  player2: { userId: string; username: string; socketId: string; elo: number };
  moveHistory: any[];
  startedAt: number;
  lastMoveTime: number;  // For anti-cheat timing
  timers: PlayerTimers;
  timerInterval?: NodeJS.Timeout;
  mode: 'ranked' | 'casual' | 'private' | 'ai';
  aiDifficulty?: number;
}

// Active game rooms in memory (backed by Redis)
const activeRooms: Map<string, RoomState> = new Map();

export function setupGameRoom(
  io: Server<ClientToServerEvents, ServerToClientEvents>,
  socket: AuthenticatedSocket
) {
  // ---- MAKE MOVE ----
  socket.on('make_move', async (data) => {
    const { roomId, move } = data;
    const room = activeRooms.get(roomId);

    if (!room) {
      const roomData = await redis.get(keys.gameRoom(roomId)).catch(() => null);
      if (!roomData) {
        socket.emit('error', { code: 'ROOM_NOT_FOUND', message: 'Game room not found' });
        return;
      }
      await initializeGame(io, roomId, JSON.parse(roomData));
      return;
    }

    const engine = getEngine(room.gameType);

    // Validate the move
    const result = engine.validateMove(room.gameState, move, socket.userId);
    if (!result.valid) {
      gameLogger.invalidMove(roomId, socket.userId, result.error || 'Invalid move');
      socket.emit('error', { code: 'INVALID_MOVE', message: result.error || 'Invalid move' });
      return;
    }

    // ---- Anti-Cheat: Analyze move timing ----
    const now = Date.now();
    const moveTimeMs = now - room.lastMoveTime;
    room.lastMoveTime = now;

    if (room.mode === 'ranked' && room.player2.userId !== 'AI_BOT') {
      const acResult = await withFallback(
        () => antiCheat.analyzeMove(
          socket.userId, roomId,
          room.moveHistory.length + 1,
          moveTimeMs,
          room.gameType
        ),
        { allowed: true, suspicionScore: 0, flags: [], action: 'none' as const },
        'anti-cheat-analyze'
      );

      if (!acResult.allowed) {
        socket.emit('error', { code: 'BLOCKED', message: 'Your account is under review for suspicious activity' });
        gameLogger.invalidMove(roomId, socket.userId, 'Anti-cheat blocked');
        return;
      }

      // Track metrics
      if (acResult.action !== 'none') {
        metrics.increment('anticheat.alerts');
      }
    }

    // Apply the move
    room.gameState = result.newState;
    room.moveHistory.push({
      ...move,
      notation: result.notation,
      timestamp: now,
      moveTimeMs,
    });

    // Log the move
    gameLogger.move(roomId, socket.userId, result.notation || JSON.stringify(move), room.moveHistory.length);
    socketMetrics.moveTime(moveTimeMs);

    // Handle timers
    if (room.timers && TIME_CONTROLS[room.timeControl].totalSeconds) {
      switchTimer(room);
    }

    // Broadcast update
    io.to(roomId).emit('game_update', {
      state: room.gameState,
      move: { ...move, notation: result.notation },
      timers: room.timers,
    });

    // Check game over
    const gameOver = engine.checkGameOver(room.gameState);
    if (gameOver.isOver) {
      await endGame(io, room, gameOver.winner, gameOver.reason || 'checkmate');
    }

    // Persist state to Redis (with retry)
    await withFallback(
      () => redis.set(keys.gameState(roomId), JSON.stringify(room.gameState), 'EX', 7200),
      null,
      'persist-game-state'
    );
  });

  // ---- RESIGN ----
  socket.on('resign', async (data) => {
    const room = activeRooms.get(data.roomId);
    if (!room) return;

    const winnerId = room.player1.userId === socket.userId ? room.player2.userId : room.player1.userId;
    gameLogger.gameOver(data.roomId, 'resign', `${socket.username} resigned`, 0);
    await endGame(io, room, winnerId, 'resign');
  });

  // ---- OFFER DRAW ----
  socket.on('offer_draw', (data) => {
    const room = activeRooms.get(data.roomId);
    if (!room) return;
    socket.to(data.roomId).emit('draw_offered', { fromUserId: socket.userId });
  });

  // ---- ACCEPT DRAW ----
  socket.on('accept_draw', async (data) => {
    const room = activeRooms.get(data.roomId);
    if (!room) return;
    await endGame(io, room, null, 'stalemate');
  });

  // ---- DECLINE DRAW ----
  socket.on('decline_draw', (data) => {
    socket.to(data.roomId).emit('notification', {
      type: 'draw_declined',
      message: 'Draw offer declined',
    });
  });

  // ---- START AI GAME ----
  socket.on('start_ai_game', async (data) => {
    const { gameType, difficulty } = data;
    const engine = getEngine(gameType);
    const roomId = `game:ai:${socket.userId}:${Date.now()}`;

    const gameState = engine.getInitialState(socket.userId, 'AI_BOT');
    const tc = TIME_CONTROLS.casual;

    const room: RoomState = {
      roomId,
      gameType,
      timeControl: 'casual',
      gameState,
      player1: { userId: socket.userId, username: socket.username, socketId: socket.id, elo: 0 },
      player2: { userId: 'AI_BOT', username: 'AI Bot', socketId: '', elo: 0 },
      moveHistory: [],
      startedAt: Date.now(),
      lastMoveTime: Date.now(),
      timers: {
        player1: { remaining: Infinity, isActive: true },
        player2: { remaining: Infinity, isActive: false },
      },
      mode: 'ai',
      aiDifficulty: difficulty,
    };

    activeRooms.set(roomId, room);
    socket.join(roomId);

    gameLogger.gameStart(roomId, gameType, 'ai');
    socketMetrics.gameStart(gameType);

    socket.emit('game_start', {
      roomId,
      state: gameState,
      players: [
        { userId: socket.userId, username: socket.username, avatarUrl: null, eloRating: 0, rankTier: 'Bronze', color: 'player1', isConnected: true },
        { userId: 'AI_BOT', username: `AI (Lv.${difficulty})`, avatarUrl: null, eloRating: 0, rankTier: 'Bronze', color: 'player2', isConnected: true },
      ],
      timeControl: tc,
    });
  });

  // ---- AI MOVE ----
  socket.on('ai_move', async (data) => {
    const room = activeRooms.get(data.roomId);
    if (!room || room.mode !== 'ai') return;

    const engine = getEngine(room.gameType);
    const currentTurn = engine.getCurrentTurn(room.gameState);
    if (currentTurn !== 'AI_BOT') return;

    let aiMove: any = null;
    const difficulty = room.aiDifficulty || 5;

    setTimeout(() => {
      try {
        switch (room.gameType) {
          case 'tictactoe':
            aiMove = getTicTacToeAIMove(room.gameState, difficulty);
            break;
          case 'checkers':
            aiMove = getCheckersAIMove(room.gameState, difficulty);
            break;
          case 'chess':
            const validMoves = engine.getValidMoves(room.gameState);
            if (validMoves.length > 0) {
              aiMove = validMoves[Math.floor(Math.random() * validMoves.length)];
            }
            break;
        }

        if (aiMove) {
          const result = engine.validateMove(room.gameState, aiMove, 'AI_BOT');
          if (result.valid) {
            room.gameState = result.newState;
            room.moveHistory.push({ ...aiMove, notation: result.notation, timestamp: Date.now() });

            io.to(room.roomId).emit('game_update', {
              state: room.gameState,
              move: { ...aiMove, notation: result.notation },
              timers: room.timers,
            });

            const gameOver = engine.checkGameOver(room.gameState);
            if (gameOver.isOver) {
              endGame(io, room, gameOver.winner, gameOver.reason || 'checkmate');
            }
          }
        }
      } catch (err) {
        metrics.recordError((err as Error).message, (err as Error).stack, 'AI');
      }
    }, 500 + Math.random() * 1000);
  });

  // ---- SPECTATE ----
  socket.on('spectate', (data) => {
    socket.join(data.roomId);
  });

  socket.on('stop_spectating', (data) => {
    socket.leave(data.roomId);
  });
}

// ---- Initialize a game from Redis room data ----
async function initializeGame(
  io: Server<ClientToServerEvents, ServerToClientEvents>,
  roomId: string,
  roomData: any
) {
  const engine = getEngine(roomData.gameType as GameType);
  const gameState = engine.getInitialState(roomData.player1.userId, roomData.player2.userId);
  const tc = TIME_CONTROLS[roomData.timeControl as TimePreset];

  const room: RoomState = {
    roomId,
    gameType: roomData.gameType,
    timeControl: roomData.timeControl,
    gameState,
    player1: roomData.player1,
    player2: roomData.player2,
    moveHistory: [],
    startedAt: Date.now(),
    lastMoveTime: Date.now(),
    timers: {
      player1: { remaining: tc.totalSeconds || Infinity, isActive: true },
      player2: { remaining: tc.totalSeconds || Infinity, isActive: false },
    },
    mode: roomData.mode || 'ranked',
  };

  activeRooms.set(roomId, room);

  // Anti-cheat pre-game check for ranked
  if (room.mode === 'ranked') {
    const p1Check = await antiCheat.preGameCheck(room.player1.userId);
    const p2Check = await antiCheat.preGameCheck(room.player2.userId);

    if (!p1Check.allowed || !p2Check.allowed) {
      io.to(roomId).emit('error', {
        code: 'BLOCKED',
        message: 'One or more players are under review and cannot play ranked matches',
      });
      activeRooms.delete(roomId);
      return;
    }
  }

  if (tc.totalSeconds) {
    startTimer(io, room);
  }

  gameLogger.gameStart(roomId, roomData.gameType, room.mode);
  socketMetrics.gameStart(roomData.gameType);

  io.to(roomId).emit('game_start', {
    roomId,
    state: gameState,
    players: [
      {
        userId: roomData.player1.userId,
        username: roomData.player1.username,
        avatarUrl: null,
        eloRating: roomData.player1.elo,
        rankTier: 'Bronze',
        isConnected: true,
      },
      {
        userId: roomData.player2.userId,
        username: roomData.player2.username,
        avatarUrl: null,
        eloRating: roomData.player2.elo,
        rankTier: 'Bronze',
        isConnected: true,
      },
    ],
    timeControl: tc,
  });
}

// ---- Timer Management ----
function startTimer(io: Server, room: RoomState) {
  room.timerInterval = setInterval(() => {
    if (room.timers.player1.isActive) {
      room.timers.player1.remaining -= 1;
      if (room.timers.player1.remaining <= 0) {
        room.timers.player1.remaining = 0;
        endGame(io, room, room.player2.userId, 'timeout');
        return;
      }
    } else if (room.timers.player2.isActive) {
      room.timers.player2.remaining -= 1;
      if (room.timers.player2.remaining <= 0) {
        room.timers.player2.remaining = 0;
        endGame(io, room, room.player1.userId, 'timeout');
        return;
      }
    }

    io.to(room.roomId).emit('timer_update', room.timers);
  }, 1000);
}

function switchTimer(room: RoomState) {
  const tc = TIME_CONTROLS[room.timeControl];
  const increment = tc.incrementSeconds;

  if (room.timers.player1.isActive) {
    room.timers.player1.remaining += increment;
    room.timers.player1.isActive = false;
    room.timers.player2.isActive = true;
  } else {
    room.timers.player2.remaining += increment;
    room.timers.player2.isActive = false;
    room.timers.player1.isActive = true;
  }
}

// ---- End Game ----
async function endGame(
  io: Server,
  room: RoomState,
  winnerId: string | null,
  reason: string
) {
  if (room.timerInterval) clearInterval(room.timerInterval);

  const durationSecs = Math.round((Date.now() - room.startedAt) / 1000);

  let result: string;
  if (!winnerId) result = 'draw';
  else if (winnerId === room.player1.userId) result = 'player1';
  else result = 'player2';

  // Log game over
  gameLogger.gameOver(room.roomId, result, reason, durationSecs);
  socketMetrics.gameEnd(room.gameType, durationSecs * 1000);

  // Update ELO for ranked matches with retry
  let eloChanges;
  if (room.mode === 'ranked' && room.player2.userId !== 'AI_BOT') {
    try {
      const eloResult = await withRetry(
        () => updatePlayerRatings(room.player1.userId, room.player2.userId, room.gameType, winnerId),
        'update-elo-ratings',
        { maxRetries: 3, baseDelayMs: 500 }
      );

      eloChanges = {
        player1: { before: eloResult.p1Before, after: eloResult.p1After, change: eloResult.p1After - eloResult.p1Before },
        player2: { before: eloResult.p2Before, after: eloResult.p2After, change: eloResult.p2After - eloResult.p2Before },
      };

      // Log ELO changes
      gameLogger.eloUpdate(room.player1.userId, room.gameType, eloResult.p1Before, eloResult.p1After);
      gameLogger.eloUpdate(room.player2.userId, room.gameType, eloResult.p2Before, eloResult.p2After);
    } catch (err) {
      metrics.recordError(`ELO update failed after retries: ${(err as Error).message}`, undefined, 'GAME');
    }
  }

  // Save match (with retry — critical data)
  try {
    await withRetry(
      () => saveMatch({
        gameType: room.gameType,
        mode: room.mode,
        player1Id: room.player1.userId,
        player2Id: room.player2.userId === 'AI_BOT' ? null : room.player2.userId,
        winnerId: winnerId === 'AI_BOT' ? null : winnerId,
        result,
        p1EloBefore: eloChanges?.player1.before,
        p1EloAfter: eloChanges?.player1.after,
        p2EloBefore: eloChanges?.player2.before,
        p2EloAfter: eloChanges?.player2.after,
        totalMoves: room.moveHistory.length,
        durationSecs,
        aiDifficulty: room.aiDifficulty,
        moveHistory: room.moveHistory,
        finalState: room.gameState,
        startedAt: new Date(room.startedAt),
      }),
      'save-match',
      { maxRetries: 3, baseDelayMs: 500 }
    );
  } catch (err) {
    metrics.recordError(`Match save failed after retries: ${(err as Error).message}`, undefined, 'GAME');
  }

  // Anti-cheat end-of-game analysis (non-blocking)
  if (room.mode === 'ranked' && room.player2.userId !== 'AI_BOT') {
    antiCheat.analyzeEndOfGame(
      room.player1.userId, room.roomId, room.gameType,
      winnerId === room.player1.userId ? 'win' : winnerId === null ? 'draw' : 'loss',
      room.moveHistory.length, durationSecs
    ).catch(() => {});

    antiCheat.analyzeEndOfGame(
      room.player2.userId, room.roomId, room.gameType,
      winnerId === room.player2.userId ? 'win' : winnerId === null ? 'draw' : 'loss',
      room.moveHistory.length, durationSecs
    ).catch(() => {});
  }

  // Emit game over
  io.to(room.roomId).emit('game_over', {
    result: result as any,
    winnerId,
    eloChanges,
  });

  // Cleanup
  activeRooms.delete(room.roomId);
  await withFallback(
    () => Promise.all([
      redis.del(keys.gameState(room.roomId)),
      redis.del(keys.gameRoom(room.roomId)),
    ]),
    [0, 0],
    'cleanup-game-room'
  );
}
