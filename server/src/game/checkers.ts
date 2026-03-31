import { GameEngine, MoveResult, GameOverResult } from './types';

// ---- American Checkers (8x8) ----
// Board uses indices 0-31 for the 32 dark squares
// Pieces: 'r' = red, 'b' = black, 'R' = red king, 'B' = black king, null = empty
// Red moves "up" (toward index 0), Black moves "down" (toward index 31)
// Red starts at bottom (rows 5-7), Black at top (rows 0-2)

export type CheckersPiece = 'r' | 'b' | 'R' | 'B' | null;

export interface CheckersState {
  board: CheckersPiece[];  // 32 cells (dark squares only)
  players: { red: string; black: string };
  currentColor: 'red' | 'black';
  moveCount: number;
  lastMove: CheckersMove | null;
  mustJump: number | null;  // piece index that must continue jumping (multi-jump)
}

export interface CheckersMove {
  from: number;    // board index 0-31
  to: number;      // board index 0-31
  captures?: number[];  // indices of captured pieces
}

// Adjacent squares mapping for standard 8x8 checkers
// Each index maps to [upper-left, upper-right, lower-left, lower-right]
function getAdjacentSquares(pos: number): { ul: number | null; ur: number | null; ll: number | null; lr: number | null } {
  const row = Math.floor(pos / 4);
  const isEvenRow = row % 2 === 0;

  const col = isEvenRow ? (pos % 4) * 2 + 1 : (pos % 4) * 2;

  const result: { ul: number | null; ur: number | null; ll: number | null; lr: number | null } = {
    ul: null, ur: null, ll: null, lr: null
  };

  // Upper-left
  if (row > 0 && col > 0) {
    const newRow = row - 1;
    const newCol = col - 1;
    result.ul = newRow * 4 + (newRow % 2 === 0 ? Math.floor(newCol / 2) : Math.floor(newCol / 2));
    if (newRow % 2 === 0) result.ul = newRow * 4 + Math.floor((newCol) / 2);
    else result.ul = newRow * 4 + Math.floor(newCol / 2);
  }

  // Upper-right
  if (row > 0 && col < 7) {
    const newRow = row - 1;
    const newCol = col + 1;
    if (newRow % 2 === 0) result.ur = newRow * 4 + Math.floor(newCol / 2);
    else result.ur = newRow * 4 + Math.floor(newCol / 2);
  }

  // Lower-left
  if (row < 7 && col > 0) {
    const newRow = row + 1;
    const newCol = col - 1;
    if (newRow % 2 === 0) result.ll = newRow * 4 + Math.floor(newCol / 2);
    else result.ll = newRow * 4 + Math.floor(newCol / 2);
  }

  // Lower-right
  if (row < 7 && col < 7) {
    const newRow = row + 1;
    const newCol = col + 1;
    if (newRow % 2 === 0) result.lr = newRow * 4 + Math.floor(newCol / 2);
    else result.lr = newRow * 4 + Math.floor(newCol / 2);
  }

  return result;
}

// Convert board index to row/col
function indexToRowCol(idx: number): [number, number] {
  const row = Math.floor(idx / 4);
  const isEvenRow = row % 2 === 0;
  const col = isEvenRow ? (idx % 4) * 2 + 1 : (idx % 4) * 2;
  return [row, col];
}

// Convert row/col to board index
function rowColToIndex(row: number, col: number): number | null {
  if (row < 0 || row > 7 || col < 0 || col > 7) return null;
  const isEvenRow = row % 2 === 0;
  if (isEvenRow && col % 2 === 0) return null;  // light square
  if (!isEvenRow && col % 2 === 1) return null;  // light square
  return row * 4 + (isEvenRow ? Math.floor(col / 2) : Math.floor(col / 2));
}

function isPlayerPiece(piece: CheckersPiece, color: 'red' | 'black'): boolean {
  if (!piece) return false;
  if (color === 'red') return piece === 'r' || piece === 'R';
  return piece === 'b' || piece === 'B';
}

function isKing(piece: CheckersPiece): boolean {
  return piece === 'R' || piece === 'B';
}

