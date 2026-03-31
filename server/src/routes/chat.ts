import { Router, Response } from 'express';
import { query } from '../config/database';
import { optionalAuth, AuthRequest } from '../middleware/auth';
import { asyncHandler } from '../middleware/errorHandler';

const router = Router();

// ---- GET CHAT HISTORY ----
router.get('/:channel', optionalAuth, asyncHandler(async (req: AuthRequest, res: Response) => {
  const { channel } = req.params;
  const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
  const before = req.query.before as string;

  let whereClause = 'cm.channel = $1';
  const params: any[] = [channel];

  if (before) {
    params.push(before);
    whereClause += ` AND cm.created_at < $${params.length}`;
  }

  const result = await query(
    `SELECT cm.id, cm.channel, cm.user_id, u.username, u.avatar_url,
            cm.content, cm.is_system, cm.created_at
     FROM chat_messages cm
     JOIN users u ON u.id = cm.user_id
     WHERE ${whereClause}
     ORDER BY cm.created_at DESC
     LIMIT $${params.length + 1}`,
    [...params, limit]
  );

  res.json({
    success: true,
    data: result.rows.reverse(), // Return in chronological order
  });
}));

export default router;
