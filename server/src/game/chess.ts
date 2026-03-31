import { Chess } from 'chess.js';
import { GameEngine, MoveResult, GameOverResult } from './types';

// ---- Chess Game State ----
export interface ChessState {
  fen: string;
  players: { white: string; black: string };
  pgn: string;
  moveCount: number;
  lastMove: { from: string; to: string; san: string } | null;
  inCheck: boolean;
}

export interface ChessMove {
  from: string;
  to: string;
  promotion?: string;
}

export class ChessEngine implements GameEngine {
  getInitialState(player1Id: string, player2Id: string): ChessState {
    const game = new Chess();
    return {
      fen: game.fen(),
      players: { white: player1Id, black: player2Id },
      pgn: '',
      moveCount: 0,
      lastMove: null,
      inCheck: false,
    };
  }

  validateMove(state: ChessState, move: ChessMove, playerId: string): MoveResult {
    const game = new Chess(state.fen);

    // Check whose turn it is
    const currentColor = game.turn() === 'w' ? 'white' : 'black';
    const expectedPlayer = state.players[currentColor];
    if (playerId !== expectedPlayer) {
      return { valid: false, error: 'Not your turn' };
    }

    // Attempt the move
    try {
      const result = game.move({
        from: move.from,
        to: move.to,
        promotion: move.promotion || 'q',
      });

      if (!result) {
        return { valid: false, error: 'Illegal move' };
      }

      const newState: ChessState = {
        fen: game.fen(),
        players: state.players,
        pgn: game.pgn(),
        moveCount: state.moveCount + 1,
        lastMove: { from: result.from, to: result.to, san: result.san },
        inCheck: game.inCheck(),
      };

      return { valid: true, newState, notation: result.san };
    } catch {
      return { valid: false, error: 'Invalid move format' };
    }
  }

  checkGameOver(state: ChessState): GameOverResult {
    const game = new Chess(state.fen);

    if (game.isCheckmate()) {
      // The player whose turn it is has been checkmated
      const loserColor = game.turn() === 'w' ? 'white' : 'black';
      const winnerColor = loserColor === 'white' ? 'black' : 'white';
      return { isOver: true, winner: state.players[winnerColor], reason: 'checkmate' };
    }

    if (game.isStalemate() || game.isDraw() || game.isThreefoldRepetition() || game.isInsufficientMaterial()) {
      return { isOver: true, winner: null, reason: 'stalemate' };
    }

    return { isOver: false };
  }

  getValidMoves(state: ChessState): ChessMove[] {
    const game = new Chess(state.fen);
    return game.moves({ verbose: true }).map(m => ({
      from: m.from,
      to: m.to,
      promotion: m.promotion,
    }));
  }

  getCurrentTurn(state: ChessState): string {
    const game = new Chess(state.fen);
    const color = game.turn() === 'w' ? 'white' : 'black';
    return state.players[color];
  }

  // Helper: get FEN for AI engines
  getFen(state: ChessState): string {
    return state.fen;
  }
}

export const chessEngine = new ChessEngine();
