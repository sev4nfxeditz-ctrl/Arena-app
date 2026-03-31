// ============================================
// Anti-Cheat System — Arena Pro
// Deep analysis: move timing, pattern detection,
// statistical anomaly checks, bot detection
// ============================================

import redis, { keys } from '../config/redis';
import { antiCheatLogger } from '../config/logger';

// ---- Configuration ----
const ANTICHEAT_CONFIG = {
  // Move timing
  MIN_MOVE_TIME_MS: 100,            // Minimum human reaction time
  SUSPICIOUS_FAST_STREAK: 5,        // Consecutive sub-300ms moves
  BOT_SPEED_THRESHOLD_MS: 50,       // Below this = definitely bot

  // Consistency analysis
  TIMING_VARIANCE_WINDOW: 20,       // Number of moves to analyze
  SUSPICIOUS_LOW_VARIANCE: 0.05,    // Coefficient of variation threshold

  // Pattern detection
  PERFECT_PLAY_STREAK: 15,          // Consecutive optimal moves (in simple games)
  SAME_OPENING_THRESHOLD: 10,       // Same sequence repeated too many times

  // Scoring
  FLAG_THRESHOLD: 100,              // Total suspicion score to flag
  AUTO_BAN_THRESHOLD: 250,          // Score for automatic action

  // Decay
  SCORE_DECAY_PER_GAME: 10,        // Points removed per clean game

  // Keys TTL
  PLAYER_DATA_TTL: 86400 * 7,      // 7 days
};

// ---- Types ----
interface MoveTimingData {
  moveNumber: number;
  timeMs: number;
  timestamp: number;
}

interface PlayerAntiCheatProfile {
  userId: string;
  suspicionScore: number;
  flags: AntiCheatFlag[];
  moveTimings: MoveTimingData[];
  gamesAnalyzed: number;
  lastUpdated: number;
}

interface AntiCheatFlag {
  type: string;
  severity: 'low' | 'medium' | 'high';
  description: string;
  timestamp: number;
  roomId?: string;
  evidence?: any;
}

export interface AntiCheatResult {
  allowed: boolean;
  suspicionScore: number;
  flags: AntiCheatFlag[];
  action: 'none' | 'warn' | 'flag' | 'block';
}

// Redis key for anti-cheat data
const acKey = (userId: string) => `arena:anticheat:${userId}`;
const acTimingsKey = (userId: string, roomId: string) => `arena:anticheat:timings:${userId}:${roomId}`;

