// ---- Game Engine Types ----

export type GameType = 'chess' | 'checkers' | 'tictactoe';

export interface MoveResult {
  valid: boolean;
  newState?: any;
  error?: string;
  notation?: string;
}

export interface GameOverResult {
  isOver: boolean;
  winner?: string | null;  // player identifier or null for draw
  reason?: 'checkmate' | 'stalemate' | 'no_moves' | 'no_pieces' | 'three_in_row' | 'board_full' | 'resign' | 'timeout' | 'forfeit';
}

export interface GameEngine {
  /** Create the initial game state */
  getInitialState(player1Id: string, player2Id: string): any;

  /** Validate and apply a move. Returns new state or error. */
  validateMove(state: any, move: any, playerId: string): MoveResult;

  /** Check if the game is over */
  checkGameOver(state: any): GameOverResult;

  /** Get all valid moves for current player */
  getValidMoves(state: any): any[];

  /** Get the ID of the player whose turn it is */
  getCurrentTurn(state: any): string;
}
