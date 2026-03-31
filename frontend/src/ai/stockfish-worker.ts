/**
 * Stockfish WASM Web Worker Controller
 * 
 * Runs Stockfish chess engine in a Web Worker for client-side AI.
 * Used for casual/AI games. Ranked games use server-side validation.
 * 
 * Usage:
 *   const stockfish = new StockfishWorker();
 *   await stockfish.init();
 *   stockfish.setDifficulty(5);
 *   const bestMove = await stockfish.getBestMove('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1');
 *   // bestMove = 'e2e4'
 */

export class StockfishWorker {
  private worker: Worker | null = null;
  private isReady = false;
  private skillLevel = 10;
  private searchDepth = 10;
  private moveTimeMs = 1000;

  async init(): Promise<boolean> {
    try {
      // Try loading Stockfish WASM
      this.worker = new Worker('/stockfish/stockfish.js');

      return new Promise((resolve) => {
        if (!this.worker) { resolve(false); return; }

        const timeout = setTimeout(() => {
          console.warn('Stockfish init timeout, falling back to random moves');
          resolve(false);
        }, 5000);

        this.worker.onmessage = (e) => {
          const msg = e.data;
          if (typeof msg === 'string' && msg.includes('uciok')) {
            clearTimeout(timeout);
            this.isReady = true;
            this.worker!.postMessage('isready');
          }
          if (typeof msg === 'string' && msg.includes('readyok')) {
            resolve(true);
          }
        };

        this.worker.postMessage('uci');
      });
    } catch (err) {
      console.warn('Stockfish WASM not available:', err);
      return false;
    }
  }

  /**
   * Set difficulty (1-10)
   * Maps to Stockfish Skill Level (0-20) and search depth (1-22)
   */
  setDifficulty(difficulty: number): void {
    const d = Math.max(1, Math.min(10, difficulty));
    const skillLevels = [0, 2, 4, 6, 8, 10, 12, 14, 17, 20];
    const depths = [1, 2, 3, 5, 7, 9, 12, 15, 18, 22];
    const times = [100, 200, 300, 500, 800, 1000, 1500, 2000, 3000, 5000];

    this.skillLevel = skillLevels[d - 1];
    this.searchDepth = depths[d - 1];
    this.moveTimeMs = times[d - 1];

    if (this.worker && this.isReady) {
      this.worker.postMessage(`setoption name Skill Level value ${this.skillLevel}`);
    }
  }

  /**
   * Get best move for a given FEN position
   * Returns move in UCI format (e.g., 'e2e4', 'e7e8q')
   */
  async getBestMove(fen: string): Promise<string | null> {
    if (!this.worker || !this.isReady) return null;

    return new Promise((resolve) => {
      const timeout = setTimeout(() => resolve(null), this.moveTimeMs + 2000);

      const handler = (e: MessageEvent) => {
        const msg = e.data;
        if (typeof msg === 'string' && msg.startsWith('bestmove')) {
          clearTimeout(timeout);
          this.worker!.removeEventListener('message', handler);
          const move = msg.split(' ')[1];
          resolve(move || null);
        }
      };

      this.worker!.addEventListener('message', handler);
      this.worker!.postMessage(`position fen ${fen}`);
      this.worker!.postMessage(`go depth ${this.searchDepth} movetime ${this.moveTimeMs}`);
    });
  }

  destroy(): void {
    if (this.worker) {
      this.worker.postMessage('quit');
      this.worker.terminate();
      this.worker = null;
      this.isReady = false;
    }
  }
}

// Singleton instance
let instance: StockfishWorker | null = null;

export function getStockfish(): StockfishWorker {
  if (!instance) {
    instance = new StockfishWorker();
  }
  return instance;
}
