import { minimax, selectMoveWithDifficulty, MinimaxConfig } from './minimax';
import { TicTacToeState, TicTacToeMove, tictactoeEngine } from '../game/tictactoe';
import { AI_DIFFICULTY } from '../../../shared/constants';

// Win = +10, Loss = -10, Draw = 0, adjusted by depth for faster wins
const WIN_LINES = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8],
  [0, 3, 6], [1, 4, 7], [2, 5, 8],
  [0, 4, 8], [2, 4, 6],
];

// AI is always the second player ('O')
const AI_MARK = 'O';
const HUMAN_MARK = 'X';

function evaluate(state: TicTacToeState, depth: number): number {
  // Check for winner
  for (const [a, b, c] of WIN_LINES) {
    if (state.board[a] && state.board[a] === state.board[b] && state.board[a] === state.board[c]) {
      if (state.board[a] === AI_MARK) return 10 + depth;   // AI wins (prefer faster wins)
      return -(10 + depth);  // Human wins
    }
  }
  return 0; // Draw or ongoing
}

function isTerminal(state: TicTacToeState): boolean {
  // Check for winner
  for (const [a, b, c] of WIN_LINES) {
    if (state.board[a] && state.board[a] === state.board[b] && state.board[a] === state.board[c]) {
      return true;
    }
  }
  // Check for full board
  return !state.board.includes(null);
}

const tttConfig: MinimaxConfig<TicTacToeState, TicTacToeMove> = {
  getMoves: (state) => {
    if (isTerminal(state)) return [];
    return state.board
      .map((cell, i) => cell === null ? { position: i } : null)
      .filter((m): m is TicTacToeMove => m !== null);
  },
  applyMove: (state, move) => {
    const newBoard = [...state.board];
    newBoard[move.position] = state.currentMark;
    return {
      ...state,
      board: newBoard,
      currentMark: state.currentMark === 'X' ? 'O' as const : 'X' as const,
      moveCount: state.moveCount + 1,
    };
  },
  evaluate,
  isTerminal,
  isMaximizing: (state) => state.currentMark === AI_MARK,
};

/**
 * Get AI move for TicTacToe
 * @param state Current game state
 * @param difficulty 1-10
 * @returns The chosen move
 */
export function getTicTacToeAIMove(state: TicTacToeState, difficulty: number): TicTacToeMove | null {
  const clampedDiff = Math.max(1, Math.min(10, difficulty));
  const depth = AI_DIFFICULTY.TICTACTOE_DEPTH[clampedDiff - 1];
  const randomFactor = AI_DIFFICULTY.RANDOM_FACTOR[clampedDiff - 1];

  return selectMoveWithDifficulty(state, depth, randomFactor, tttConfig);
}