function getMoveDirs(piece: CheckersPiece): [number, number][] {
  if (!piece) return [];
  if (piece === 'r') return [[-1, -1], [-1, 1]];       // red moves up
  if (piece === 'b') return [[1, -1], [1, 1]];         // black moves down
  return [[-1, -1], [-1, 1], [1, -1], [1, 1]];         // kings move all directions
}

export class CheckersEngine implements GameEngine {
  getInitialState(player1Id: string, player2Id: string): CheckersState {
    // Standard American checkers setup
    const board: CheckersPiece[] = new Array(32).fill(null);

    // Black pieces in rows 0-2 (indices 0-11)
    for (let i = 0; i < 12; i++) board[i] = 'b';

    // Red pieces in rows 5-7 (indices 20-31)
    for (let i = 20; i < 32; i++) board[i] = 'r';

    return {
      board,
      players: { red: player1Id, black: player2Id },
      currentColor: 'black',  // Black moves first in American checkers
      moveCount: 0,
      lastMove: null,
      mustJump: null,
    };
  }

  validateMove(state: CheckersState, move: CheckersMove, playerId: string): MoveResult {
    const expectedPlayer = state.players[state.currentColor];
    if (playerId !== expectedPlayer) {
      return { valid: false, error: 'Not your turn' };
    }

    // Validate basic constraints
    if (move.from < 0 || move.from > 31 || move.to < 0 || move.to > 31) {
      return { valid: false, error: 'Invalid position' };
    }

    const piece = state.board[move.from];
    if (!piece || !isPlayerPiece(piece, state.currentColor)) {
      return { valid: false, error: 'No valid piece at source' };
    }

    if (state.board[move.to] !== null) {
      return { valid: false, error: 'Destination is occupied' };
    }

    // If multi-jump in progress, must continue with the same piece
    if (state.mustJump !== null && move.from !== state.mustJump) {
      return { valid: false, error: 'Must continue jumping with the same piece' };
    }

    const [fromRow, fromCol] = indexToRowCol(move.from);
    const [toRow, toCol] = indexToRowCol(move.to);
    const rowDiff = toRow - fromRow;
    const colDiff = toCol - fromCol;

    const newBoard = [...state.board];
    let isJump = false;
    const captures: number[] = [];

    // Check if it's a jump (2 squares diagonal)
    if (Math.abs(rowDiff) === 2 && Math.abs(colDiff) === 2) {
      const midRow = fromRow + rowDiff / 2;
      const midCol = fromCol + colDiff / 2;
      const midIdx = rowColToIndex(midRow, midCol);

      if (midIdx === null) {
        return { valid: false, error: 'Invalid jump' };
      }

      const midPiece = state.board[midIdx];
      if (!midPiece || isPlayerPiece(midPiece, state.currentColor)) {
        return { valid: false, error: 'No opponent piece to capture' };
      }

      // Valid jump!
      isJump = true;
      captures.push(midIdx);
      newBoard[midIdx] = null;
    }
    // Simple move (1 square diagonal)
    else if (Math.abs(rowDiff) === 1 && Math.abs(colDiff) === 1) {
      // Check direction is valid for non-king pieces
      const dirs = getMoveDirs(piece);
      const validDir = dirs.some(([dr, dc]) => dr === rowDiff && dc === colDiff);
      if (!validDir) {
        return { valid: false, error: 'Invalid direction for this piece' };
      }

      // If jumps are available, must jump (forced capture rule)
      const availableJumps = this.getJumpsForColor(state.board, state.currentColor);
      if (availableJumps.length > 0) {
        return { valid: false, error: 'Must capture when a jump is available' };
      }
    } else {
      return { valid: false, error: 'Invalid move distance' };
    }

    // Direction check for jumps
    if (isJump) {
      const dirs = getMoveDirs(piece);
      const validDir = dirs.some(([dr, dc]) => Math.sign(rowDiff) === dr && Math.sign(colDiff) === dc);
      if (!validDir) {
        return { valid: false, error: 'Invalid jump direction for this piece' };
      }
    }

    // Move the piece
    newBoard[move.to] = piece;
    newBoard[move.from] = null;

    // King promotion
    if (newBoard[move.to] === 'r' && toRow === 0) newBoard[move.to] = 'R';
    if (newBoard[move.to] === 'b' && toRow === 7) newBoard[move.to] = 'B';

    // Check for multi-jump
    let mustJump: number | null = null;
    let nextColor = state.currentColor === 'red' ? 'black' : 'red';

    if (isJump) {
      const furtherJumps = this.getJumpsForPiece(newBoard, move.to);
      if (furtherJumps.length > 0) {
        mustJump = move.to;
        nextColor = state.currentColor; // Same player continues
      }
    }

    const newState: CheckersState = {
      board: newBoard,
      players: state.players,
      currentColor: nextColor,
      moveCount: state.moveCount + 1,
      lastMove: { from: move.from, to: move.to, captures },
      mustJump,
    };

    return {
      valid: true,
      newState,
      notation: `${move.from}-${move.to}${captures.length ? 'x' + captures.join(',') : ''}`,
    };
  }

