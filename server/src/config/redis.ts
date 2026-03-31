import Redis from 'ioredis';
import { env } from './env';

const redis = new Redis(env.REDIS_URL, {
  maxRetriesPerRequest: 3,
  retryStrategy(times: number) {
    const delay = Math.min(times * 200, 5000);
    console.log(`🔄 Redis reconnecting in ${delay}ms (attempt ${times})`);
    return delay;
  },
  lazyConnect: true,
});

redis.on('connect', () => {
  console.log('✅ Redis connected');
});

redis.on('error', (err) => {
  console.error('❌ Redis error:', err.message);
});

// Key builders for consistent namespacing
export const keys = {
  // Game state
  gameState: (roomId: string) => `arena:game:${roomId}`,
  gameRoom: (roomId: string) => `arena:room:${roomId}`,
  gamePlayers: (roomId: string) => `arena:room:${roomId}:players`,
  gameTimers: (roomId: string) => `arena:room:${roomId}:timers`,

  // Matchmaking
  queue: (gameType: string, timePreset: string) => `arena:queue:${gameType}:${timePreset}`,
  queuePlayer: (userId: string) => `arena:queue:player:${userId}`,

  // Private rooms
  privateRoom: (code: string) => `arena:private:${code}`,

  // User sessions
  userSession: (userId: string) => `arena:session:${userId}`,
  userSocket: (userId: string) => `arena:socket:${userId}`,
  onlineUsers: () => `arena:online`,

  // Chat rate limiting
  chatRateLimit: (userId: string) => `arena:chat:rate:${userId}`,

  // Chat history cache
  chatHistory: (channel: string) => `arena:chat:history:${channel}`,

  // Reconnection
  reconnectToken: (userId: string) => `arena:reconnect:${userId}`,
};

export async function connectRedis(): Promise<void> {
  try {
    await redis.connect();
    console.log('✅ Redis connection verified');
  } catch (error) {
    // Already connected or connection in progress
    if ((error as any).message?.includes('already')) {
      return;
    }
    console.error('❌ Redis connection failed:', error);
    throw error;
  }
}

export default redis;
