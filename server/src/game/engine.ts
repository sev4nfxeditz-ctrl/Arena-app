import { tictactoeEngine } from './tictactoe';
import { chessEngine } from './chess';
import { checkersEngine } from './checkers';
import { GameEngine, GameType } from './types';

export function getEngine(gameType: GameType): GameEngine {
  switch (gameType) {
    case 'tictactoe': return tictactoeEngine;
    case 'chess': return chessEngine;
    case 'checkers': return checkersEngine;
    default: throw new Error(`Unknown game type: ${gameType}`);
  }
}

export { tictactoeEngine, chessEngine, checkersEngine };
export * from './types';
