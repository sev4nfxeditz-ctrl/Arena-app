-- ============================================
-- Arena Pro — Initial Database Migration
-- Run this against your PostgreSQL database
-- ============================================

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================
-- USERS
-- ============================================
CREATE TABLE IF NOT EXISTS users (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username        VARCHAR(30) UNIQUE NOT NULL,
    email           VARCHAR(255) UNIQUE NOT NULL,
    password_hash   VARCHAR(255),
    avatar_url      VARCHAR(500),
    provider        VARCHAR(20) DEFAULT 'credentials',
    provider_id     VARCHAR(255),
    is_online       BOOLEAN DEFAULT FALSE,
    last_seen       TIMESTAMP DEFAULT NOW(),
    created_at      TIMESTAMP DEFAULT NOW(),
    updated_at      TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- ============================================
-- PLAYER RATINGS (per game)
-- ============================================
CREATE TABLE IF NOT EXISTS player_ratings (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    game_type       VARCHAR(20) NOT NULL,
    elo_rating      INTEGER DEFAULT 1200,
    peak_rating     INTEGER DEFAULT 1200,
    wins            INTEGER DEFAULT 0,
    losses          INTEGER DEFAULT 0,
    draws           INTEGER DEFAULT 0,
    total_games     INTEGER DEFAULT 0,
    win_streak      INTEGER DEFAULT 0,
    best_streak     INTEGER DEFAULT 0,
    rank_tier       VARCHAR(20) DEFAULT 'Bronze',
    created_at      TIMESTAMP DEFAULT NOW(),
    updated_at      TIMESTAMP DEFAULT NOW(),
    UNIQUE(user_id, game_type)
);

CREATE INDEX IF NOT EXISTS idx_ratings_game_elo ON player_ratings(game_type, elo_rating DESC);
CREATE INDEX IF NOT EXISTS idx_ratings_user ON player_ratings(user_id);

-- ============================================
-- MATCHES
-- ============================================
CREATE TABLE IF NOT EXISTS matches (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    game_type       VARCHAR(20) NOT NULL,
    mode            VARCHAR(20) NOT NULL,
    room_code       VARCHAR(10),
    player1_id      UUID REFERENCES users(id),
    player2_id      UUID REFERENCES users(id),
    winner_id       UUID REFERENCES users(id),
    result          VARCHAR(10),
    p1_elo_before   INTEGER,
    p1_elo_after    INTEGER,
    p2_elo_before   INTEGER,
    p2_elo_after    INTEGER,
    total_moves     INTEGER DEFAULT 0,
    duration_secs   INTEGER,
    ai_difficulty   INTEGER,
    move_history    JSONB DEFAULT '[]',
    final_state     JSONB,
    started_at      TIMESTAMP DEFAULT NOW(),
    ended_at        TIMESTAMP,
    created_at      TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_matches_players ON matches(player1_id, player2_id);
CREATE INDEX IF NOT EXISTS idx_matches_game_type ON matches(game_type, created_at DESC);

-- ============================================
-- CHAT MESSAGES
-- ============================================
CREATE TABLE IF NOT EXISTS chat_messages (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    channel         VARCHAR(50) NOT NULL DEFAULT 'global',
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    content         TEXT NOT NULL,
    is_system       BOOLEAN DEFAULT FALSE,
    created_at      TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chat_channel ON chat_messages(channel, created_at DESC);

-- ============================================
-- Done!
-- ============================================
SELECT 'Migration completed successfully!' as status;
