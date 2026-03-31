import { AI_DIFFICULTY } from '../../../shared/constants';

export interface DifficultyConfig {
  depth: number;
  randomFactor: number;
  // Stockfish specific
  stockfishSkill?: number;
  stockfishDepth?: number;
}

export function getDifficultyConfig(gameType: string, difficulty: number): DifficultyConfig {
  const d = Math.max(1, Math.min(10, difficulty)) - 1;

  switch (gameType) {
    case 'tictactoe':
      return {
        depth: AI_DIFFICULTY.TICTACTOE_DEPTH[d],
        randomFactor: AI_DIFFICULTY.RANDOM_FACTOR[d],
      };
    case 'checkers':
      return {
        depth: AI_DIFFICULTY.CHECKERS_DEPTH[d],
        randomFactor: AI_DIFFICULTY.RANDOM_FACTOR[d],
      };
    case 'chess':
      return {
        depth: AI_DIFFICULTY.STOCKFISH_DEPTH[d],
        randomFactor: AI_DIFFICULTY.RANDOM_FACTOR[d],
        stockfishSkill: AI_DIFFICULTY.STOCKFISH_SKILL[d],
        stockfishDepth: AI_DIFFICULTY.STOCKFISH_DEPTH[d],
      };
    default:
      return { depth: 3, randomFactor: 0.3 };
  }
}
