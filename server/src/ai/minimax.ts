// ---- Generic Minimax with Alpha-Beta Pruning ----
// Used by TicTacToe and Checkers AI

export interface MinimaxConfig<TState, TMove> {
  /** Get all valid moves for the current player */
  getMoves: (state: TState) => TMove[];
  /** Apply a move and return new state (should not mutate original) */
  applyMove: (state: TState, move: TMove) => TState;
  /** Evaluate the board from maximizing player's perspective. Higher = better. */
  evaluate: (state: TState, depth: number) => number;
  /** Check if the game is over (terminal node) */
  isTerminal: (state: TState) => boolean;
  /** Check if it's the maximizing player's turn */
  isMaximizing: (state: TState) => boolean;
}

export interface MinimaxResult<TMove> {
  score: number;
  move: TMove | null;
}

export function minimax<TState, TMove>(
  state: TState,
  depth: number,
  alpha: number,
  beta: number,
  config: MinimaxConfig<TState, TMove>
): MinimaxResult<TMove> {
  // Terminal check or depth limit
  if (depth === 0 || config.isTerminal(state)) {
    return { score: config.evaluate(state, depth), move: null };
  }

  const moves = config.getMoves(state);
  if (moves.length === 0) {
    return { score: config.evaluate(state, depth), move: null };
  }

  const maximizing = config.isMaximizing(state);
  let bestMove: TMove | null = null;

  if (maximizing) {
    let maxEval = -Infinity;
    for (const move of moves) {
      const newState = config.applyMove(state, move);
      const result = minimax(newState, depth - 1, alpha, beta, config);

      if (result.score > maxEval) {
        maxEval = result.score;
        bestMove = move;
      }
      alpha = Math.max(alpha, result.score);
      if (beta <= alpha) break; // Beta cutoff
    }
    return { score: maxEval, move: bestMove };
  } else {
    let minEval = Infinity;
    for (const move of moves) {
      const newState = config.applyMove(state, move);
      const result = minimax(newState, depth - 1, alpha, beta, config);

      if (result.score < minEval) {
        minEval = result.score;
        bestMove = move;
      }
      beta = Math.min(beta, result.score);
      if (beta <= alpha) break; // Alpha cutoff
    }
    return { score: minEval, move: bestMove };
  }
}

/**
 * Select an AI move with randomness based on difficulty.
 * Lower difficulty = higher chance of picking a non-optimal move.
 */
export function selectMoveWithDifficulty<TState, TMove>(
  state: TState,
  depth: number,
  randomFactor: number,
  config: MinimaxConfig<TState, TMove>
): TMove | null {
  const moves = config.getMoves(state);
  if (moves.length === 0) return null;

  // Random factor: chance of picking a completely random move
  if (Math.random() < randomFactor) {
    return moves[Math.floor(Math.random() * moves.length)];
  }

  // Otherwise use minimax
  const result = minimax(state, depth, -Infinity, Infinity, config);
  return result.move;
}
