import { v4 as uuidv4 } from 'uuid';
import { query } from '../config/database';

/** Save a completed match to the database */
export async function saveMatch(data: {
  gameType: string;
  mode: string;
  roomCode?: string;
  player1Id: string;
  player2Id: string | null;
  winnerId: string | null;
  result: string;
  p1EloBefore?: number;
  p1EloAfter?: number;
  p2EloBefore?: number;
  p2EloAfter?: number;
  totalMoves: number;
  durationSecs: number;
  aiDifficulty?: number;
  moveHistory: any[];
  finalState: any;
  startedAt: Date;
}): Promise<string> {
  const matchId = uuidv4();

  await query(
    `INSERT INTO matches (
      id, game_type, mode, room_code, player1_id, player2_id, winner_id, result,
      p1_elo_before, p1_elo_after, p2_elo_before, p2_elo_after,
      total_moves, duration_secs, ai_difficulty, move_history, final_state,
      started_at, ended_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, NOW())`,
    [
      matchId, data.gameType, data.mode, data.roomCode || null,
      data.player1Id, data.player2Id, data.winnerId, data.result,
      data.p1EloBefore || null, data.p1EloAfter || null,
      data.p2EloBefore || null, data.p2EloAfter || null,
      data.totalMoves, data.durationSecs, data.aiDifficulty || null,
      JSON.stringify(data.moveHistory), JSON.stringify(data.finalState),
      data.startedAt,
    ]
  );

  return matchId;
}
