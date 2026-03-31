import { RankTier, TimeControl, TimePreset } from './types';

// ---- Time Controls ----
export const TIME_CONTROLS: Record<TimePreset, TimeControl> = {
  bullet: { preset: 'bullet', label: 'Bullet', totalSeconds: 60, incrementSeconds: 0 },
  blitz: { preset: 'blitz', label: 'Blitz', totalSeconds: 300, incrementSeconds: 2 },
  rapid: { preset: 'rapid', label: 'Rapid', totalSeconds: 600, incrementSeconds: 5 },
  casual: { preset: 'casual', label: 'Casual', totalSeconds: null, incrementSeconds: 0 },
};

// ---- Rank Tiers ----
export interface RankInfo {
  tier: RankTier;
  minElo: number;
  maxElo: number;
  color: string;
  glowColor: string;
  icon: string;
}

export const RANK_TIERS: RankInfo[] = [
  { tier: 'Bronze', minElo: 0, maxElo: 1199, color: '#CD7F32', glowColor: 'rgba(205,127,50,0.4)', icon: '🥉' },
  { tier: 'Silver', minElo: 1200, maxElo: 1599, color: '#C0C0C0', glowColor: 'rgba(192,192,192,0.4)', icon: '🥈' },
  { tier: 'Gold', minElo: 1600, maxElo: 1999, color: '#FFD700', glowColor: 'rgba(255,215,0,0.4)', icon: '🥇' },
  { tier: 'Platinum', minElo: 2000, maxElo: 2399, color: '#00CED1', glowColor: 'rgba(0,206,209,0.4)', icon: '💎' },
  { tier: 'Diamond', minElo: 2400, maxElo: 9999, color: '#B9F2FF', glowColor: 'rgba(185,242,255,0.5)', icon: '👑' },
];

export function getRankForElo(elo: number): RankInfo {
  return RANK_TIERS.find(r => elo >= r.minElo && elo <= r.maxElo) || RANK_TIERS[0];
}

// ---- ELO Constants ----
export const ELO_DEFAULTS = {
  INITIAL_RATING: 1200,
  K_FACTOR_NEW: 40,       // < 30 games
  K_FACTOR_STANDARD: 20,  // standard player
  K_FACTOR_MASTER: 10,    // > 2400 ELO
  NEW_PLAYER_THRESHOLD: 30,
  MASTER_THRESHOLD: 2400,
};

// ---- Matchmaking ----
export const MATCHMAKING = {
  INITIAL_ELO_RANGE: 200,
  MAX_ELO_RANGE: 800,
  RANGE_EXPAND_INTERVAL_MS: 5000,
  RANGE_EXPAND_AMOUNT: 100,
  QUEUE_POLL_INTERVAL_MS: 2000,
  MATCH_ACCEPT_TIMEOUT_MS: 30000,
};

// ---- Game ----
export const GAME_CONFIG = {
  RECONNECT_TIMEOUT_MS: 30000,
  PRIVATE_ROOM_CODE_LENGTH: 6,
  PRIVATE_ROOM_TTL_SECONDS: 300,
  MIN_GAMES_FOR_LEADERBOARD: 5,
};

// ---- Chat ----
export const CHAT_CONFIG = {
  MAX_MESSAGE_LENGTH: 500,
  RATE_LIMIT_MESSAGES: 3,
  RATE_LIMIT_WINDOW_SECONDS: 5,
  HISTORY_LIMIT: 50,
  CHANNELS: ['global', 'chess', 'checkers', 'tictactoe'] as const,
};

// ---- AI Difficulty ----
export const AI_DIFFICULTY = {
  MIN: 1,
  MAX: 10,
  DEFAULT: 5,
  // Maps difficulty (1-10) to minimax search depth
  TICTACTOE_DEPTH: [1, 2, 3, 4, 5, 6, 7, 8, 9, 9],
  CHECKERS_DEPTH: [2, 2, 3, 4, 5, 6, 7, 8, 9, 10],
  // Maps difficulty (1-10) to Stockfish skill level (0-20)
  STOCKFISH_SKILL: [0, 2, 4, 6, 8, 10, 12, 14, 17, 20],
  // Maps difficulty (1-10) to Stockfish search depth
  STOCKFISH_DEPTH: [1, 2, 3, 5, 7, 9, 12, 15, 18, 22],
  // Random move probability per difficulty level (higher = more random)
  RANDOM_FACTOR: [0.7, 0.5, 0.35, 0.2, 0.1, 0.05, 0.02, 0.01, 0, 0],
};

// ---- Game Names ----
export const GAME_NAMES: Record<string, string> = {
  chess: 'Chess',
  checkers: 'Checkers',
  tictactoe: 'Tic Tac Toe',
};