// ---- Core Anti-Cheat Service ----
export class AntiCheatService {
  /**
   * Analyze a move for suspicious behavior.
   * Called on every move_made event.
   */
  async analyzeMove(
    userId: string,
    roomId: string,
    moveNumber: number,
    moveTimeMs: number,
    gameType: string,
    isOptimalMove: boolean = false
  ): Promise<AntiCheatResult> {
    const flags: AntiCheatFlag[] = [];
    let addedScore = 0;

    // ---- 1. Move Timing Analysis ----

    // Store timing data
    const timingEntry: MoveTimingData = { moveNumber, timeMs: moveTimeMs, timestamp: Date.now() };
    await redis.rpush(acTimingsKey(userId, roomId), JSON.stringify(timingEntry));
    await redis.expire(acTimingsKey(userId, roomId), 7200); // 2hr TTL

    // A) Impossibly fast move
    if (moveTimeMs < ANTICHEAT_CONFIG.BOT_SPEED_THRESHOLD_MS) {
      const flag: AntiCheatFlag = {
        type: 'bot_speed',
        severity: 'high',
        description: `Move made in ${moveTimeMs}ms — below human reaction threshold`,
        timestamp: Date.now(),
        roomId,
        evidence: { moveTimeMs, moveNumber },
      };
      flags.push(flag);
      addedScore += 30;
      antiCheatLogger.suspicion(userId, 'bot_speed', { moveTimeMs, moveNumber }, 'high');
    }
    // B) Suspiciously fast move
    else if (moveTimeMs < ANTICHEAT_CONFIG.MIN_MOVE_TIME_MS) {
      const flag: AntiCheatFlag = {
        type: 'fast_move',
        severity: 'medium',
        description: `Move made in ${moveTimeMs}ms — faster than typical human reaction`,
        timestamp: Date.now(),
        roomId,
        evidence: { moveTimeMs, moveNumber },
      };
      flags.push(flag);
      addedScore += 10;
      antiCheatLogger.suspicion(userId, 'fast_move', { moveTimeMs, moveNumber }, 'medium');
    }

    // C) Consecutive fast moves streak
    const recentTimings = await this.getRecentTimings(userId, roomId);
    const fastStreak = this.countFastStreak(recentTimings, 300);
    if (fastStreak >= ANTICHEAT_CONFIG.SUSPICIOUS_FAST_STREAK) {
      const flag: AntiCheatFlag = {
        type: 'fast_move_streak',
        severity: 'high',
        description: `${fastStreak} consecutive moves under 300ms`,
        timestamp: Date.now(),
        roomId,
        evidence: { streak: fastStreak },
      };
      flags.push(flag);
      addedScore += 25;
      antiCheatLogger.suspicion(userId, 'fast_move_streak', { streak: fastStreak }, 'high');
    }

    // ---- 2. Timing Consistency (Bot Detection) ----
    if (recentTimings.length >= ANTICHEAT_CONFIG.TIMING_VARIANCE_WINDOW) {
      const windowTimings = recentTimings.slice(-ANTICHEAT_CONFIG.TIMING_VARIANCE_WINDOW);
      const cv = this.coefficientOfVariation(windowTimings.map(t => t.timeMs));

      // Humans have natural variance in timing. Bots are often mechanically consistent.
      if (cv < ANTICHEAT_CONFIG.SUSPICIOUS_LOW_VARIANCE && cv >= 0) {
        const flag: AntiCheatFlag = {
          type: 'robotic_timing',
          severity: 'high',
          description: `Move timing variance unusually low (CV=${cv.toFixed(4)}) — possible bot`,
          timestamp: Date.now(),
          roomId,
          evidence: { cv, window: ANTICHEAT_CONFIG.TIMING_VARIANCE_WINDOW },
        };
        flags.push(flag);
        addedScore += 40;
        antiCheatLogger.suspicion(userId, 'robotic_timing', { cv }, 'high');
      }
    }

    // ---- 3. Perfect Play Detection ----
    // Track consecutive optimal moves (meaningful mainly for simpler games)
    if (isOptimalMove && (gameType === 'tictactoe' || gameType === 'checkers')) {
      const perfectKey = `arena:anticheat:perfect:${userId}:${roomId}`;
      const perfectCount = await redis.incr(perfectKey);
      await redis.expire(perfectKey, 7200);

      if (perfectCount >= ANTICHEAT_CONFIG.PERFECT_PLAY_STREAK) {
        const flag: AntiCheatFlag = {
          type: 'perfect_play',
          severity: 'medium',
          description: `${perfectCount} consecutive optimal moves — possible engine assistance`,
          timestamp: Date.now(),
          roomId,
          evidence: { streak: perfectCount, gameType },
        };
        flags.push(flag);
        addedScore += 15;
        antiCheatLogger.suspicion(userId, 'perfect_play', { streak: perfectCount }, 'medium');
      }
    }

    // ---- 4. Update Player Profile ----
    const currentScore = await this.getPlayerScore(userId);
    const newScore = Math.max(0, currentScore + addedScore);
    await this.setPlayerScore(userId, newScore);

    // Store flags
    if (flags.length > 0) {
      const existingFlags = await this.getPlayerFlags(userId);
      const combined = [...existingFlags, ...flags].slice(-50); // Keep last 50
      await redis.set(
        `${acKey(userId)}:flags`,
        JSON.stringify(combined),
        'EX',
        ANTICHEAT_CONFIG.PLAYER_DATA_TTL
      );
    }

    // ---- 5. Determine Action ----
    let action: AntiCheatResult['action'] = 'none';
    if (newScore >= ANTICHEAT_CONFIG.AUTO_BAN_THRESHOLD) {
      action = 'block';
      antiCheatLogger.flagged(userId, roomId, `Auto-block: suspicion score ${newScore}`);
    } else if (newScore >= ANTICHEAT_CONFIG.FLAG_THRESHOLD) {
      action = 'flag';
      antiCheatLogger.flagged(userId, roomId, `Flagged for review: suspicion score ${newScore}`);
    } else if (addedScore > 0) {
      action = 'warn';
    }

    return {
      allowed: action !== 'block',
      suspicionScore: newScore,
      flags,
      action,
    };
  }

