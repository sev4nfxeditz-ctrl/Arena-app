import { selectMoveWithDifficulty, MinimaxConfig } from './minimax';
import { CheckersState, CheckersMove, CheckersPiece, checkersEngine } from '../game/checkers';
import { AI_DIFFICULTY } from '../../../shared/constants';

// AI plays as 'black' by convention (second player)
const AI_COLOR = 'black';

/**
 * Heuristic evaluation for Checkers
 * Evaluates from AI (black) perspective
 */
function evaluate(state: CheckersState, _depth: number): number {
  let score = 0;

  for (let i = 0; i < 32; i++) {
    const piece = state.board[i];
    if (!piece) continue;

    const row = Math.floor(i / 4);
    const isCenter = (i % 4 === 1 || i % 4 === 2);

    if (piece === 'b') {
      score += 100;          // Base piece value
      score += row * 5;      // Advancement bonus (closer to king row)
      if (isCenter) score += 3; // Center control
      if (row === 7) score += 50; // About to be king
    } else if (piece === 'B') {
      score += 150;          // King is more valuable
      if (isCenter) score += 5;
    } else if (piece === 'r') {
      score -= 100;
      score -= (7 - row) * 5;
      if (isCenter) score -= 3;
      if (row === 0) score -= 50;
    } else if (piece === 'R') {
      score -= 150;
      if (isCenter) score -= 5;
    }
  }

  // Bonus for having more pieces
  const blackCount = state.board.filter(p => p === 'b' || p === 'B').length;
  const redCount = state.board.filter(p => p === 'r' || p === 'R').length;

  if (redCount === 0) score += 10000;    // AI wins
  if (blackCount === 0) score -= 10000;  // AI loses

  // Mobility bonus
  const savedColor = state.currentColor;
  const aiMoves = getMovesForColor(state, 'black').length;
  const oppMoves = getMovesForColor(state, 'red').length;
  score += (aiMoves - oppMoves) * 2;

  if (oppMoves === 0 && state.currentColor === 'red') score += 10000;
  if (aiMoves === 0 && state.currentColor === 'black') score -= 10000;

  return score;
}

function getMovesForColor(state: CheckersState, color: 'red' | 'black'): CheckersMove[] {
  const tempState = { ...state, currentColor: color as 'red' | 'black', mustJump: null };
  return checkersEngine.getValidMoves(tempState);
}

function isTerminal(state: CheckersState): boolean {
  return checkersEngine.checkGameOver(state).isOver;
}

const checkersConfig: MinimaxConfig<CheckersState, CheckersMove> = {
  getMoves: (state) => checkersEngine.getValidMoves(state),
  applyMove: (state, move) => {
    const result = checkersEngine.validateMove(state, move, state.players[state.currentColor]);
    if (result.valid && result.newState) return result.newState;
    return state; // Shouldn't happen since we're using valid moves
  },
  evaluate,
  isTerminal,
  isMaximizing: (state) => state.currentColor === AI_COLOR,
};

/**
 * Get AI move for Checkers
 * @param state Current game state
 * @param difficulty 1-10
 * @returns The chosen move
 */
export function getCheckersAIMove(state: CheckersState, difficulty: number): CheckersMove | null {
  const clampedDiff = Math.max(1, Math.min(10, difficulty));
  const depth = AI_DIFFICULTY.CHECKERS_DEPTH[clampedDiff - 1];
  const randomFactor = AI_DIFFICULTY.RANDOM_FACTOR[clampedDiff - 1];

  return selectMoveWithDifficulty(state, depth, randomFactor, checkersConfig);
}
