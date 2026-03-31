import { Router, Response } from 'express';
import { query } from '../config/database';
import { authMiddleware, AuthRequest, optionalAuth } from '../middleware/auth';
import { asyncHandler } from '../middleware/errorHandler';

const router = Router();

// ---- GET USER PROFILE ----
router.get('/:username', optionalAuth, asyncHandler(async (req: AuthRequest, res: Response) => {
  const { username } = req.params;

  const result = await query(
    `SELECT id, username, email, avatar_url, is_online, last_seen, created_at
     FROM users WHERE LOWER(username) = LOWER($1)`,
    [username]
  );

  if (result.rows.length === 0) {
    return res.status(404).json({ success: false, error: 'User not found' });
  }

  const user = result.rows[0];

  // Only show email to the user themselves
  if (req.user?.userId !== user.id) {
    delete user.email;
  }

  // Get ratings
  const ratings = await query(
    `SELECT game_type, elo_rating, peak_rating, wins, losses, draws, total_games, 
            win_streak, best_streak, rank_tier
     FROM player_ratings WHERE user_id = $1
     ORDER BY game_type`,
    [user.id]
  );

  // Get recent matches
  const matches = await query(
    `SELECT m.id, m.game_type, m.mode, m.result, m.total_moves, m.duration_secs,
            m.p1_elo_before, m.p1_elo_after, m.p2_elo_before, m.p2_elo_after,
            m.started_at, m.ended_at, m.ai_difficulty,
            u1.username as player1_name, u2.username as player2_name,
            m.player1_id, m.player2_id, m.winner_id
     FROM matches m
     LEFT JOIN users u1 ON m.player1_id = u1.id
     LEFT JOIN users u2 ON m.player2_id = u2.id
     WHERE m.player1_id = $1 OR m.player2_id = $1
     ORDER BY m.ended_at DESC NULLS LAST
     LIMIT 20`,
    [user.id]
  );

  res.json({
    success: true,
    data: {
      ...user,
      ratings: ratings.rows,
      recentMatches: matches.rows,
    },
  });
}));

// ---- UPDATE PROFILE ----
router.patch('/me', authMiddleware, asyncHandler(async (req: AuthRequest, res: Response) => {
  const { username, avatarUrl } = req.body;

  if (username) {
    if (username.length < 3 || username.length > 20 || !/^[a-zA-Z0-9_]+$/.test(username)) {
      return res.status(400).json({ success: false, error: 'Invalid username format' });
    }
    const existing = await query(
      'SELECT id FROM users WHERE LOWER(username) = LOWER($1) AND id != $2',
      [username, req.user!.userId]
    );
    if (existing.rows.length > 0) {
      return res.status(409).json({ success: false, error: 'Username already taken' });
    }
  }

  const fields: string[] = [];
  const values: any[] = [];
  let idx = 1;

  if (username) { fields.push(`username = $${idx++}`); values.push(username); }
  if (avatarUrl !== undefined) { fields.push(`avatar_url = $${idx++}`); values.push(avatarUrl); }
  fields.push(`updated_at = NOW()`);

  if (fields.length <= 1) {
    return res.status(400).json({ success: false, error: 'No fields to update' });
  }

  values.push(req.user!.userId);
  await query(`UPDATE users SET ${fields.join(', ')} WHERE id = $${idx}`, values);

  res.json({ success: true, message: 'Profile updated' });
}));

export default router;
