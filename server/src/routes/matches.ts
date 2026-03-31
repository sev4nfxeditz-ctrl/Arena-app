import { Router, Response } from 'express';
import { query } from '../config/database';
import { authMiddleware, AuthRequest, optionalAuth } from '../middleware/auth';
import { asyncHandler } from '../middleware/errorHandler';

const router = Router();

// ---- GET MATCH HISTORY FOR USER ----
router.get('/history', authMiddleware, asyncHandler(async (req: AuthRequest, res: Response) => {
  const userId = req.user!.userId;
  const page = parseInt(req.query.page as string) || 1;
  const limit = Math.min(parseInt(req.query.limit as string) || 20, 50);
  const gameType = req.query.gameType as string;
  const offset = (page - 1) * limit;

  let whereClause = '(m.player1_id = $1 OR m.player2_id = $1)';
  const params: any[] = [userId];

  if (gameType) {
    params.push(gameType);
    whereClause += ` AND m.game_type = $${params.length}`;
  }

  const countResult = await query(
    `SELECT COUNT(*) FROM matches m WHERE ${whereClause} AND m.ended_at IS NOT NULL`,
    params
  );
  const total = parseInt(countResult.rows[0].count);

  const result = await query(
    `SELECT m.id, m.game_type, m.mode, m.result, m.total_moves, m.duration_secs,
            m.p1_elo_before, m.p1_elo_after, m.p2_elo_before, m.p2_elo_after,
            m.started_at, m.ended_at, m.ai_difficulty, m.winner_id,
            m.player1_id, m.player2_id,
            u1.username as player1_name, u1.avatar_url as player1_avatar,
            u2.username as player2_name, u2.avatar_url as player2_avatar
     FROM matches m
     LEFT JOIN users u1 ON m.player1_id = u1.id
     LEFT JOIN users u2 ON m.player2_id = u2.id
     WHERE ${whereClause} AND m.ended_at IS NOT NULL
     ORDER BY m.ended_at DESC
     LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
    [...params, limit, offset]
  );

  res.json({
    success: true,
    data: result.rows,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  });
}));

// ---- GET MATCH DETAIL (for replay) ----
router.get('/:matchId', optionalAuth, asyncHandler(async (req: AuthRequest, res: Response) => {
  const { matchId } = req.params;

  const result = await query(
    `SELECT m.*, u1.username as player1_name, u1.avatar_url as player1_avatar,
            u2.username as player2_name, u2.avatar_url as player2_avatar
     FROM matches m
     LEFT JOIN users u1 ON m.player1_id = u1.id
     LEFT JOIN users u2 ON m.player2_id = u2.id
     WHERE m.id = $1`,
    [matchId]
  );

  if (result.rows.length === 0) {
    return res.status(404).json({ success: false, error: 'Match not found' });
  }

  res.json({ success: true, data: result.rows[0] });
}));

export default router;
