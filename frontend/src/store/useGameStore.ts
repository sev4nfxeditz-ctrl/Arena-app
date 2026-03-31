import { create } from 'zustand';
import type { GameType, GameState, GamePlayer, PlayerTimers, TimeControl, EloChange, GameMove } from '@shared/types';

interface GameStore {
  // Room state
  roomId: string | null;
  gameType: GameType | null;
  gameState: GameState | null;
  players: GamePlayer[];
  timeControl: TimeControl | null;
  timers: PlayerTimers | null;
  moveHistory: GameMove[];
  isMyTurn: boolean;

  // Match state
  isSearching: boolean;
  searchGameType: GameType | null;
  queuePosition: number;

  // Game result
  gameResult: {
    result: string;
    winnerId: string | null;
    eloChanges?: EloChange;
  } | null;

  // AI
  aiDifficulty: number;

  // Actions
  setSearching: (searching: boolean, gameType?: GameType) => void;
  setQueuePosition: (position: number) => void;
  startGame: (roomId: string, state: GameState, players: GamePlayer[], timeControl: TimeControl) => void;
  updateGameState: (state: GameState, move: GameMove, timers: PlayerTimers) => void;
  updateTimers: (timers: PlayerTimers) => void;
  setGameResult: (result: any) => void;
  setAiDifficulty: (difficulty: number) => void;
  resetGame: () => void;
}

export const useGameStore = create<GameStore>((set) => ({
  roomId: null,
  gameType: null,
  gameState: null,
  players: [],
  timeControl: null,
  timers: null,
  moveHistory: [],
  isMyTurn: false,

  isSearching: false,
  searchGameType: null,
  queuePosition: 0,

  gameResult: null,
  aiDifficulty: 5,

  setSearching: (searching, gameType) => set({
    isSearching: searching,
    searchGameType: gameType || null,
  }),

  setQueuePosition: (position) => set({ queuePosition: position }),

  startGame: (roomId, state, players, timeControl) => set({
    roomId,
    gameState: state,
    players,
    timeControl,
    moveHistory: [],
    gameResult: null,
    isSearching: false,
  }),

  updateGameState: (state, move, timers) => set((prev) => ({
    gameState: state,
    timers,
    moveHistory: [...prev.moveHistory, move],
  })),

  updateTimers: (timers) => set({ timers }),

  setGameResult: (result) => set({ gameResult: result }),

  setAiDifficulty: (difficulty) => set({ aiDifficulty: difficulty }),

  resetGame: () => set({
    roomId: null,
    gameType: null,
    gameState: null,
    players: [],
    timeControl: null,
    timers: null,
    moveHistory: [],
    gameResult: null,
    isSearching: false,
    searchGameType: null,
  }),
}));
