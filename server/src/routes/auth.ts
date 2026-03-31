import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { query } from '../config/database';
import { generateToken, authMiddleware, AuthRequest } from '../middleware/auth';
import { rateLimitMiddleware } from '../middleware/rateLimit';
import { asyncHandler } from '../middleware/errorHandler';
import { ELO_DEFAULTS } from '../../../shared/constants';

const router = Router();

// ---- REGISTER ----
router.post('/register',
  rateLimitMiddleware(5, 60),
  asyncHandler(async (req: Request, res: Response) => {
    const { username, email, password } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({ success: false, error: 'Username, email, and password are required' });
    }

    if (username.length < 3 || username.length > 20) {
      return res.status(400).json({ success: false, error: 'Username must be 3–20 characters' });
    }

    if (!/^[a-zA-Z0-9_]+$/.test(username)) {
      return res.status(400).json({ success: false, error: 'Username can only contain letters, numbers, and underscores' });
    }

    if (password.length < 6) {
      return res.status(400).json({ success: false, error: 'Password must be at least 6 characters' });
    }

    // Check existing user
    const existing = await query(
      'SELECT id FROM users WHERE LOWER(username) = LOWER($1) OR LOWER(email) = LOWER($2)',
      [username, email]
    );
    if (existing.rows.length > 0) {
      return res.status(409).json({ success: false, error: 'Username or email already exists' });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const userId = uuidv4();

    // Create user
    await query(
      `INSERT INTO users (id, username, email, password_hash, provider) VALUES ($1, $2, $3, $4, 'credentials')`,
      [userId, username, email, passwordHash]
    );

    // Initialize ratings for all game types
    const gameTypes = ['chess', 'checkers', 'tictactoe'];
    for (const gameType of gameTypes) {
      await query(
        `INSERT INTO player_ratings (id, user_id, game_type, elo_rating, peak_rating) VALUES ($1, $2, $3, $4, $4)`,
        [uuidv4(), userId, gameType, ELO_DEFAULTS.INITIAL_RATING]
      );
    }

    const token = generateToken({ userId, username, email });

    res.status(201).json({
      success: true,
      data: {
        token,
        user: { id: userId, username, email, avatarUrl: null },
      },
    });
  })
);

// ---- LOGIN ----
router.post('/login',
  rateLimitMiddleware(10, 60),
  asyncHandler(async (req: Request, res: Response) => {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, error: 'Email and password are required' });
    }

    const result = await query(
      'SELECT id, username, email, password_hash, avatar_url FROM users WHERE LOWER(email) = LOWER($1)',
      [email]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ success: false, error: 'Invalid email or password' });
    }

    const user = result.rows[0];

    if (!user.password_hash) {
      return res.status(401).json({ success: false, error: 'This account uses OAuth login. Please sign in with Google or GitHub.' });
    }

    const validPassword = await bcrypt.compare(password, user.password_hash);
    if (!validPassword) {
      return res.status(401).json({ success: false, error: 'Invalid email or password' });
    }

    // Update online status
    await query('UPDATE users SET is_online = TRUE, last_seen = NOW() WHERE id = $1', [user.id]);

    const token = generateToken({
      userId: user.id,
      username: user.username,
      email: user.email,
    });

    res.json({
      success: true,
      data: {
        token,
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          avatarUrl: user.avatar_url,
        },
      },
    });
  })
);

// ---- OAUTH CALLBACK ----
router.post('/oauth',
  rateLimitMiddleware(10, 60),
  asyncHandler(async (req: Request, res: Response) => {
    const { provider, providerId, email, name, avatarUrl } = req.body;

    if (!provider || !providerId || !email) {
      return res.status(400).json({ success: false, error: 'Missing OAuth data' });
    }

    // Check if user exists by provider ID or email
    let result = await query(
      'SELECT id, username, email, avatar_url FROM users WHERE provider = $1 AND provider_id = $2',
      [provider, providerId]
    );

    let user;

    if (result.rows.length === 0) {
      // Check by email
      result = await query('SELECT id, username, email, avatar_url FROM users WHERE LOWER(email) = LOWER($1)', [email]);

      if (result.rows.length > 0) {
        // Link OAuth to existing account
        user = result.rows[0];
        await query('UPDATE users SET provider = $1, provider_id = $2, avatar_url = COALESCE(avatar_url, $3) WHERE id = $4',
          [provider, providerId, avatarUrl, user.id]);
      } else {
        // Create new user
        const userId = uuidv4();
        const username = name?.replace(/[^a-zA-Z0-9_]/g, '').substring(0, 20) || `player_${userId.substring(0, 8)}`;

        // Ensure unique username
        const usernameCheck = await query('SELECT id FROM users WHERE username = $1', [username]);
        const finalUsername = usernameCheck.rows.length > 0 ? `${username}_${Date.now().toString(36)}` : username;

        await query(
          `INSERT INTO users (id, username, email, provider, provider_id, avatar_url) VALUES ($1, $2, $3, $4, $5, $6)`,
          [userId, finalUsername, email, provider, providerId, avatarUrl]
        );

        // Initialize ratings
        const gameTypes = ['chess', 'checkers', 'tictactoe'];
        for (const gameType of gameTypes) {
          await query(
            `INSERT INTO player_ratings (id, user_id, game_type, elo_rating, peak_rating) VALUES ($1, $2, $3, $4, $4)`,
            [uuidv4(), userId, gameType, ELO_DEFAULTS.INITIAL_RATING]
          );
        }

        user = { id: userId, username: finalUsername, email, avatar_url: avatarUrl };
      }
    } else {
      user = result.rows[0];
    }

    await query('UPDATE users SET is_online = TRUE, last_seen = NOW() WHERE id = $1', [user.id]);

    const token = generateToken({
      userId: user.id,
      username: user.username,
      email: user.email,
    });

    res.json({
      success: true,
      data: {
        token,
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          avatarUrl: user.avatar_url,
        },
      },
    });
  })
);

// ---- GET CURRENT USER ----
router.get('/me', authMiddleware, asyncHandler(async (req: AuthRequest, res: Response) => {
  const result = await query(
    'SELECT id, username, email, avatar_url, provider, is_online, created_at FROM users WHERE id = $1',
    [req.user!.userId]
  );

  if (result.rows.length === 0) {
    return res.status(404).json({ success: false, error: 'User not found' });
  }

  const user = result.rows[0];

  // Get ratings
  const ratings = await query(
    'SELECT game_type, elo_rating, peak_rating, wins, losses, draws, total_games, win_streak, best_streak, rank_tier FROM player_ratings WHERE user_id = $1',
    [user.id]
  );

  res.json({
    success: true,
    data: {
      ...user,
      ratings: ratings.rows,
    },
  });
}));

export default router;