  checkGameOver(state: CheckersState): GameOverResult {
    const redPieces = state.board.filter(p => p === 'r' || p === 'R').length;
    const blackPieces = state.board.filter(p => p === 'b' || p === 'B').length;

    if (redPieces === 0) {
      return { isOver: true, winner: state.players.black, reason: 'no_pieces' };
    }
    if (blackPieces === 0) {
      return { isOver: true, winner: state.players.red, reason: 'no_pieces' };
    }

    // Check if current player has any valid moves
    const moves = this.getValidMoves(state);
    if (moves.length === 0) {
      const winner = state.currentColor === 'red' ? state.players.black : state.players.red;
      return { isOver: true, winner, reason: 'no_moves' };
    }

    return { isOver: false };
  }

  getValidMoves(state: CheckersState): CheckersMove[] {
    if (state.mustJump !== null) {
      return this.getJumpsForPiece(state.board, state.mustJump);
    }

    // Check for forced jumps first
    const jumps = this.getJumpsForColor(state.board, state.currentColor);
    if (jumps.length > 0) return jumps;

    // Regular moves
    const moves: CheckersMove[] = [];
    for (let i = 0; i < 32; i++) {
      const piece = state.board[i];
      if (!piece || !isPlayerPiece(piece, state.currentColor)) continue;

      const [row, col] = indexToRowCol(i);
      const dirs = getMoveDirs(piece);

      for (const [dr, dc] of dirs) {
        const newRow = row + dr;
        const newCol = col + dc;
        const newIdx = rowColToIndex(newRow, newCol);
        if (newIdx !== null && state.board[newIdx] === null) {
          moves.push({ from: i, to: newIdx });
        }
      }
    }

    return moves;
  }

  getCurrentTurn(state: CheckersState): string {
    return state.players[state.currentColor];
  }

  // ---- Helpers ----

  private getJumpsForColor(board: CheckersPiece[], color: 'red' | 'black'): CheckersMove[] {
    const jumps: CheckersMove[] = [];
    for (let i = 0; i < 32; i++) {
      if (isPlayerPiece(board[i], color)) {
        jumps.push(...this.getJumpsForPiece(board, i));
      }
    }
    return jumps;
  }

  private getJumpsForPiece(board: CheckersPiece[], idx: number): CheckersMove[] {
    const piece = board[idx];
    if (!piece) return [];

    const [row, col] = indexToRowCol(idx);
    const dirs = getMoveDirs(piece);
    const jumps: CheckersMove[] = [];
    const color = piece.toLowerCase() === 'r' ? 'red' : 'black';
    const oppColor = color === 'red' ? 'black' : 'red';

    for (const [dr, dc] of dirs) {
      const midRow = row + dr;
      const midCol = col + dc;
      const midIdx = rowColToIndex(midRow, midCol);

      if (midIdx === null) continue;
      if (!isPlayerPiece(board[midIdx], oppColor)) continue;

      const landRow = row + dr * 2;
      const landCol = col + dc * 2;
      const landIdx = rowColToIndex(landRow, landCol);

      if (landIdx !== null && board[landIdx] === null) {
        jumps.push({ from: idx, to: landIdx, captures: [midIdx] });
      }
    }

    return jumps;
  }
}

export const checkersEngine = new CheckersEngine();
