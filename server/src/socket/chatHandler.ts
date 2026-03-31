import { Server } from 'socket.io';
import { v4 as uuidv4 } from 'uuid';
import redis, { keys } from '../config/redis';
import { query } from '../config/database';
import { AuthenticatedSocket } from './index';
import { filterProfanity, isValidMessage } from '../services/profanity';
import { checkRateLimit } from '../middleware/rateLimit';
import { CHAT_CONFIG } from '../../../shared/constants';
import type { ChatMessage, ServerToClientEvents, ClientToServerEvents } from '../../../shared/types';

export function setupChatHandler(
  io: Server<ClientToServerEvents, ServerToClientEvents>,
  socket: AuthenticatedSocket
) {
  // ---- SEND MESSAGE ----
  socket.on('send_message', async (data) => {
    const { channel, content } = data;

    // Validate message
    const validation = isValidMessage(content);
    if (!validation.valid) {
      socket.emit('error', { code: 'INVALID_MESSAGE', message: validation.error || 'Invalid message' });
      return;
    }

    // Rate limit check
    const rateResult = await checkRateLimit(
      keys.chatRateLimit(socket.userId),
      { maxRequests: CHAT_CONFIG.RATE_LIMIT_MESSAGES, windowSeconds: CHAT_CONFIG.RATE_LIMIT_WINDOW_SECONDS }
    );

    if (!rateResult.allowed) {
      socket.emit('error', {
        code: 'RATE_LIMITED',
        message: `Slow down! You can send ${CHAT_CONFIG.RATE_LIMIT_MESSAGES} messages every ${CHAT_CONFIG.RATE_LIMIT_WINDOW_SECONDS} seconds.`,
      });
      return;
    }

    // Filter profanity
    const filteredContent = filterProfanity(content);

    // Create message
    const message: ChatMessage = {
      id: uuidv4(),
      channel,
      userId: socket.userId,
      username: socket.username,
      avatarUrl: null,
      content: filteredContent,
      isSystem: false,
      createdAt: new Date().toISOString(),
    };

    // Broadcast to channel
    io.to(`chat:${channel}`).emit('chat_message', message);

    // Persist to database (async, non-blocking)
    query(
      `INSERT INTO chat_messages (id, channel, user_id, content, is_system, created_at) 
       VALUES ($1, $2, $3, $4, $5, NOW())`,
      [message.id, channel, socket.userId, filteredContent, false]
    ).catch(err => console.error('Failed to persist chat message:', err));

    // Cache in Redis for quick retrieval
    const cacheKey = keys.chatHistory(channel);
    await redis.lpush(cacheKey, JSON.stringify(message));
    await redis.ltrim(cacheKey, 0, CHAT_CONFIG.HISTORY_LIMIT - 1);
  });

  // ---- JOIN CHANNEL ----
  socket.on('join_channel', async (data) => {
    socket.join(`chat:${data.channel}`);

    // Send recent history from cache
    const cacheKey = keys.chatHistory(data.channel);
    const cached = await redis.lrange(cacheKey, 0, CHAT_CONFIG.HISTORY_LIMIT - 1);

    if (cached.length > 0) {
      const messages = cached.map(c => JSON.parse(c)).reverse();
      socket.emit('chat_history', messages);
    } else {
      // Fall back to database
      const result = await query(
        `SELECT cm.id, cm.channel, cm.user_id, u.username, u.avatar_url,
                cm.content, cm.is_system, cm.created_at
         FROM chat_messages cm
         JOIN users u ON u.id = cm.user_id
         WHERE cm.channel = $1
         ORDER BY cm.created_at DESC
         LIMIT $2`,
        [data.channel, CHAT_CONFIG.HISTORY_LIMIT]
      );

      socket.emit('chat_history', result.rows.reverse());
    }

    // System message
    const joinMsg: ChatMessage = {
      id: uuidv4(),
      channel: data.channel,
      userId: 'system',
      username: 'System',
      avatarUrl: null,
      content: `${socket.username} joined the chat`,
      isSystem: true,
      createdAt: new Date().toISOString(),
    };
    socket.to(`chat:${data.channel}`).emit('chat_message', joinMsg);
  });

  // ---- LEAVE CHANNEL ----
  socket.on('leave_channel', (data) => {
    socket.leave(`chat:${data.channel}`);
  });
}
