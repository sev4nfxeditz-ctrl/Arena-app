// ============================================
// SHARED TYPES — Arena Pro Gaming Platform
// Used by both frontend and backend
// ============================================

// ---- User & Auth ----
export interface User {
  id: string;
  username: string;
  email: string;
  avatarUrl: string | null;
  provider: 'credentials' | 'google' | 'github';
  isOnline: boolean;
  lastSeen: string;
  createdAt: string;
}

export interface UserProfile extends User {
  ratings: PlayerRating[];
  recentMatches: Match[];
}

// ---- Game Types ----
export type GameType = 'chess' | 'checkers' | 'tictactoe';
export type GameMode = 'ranked' | 'casual' | 'private' | 'ai';
export type GameResult = 'player1' | 'player2' | 'draw' | 'forfeit' | 'timeout';
export type RoomStatus = 'waiting' | 'playing' | 'finished';

// ---- Time Controls ----
export type TimePreset = 'bullet' | 'blitz' | 'rapid' | 'casual';

export interface TimeControl {
  preset: TimePreset;
  label: string;
  totalSeconds: number | null; // null = no timer
  incrementSeconds: number;
}

// ---- Player Rating ----
export interface PlayerRating {
  id: string;
  userId: string;
  gameType: GameType;
  eloRating: number;
  peakRating: number;
  wins: number;
  losses: number;
  draws: number;
  totalGames: number;
  winStreak: number;
  bestStreak: number;
  rankTier: RankTier;
}

export type RankTier = 'Bronze' | 'Silver' | 'Gold' | 'Platinum' | 'Diamond';

// ---- Match ----
export interface Match {
  id: string;
  gameType: GameType;
  mode: GameMode;
  roomCode: string | null;
  player1Id: string;
  player2Id: string | null;
  winnerId: string | null;
  result: GameResult | null;
  p1EloBefore: number | null;
  p1EloAfter: number | null;
  p2EloBefore: number | null;
  p2EloAfter: number | null;
  totalMoves: number;
  durationSecs: number | null;
  aiDifficulty: number | null;
  moveHistory: any[];
  finalState: any;
  startedAt: string;
  endedAt: string | null;
}

// ---- Chat ----
export interface ChatMessage {
  id: string;
  channel: string;
  userId: string;
  username: string;
  avatarUrl: string | null;
  content: string;
  isSystem: boolean;
  createdAt: string;
}

// ---- Leaderboard ----
export interface LeaderboardEntry {
  userId: string;
  username: string;
  avatarUrl: string | null;
  gameType: GameType;
  eloRating: number;
  wins: number;
  losses: number;
  draws: number;
  totalGames: number;
  rankTier: RankTier;
  winStreak: number;
  bestStreak: number;
  globalRank: number;
  winRate: number;
}

// ---- Socket Events ----
export interface ServerToClientEvents {
  // Matchmaking
  match_found: (data: { roomId: string; opponent: User; gameType: GameType; timeControl: TimeControl }) => void;
  queue_update: (data: { position: number; estimatedWait: number }) => void;
  queue_cancelled: () => void;

  // Game
  game_start: (data: { roomId: string; state: GameState; players: GamePlayer[]; timeControl: TimeControl }) => void;
  game_update: (data: { state: GameState; move: GameMove; timers: PlayerTimers }) => void;
  game_over: (data: { result: GameResult; winnerId: string | null; eloChanges?: EloChange }) => void;
  opponent_disconnected: (data: { timeout: number }) => void;
  opponent_reconnected: () => void;
  draw_offered: (data: { fromUserId: string }) => void;
  timer_update: (data: PlayerTimers) => void;

  // Chat
  chat_message: (msg: ChatMessage) => void;
  chat_history: (msgs: ChatMessage[]) => void;

  // Errors
  error: (data: { code: string; message: string }) => void;

  // Spectator
  spectator_joined: (data: { count: number }) => void;
  spectator_left: (data: { count: number }) => void;

  // Notifications
  notification: (data: { type: string; message: string; data?: any }) => void;
}

export interface ClientToServerEvents {
  // Matchmaking
  join_queue: (data: { gameType: GameType; timeControl: TimePreset }) => void;
  leave_queue: () => void;
  create_private: (data: { gameType: GameType; timeControl: TimePreset }) => void;
  join_private: (data: { roomCode: string }) => void;

  // Game
  make_move: (data: { roomId: string; move: GameMove }) => void;
  resign: (data: { roomId: string }) => void;
  offer_draw: (data: { roomId: string }) => void;
  accept_draw: (data: { roomId: string }) => void;
  decline_draw: (data: { roomId: string }) => void;

  // AI
  start_ai_game: (data: { gameType: GameType; difficulty: number }) => void;
  ai_move: (data: { roomId: string; move: GameMove }) => void;

  // Chat
  send_message: (data: { channel: string; content: string }) => void;
  join_channel: (data: { channel: string }) => void;
  leave_channel: (data: { channel: string }) => void;

  // Spectator
  spectate: (data: { roomId: string }) => void;
  stop_spectating: (data: { roomId: string }) => void;
}

// ---- Game State ----
export interface GameState {
  board: any;              // Game-specific board representation
  currentTurn: string;     // Player ID whose turn it is
  moveCount: number;
  status: 'active' | 'check' | 'checkmate' | 'stalemate' | 'draw' | 'finished';
  lastMove: GameMove | null;
  validMoves?: GameMove[]; // Optional: pre-computed valid moves for client
  extra?: any;             // Game-specific extra data (e.g., FEN for chess)
}

export interface GameMove {
  from?: string | number;
  to: string | number;
  piece?: string;
  captured?: string;
  promotion?: string;
  notation?: string;
  timestamp?: number;
}

export interface GamePlayer {
  userId: string;
  username: string;
  avatarUrl: string | null;
  eloRating: number;
  rankTier: RankTier;
  color?: string;          // 'white' | 'black' for chess/checkers, 'X' | 'O' for TTT
  isConnected: boolean;
}

export interface PlayerTimers {
  player1: { remaining: number; isActive: boolean };
  player2: { remaining: number; isActive: boolean };
}

export interface EloChange {
  player1: { before: number; after: number; change: number };
  player2: { before: number; after: number; change: number };
}

// ---- API Response Types ----
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
