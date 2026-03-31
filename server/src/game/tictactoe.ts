import { GameEngine, MoveResult, GameOverResult } from './types';

// ---- TicTacToe Game State ----
export interface TicTacToeState {
  board: (string | null)[];  // 9 cells: 'X', 'O', or null
  players: { X: string; O: string };
  currentMark: 'X' | 'O';
  moveCount: number;
  winner: string | null;
  winningLine: number[] | null;
}

export interface TicTacToeMove {
  position: number;  // 0-8
}

const WIN_LINES = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8], // rows
  [0, 3, 6], [1, 4, 7], [2, 5, 8], // columns
  [0, 4, 8], [2, 4, 6],             // diagonals
];

export class TicTacToeEngine implements GameEngine {
  getInitialState(player1Id: string, player2Id: string): TicTacToeState {
    return {
      board: Array(9).fill(null),
      players: { X: player1Id, O: player2Id },
      currentMark: 'X',
      moveCount: 0,
      winner: null,
      winningLine: null,
    };
  }

  validateMove(state: TicTacToeState, move: TicTacToeMove, playerId: string): MoveResult {
    // Check it's this player's turn
    const expectedPlayer = state.players[state.currentMark];
    if (playerId !== expectedPlayer) {
      return { valid: false, error: 'Not your turn' };
    }

    // Validate position
    if (move.position < 0 || move.position > 8) {
      return { valid: false, error: 'Invalid position' };
    }

    // Check cell is empty
    if (state.board[move.position] !== null) {
      return { valid: false, error: 'Cell is already occupied' };
    }

    // Check game not already over
    if (state.winner !== null) {
      return { valid: false, error: 'Game is already over' };
    }

    // Apply move
    const newBoard = [...state.board];
    newBoard[move.position] = state.currentMark;

    // Check for winner
    let winner: string | null = null;
    let winningLine: number[] | null = null;

    for (const line of WIN_LINES) {
      const [a, b, c] = line;
      if (newBoard[a] && newBoard[a] === newBoard[b] && newBoard[a] === newBoard[c]) {
        winner = state.players[newBoard[a] as 'X' | 'O'];
        winningLine = line;
        break;
      }
    }

    const newState: TicTacToeState = {
      ...state,
      board: newBoard,
      currentMark: state.currentMark === 'X' ? 'O' : 'X',
      moveCount: state.moveCount + 1,
      winner,
      winningLine,
    };

    return {
      valid: true,
      newState,
      notation: `${state.currentMark}→${move.position}`,
    };
  }

  checkGameOver(state: TicTacToeState): GameOverResult {
    if (state.winner) {
      return { isOver: true, winner: state.winner, reason: 'three_in_row' };
    }
    if (state.moveCount >= 9) {
      return { isOver: true, winner: null, reason: 'board_full' };
    }
    return { isOver: false };
  }

  getValidMoves(state: TicTacToeState): TicTacToeMove[] {
    if (state.winner) return [];
    return state.board
      .map((cell, i) => cell === null ? { position: i } : null)
      .filter((m): m is TicTacToeMove => m !== null);
  }

  getCurrentTurn(state: TicTacToeState): string {
    return state.players[state.currentMark];
  }
}

export const tictactoeEngine = new TicTacToeEngine();