  /**
   * Analyze end-of-game patterns (called when match finishes)
   */
  async analyzeEndOfGame(
    userId: string,
    roomId: string,
    gameType: string,
    result: 'win' | 'loss' | 'draw',
    totalMoves: number,
    durationSecs: number
  ): Promise<void> {
    const timings = await this.getRecentTimings(userId, roomId);

    if (timings.length < 5) return; // Too few moves to analyze

    // ---- Average move speed analysis ----
    const avgMoveTime = timings.reduce((s, t) => s + t.timeMs, 0) / timings.length;

    // Chess: pro players rarely average under 1s per move in blitz  
    // If someone averages < 200ms in chess, very suspicious
    if (gameType === 'chess' && avgMoveTime < 200 && totalMoves > 10) {
      antiCheatLogger.suspicion(userId, 'avg_speed_chess', { avgMoveTime, totalMoves }, 'high');
      await this.addScore(userId, 30);
    }

    // ---- Win rate anomaly (done periodically, not every game) ----
    // Decay score for clean games
    if (result !== 'win') {
      await this.decayScore(userId);
    }

    // Cleanup match-specific data
    await redis.del(acTimingsKey(userId, roomId));
    await redis.del(`arena:anticheat:perfect:${userId}:${roomId}`);
  }

  /**
   * Pre-game check — should this player be allowed to play ranked?
   */
  async preGameCheck(userId: string): Promise<{ allowed: boolean; reason?: string }> {
    const score = await this.getPlayerScore(userId);

    if (score >= ANTICHEAT_CONFIG.AUTO_BAN_THRESHOLD) {
      return { allowed: false, reason: 'Account under review for suspicious activity' };
    }

    return { allowed: true };
  }

  /**
   * Get a player's anti-cheat dashboard data
   */
  async getPlayerProfile(userId: string): Promise<PlayerAntiCheatProfile> {
    const score = await this.getPlayerScore(userId);
    const flags = await this.getPlayerFlags(userId);

    return {
      userId,
      suspicionScore: score,
      flags,
      moveTimings: [],
      gamesAnalyzed: 0,
      lastUpdated: Date.now(),
    };
  }

  // ---- Private Helpers ----

  private async getRecentTimings(userId: string, roomId: string): Promise<MoveTimingData[]> {
    const raw = await redis.lrange(acTimingsKey(userId, roomId), 0, -1);
    return raw.map(r => JSON.parse(r));
  }

  private countFastStreak(timings: MoveTimingData[], thresholdMs: number): number {
    let streak = 0;
    for (let i = timings.length - 1; i >= 0; i--) {
      if (timings[i].timeMs < thresholdMs) streak++;
      else break;
    }
    return streak;
  }

  private coefficientOfVariation(values: number[]): number {
    if (values.length < 2) return 1;
    const mean = values.reduce((s, v) => s + v, 0) / values.length;
    if (mean === 0) return 0;
    const variance = values.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / values.length;
    const stddev = Math.sqrt(variance);
    return stddev / mean;
  }

  private async getPlayerScore(userId: string): Promise<number> {
    const raw = await redis.get(`${acKey(userId)}:score`);
    return raw ? parseInt(raw) : 0;
  }

  private async setPlayerScore(userId: string, score: number): Promise<void> {
    await redis.set(`${acKey(userId)}:score`, score.toString(), 'EX', ANTICHEAT_CONFIG.PLAYER_DATA_TTL);
  }

  private async addScore(userId: string, amount: number): Promise<void> {
    const current = await this.getPlayerScore(userId);
    await this.setPlayerScore(userId, current + amount);
  }

  private async decayScore(userId: string): Promise<void> {
    const current = await this.getPlayerScore(userId);
    if (current > 0) {
      await this.setPlayerScore(userId, Math.max(0, current - ANTICHEAT_CONFIG.SCORE_DECAY_PER_GAME));
    }
  }

  private async getPlayerFlags(userId: string): Promise<AntiCheatFlag[]> {
    const raw = await redis.get(`${acKey(userId)}:flags`);
    return raw ? JSON.parse(raw) : [];
  }
}

// Singleton
export const antiCheat = new AntiCheatService();
