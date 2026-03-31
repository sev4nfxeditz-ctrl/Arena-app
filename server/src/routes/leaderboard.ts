import { Router, Request, Response } from 'express';
import { query } from '../config/database';
import { asyncHandler } from '../middleware/errorHandler';

const router = Router();

// ---- GET LEADERBOARD ----
router.get('/:gameType', asyncHandler(async (req: Request, res: Response) => {
  const { gameType } = req.params;
  const page = parseInt(req.query.page as string) || 1;
  const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
  const offset = (page - 1) * limit;
  const search = req.query.search as string;

  if (!['chess', 'checkers', 'tictactoe'].includes(gameType)) {
    return res.status(400).json({ success: false, error: 'Invalid game type' });
  }

  let whereClause = 'pr.game_type = $1 AND pr.total_games >= 5';
  const params: any[] = [gameType];

  if (search) {
    params.push(`%${search}%`);
    whereClause += ` AND LOWER(u.username) LIKE LOWER($${params.length})`;
  }

  const countResult = await query(
    `SELECT COUNT(*) FROM player_ratings pr JOIN users u ON u.id = pr.user_id WHERE ${whereClause}`,
    params
  );
  const total = parseInt(countResult.rows[0].count);

  const result = await query(
    `SELECT 
        u.id as user_id,
        u.username,
        u.avatar_url,
        pr.game_type,
        pr.elo_rating,
        pr.peak_rating,
        pr.wins,
        pr.losses,
        pr.draws,
        pr.total_games,
        pr.rank_tier,
        pr.win_streak,
        pr.best_streak,
        RANK() OVER (ORDER BY pr.elo_rating DESC) as global_rank,
        ROUND(
          CASE WHEN pr.total_games > 0
          THEN (pr.wins::DECIMAL / pr.total_games) * 100
          ELSE 0 END, 1
        ) as win_rate
     FROM player_ratings pr
     JOIN users u ON u.id = pr.user_id
     WHERE ${whereClause}
     ORDER BY pr.elo_rating DESC
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

// ---- GET TOP PLAYERS (quick summary) ----
router.get('/:gameType/top', asyncHandler(async (req: Request, res: Response) => {
  const { gameType } = req.params;
  const limit = Math.min(parseInt(req.query.limit as string) || 10, 25);

  const result = await query(
    `SELECT u.username, u.avatar_url, pr.elo_rating, pr.rank_tier, pr.wins
     FROM player_ratings pr
     JOIN users u ON u.id = pr.user_id
     WHERE pr.game_type = $1 AND pr.total_games >= 5
     ORDER BY pr.elo_rating DESC
     LIMIT $2`,
    [gameType, limit]
  );

  res.json({ success: true, data: result.rows });
}));

export default router;
