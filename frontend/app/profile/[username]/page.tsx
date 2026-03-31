'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { apiRequest } from '@/lib/socket';
import { useAuthStore } from '@/store/useAuthStore';

function RankBadge({ tier }: { tier: string }) {
  const classes: Record<string, string> = {
    Bronze: 'badge-bronze', Silver: 'badge-silver', Gold: 'badge-gold',
    Platinum: 'badge-platinum', Diamond: 'badge-diamond',
  };
  const icons: Record<string, string> = {
    Bronze: '🥉', Silver: '🥈', Gold: '🥇', Platinum: '💎', Diamond: '👑',
  };
  return <span className={classes[tier] || 'badge-bronze'}>{icons[tier] || '🥉'} {tier}</span>;
}

const GAME_EMOJIS: Record<string, string> = { chess: '♟️', checkers: '⚫', tictactoe: '❌' };

export default function ProfilePage() {
  const params = useParams();
  const username = params?.username as string;
  const { user: currentUser } = useAuthStore();
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchProfile();
  }, [username]);

  const fetchProfile = async () => {
    setLoading(true);
    try {
      const data = await apiRequest(`/api/users/${username}`);
      setProfile(data.data);
    } catch {
      setProfile(null);
    }
    setLoading(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center animate-float">
          <p className="text-5xl mb-4">⏳</p>
          <p className="text-gray-400 font-rajdhani">Loading profile...</p>
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-5xl mb-4">😕</p>
          <p className="text-xl font-orbitron text-gray-400">Player not found</p>
          <Link href="/" className="btn-primary mt-6 inline-block">Back to Home</Link>
        </div>
      </div>
    );
  }

  const isOwnProfile = currentUser?.username === username;
  const totalWins = (profile.ratings || []).reduce((sum: number, r: any) => sum + (r.wins || 0), 0);
  const totalGames = (profile.ratings || []).reduce((sum: number, r: any) => sum + (r.total_games || 0), 0);

  return (
    <div className="min-h-screen">
      {/* Navbar */}
      <nav className="sticky top-0 z-50 bg-arena-bg/80 backdrop-blur-xl border-b border-arena-cyan/10">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3">
            <span className="text-2xl">⚡</span>
            <span className="text-xl font-orbitron font-black text-neon tracking-widest">ARENA PRO</span>
          </Link>
          <div className="flex gap-4">
            <Link href="/lobby" className="btn-neon text-sm">Play</Link>
            <Link href="/leaderboard" className="btn-neon text-sm">Leaderboard</Link>
          </div>
        </div>
      </nav>

      <div className="max-w-5xl mx-auto px-6 py-12">
        {/* ---- Profile Header ---- */}
        <div className="glass-panel p-8 mb-8">
          <div className="flex flex-col md:flex-row items-center gap-6">
            {/* Avatar */}
            <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-arena-cyan to-arena-green flex items-center justify-center text-5xl font-orbitron font-black text-arena-bg shadow-neon-cyan">
              {profile.avatar_url ? (
                <img src={profile.avatar_url} alt={profile.username} className="w-full h-full rounded-2xl object-cover" />
              ) : (
                profile.username?.charAt(0).toUpperCase()
              )}
            </div>

            <div className="text-center md:text-left flex-1">
              <h2 className="text-3xl font-orbitron font-black text-white mb-1">{profile.username}</h2>
              <p className="text-gray-400 font-rajdhani">
                {profile.is_online ? (
                  <span className="text-arena-green">● Online</span>
                ) : (
                  <span>Last seen {new Date(profile.last_seen).toLocaleDateString()}</span>
                )}
                {' · '}Joined {new Date(profile.created_at).toLocaleDateString()}
              </p>
            </div>

            {isOwnProfile && (
              <button className="btn-neon text-sm">✏️ Edit Profile</button>
            )}
          </div>

          {/* Summary Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-8">
            <div className="stat-box">
              <p className="stat-value">{totalGames}</p>
              <p className="stat-label">TOTAL GAMES</p>
            </div>
            <div className="stat-box">
              <p className="stat-value">{totalWins}</p>
              <p className="stat-label">TOTAL WINS</p>
            </div>
            <div className="stat-box">
              <p className="stat-value">{totalGames > 0 ? Math.round((totalWins / totalGames) * 100) : 0}%</p>
              <p className="stat-label">WIN RATE</p>
            </div>
            <div className="stat-box">
              <p className="stat-value">{Math.max(...(profile.ratings || []).map((r: any) => r.best_streak || 0), 0)}</p>
              <p className="stat-label">BEST STREAK</p>
            </div>
          </div>
        </div>

        {/* ---- Per-Game Stats ---- */}
        <h3 className="text-2xl font-orbitron font-bold text-neon mb-6">GAME STATS</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          {(profile.ratings || []).map((rating: any) => (
            <div key={rating.game_type} className="glass-panel p-6 hover:border-arena-cyan/20 transition-all">
              <div className="flex items-center gap-3 mb-4">
                <span className="text-3xl">{GAME_EMOJIS[rating.game_type] || '🎮'}</span>
                <div>
                  <h4 className="font-orbitron font-bold text-white capitalize">{rating.game_type}</h4>
                  <RankBadge tier={rating.rank_tier} />
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-gray-400 font-rajdhani text-sm">ELO Rating</span>
                  <span className="font-orbitron font-bold text-arena-cyan">{rating.elo_rating}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400 font-rajdhani text-sm">Peak Rating</span>
                  <span className="font-rajdhani font-bold text-arena-gold">{rating.peak_rating}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400 font-rajdhani text-sm">Record</span>
                  <span className="font-rajdhani">
                    <span className="text-arena-green">{rating.wins}W</span>{' '}
                    <span className="text-arena-red">{rating.losses}L</span>{' '}
                    <span className="text-gray-300">{rating.draws}D</span>
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400 font-rajdhani text-sm">Win Rate</span>
                  <span className="font-rajdhani font-bold text-gray-300">
                    {rating.total_games > 0 ? Math.round((rating.wins / rating.total_games) * 100) : 0}%
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400 font-rajdhani text-sm">Current Streak</span>
                  <span className="font-rajdhani font-bold text-arena-orange">🔥 {rating.win_streak}</span>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* ---- Match History ---- */}
        <h3 className="text-2xl font-orbitron font-bold text-neon mb-6">RECENT MATCHES</h3>
        <div className="glass-panel overflow-hidden">
          {(profile.recentMatches || []).length === 0 ? (
            <p className="p-12 text-center text-gray-500 font-rajdhani">No matches played yet</p>
          ) : (
            <div className="divide-y divide-gray-800/50">
              {(profile.recentMatches || []).map((match: any) => {
                const isP1 = match.player1_id === profile.id;
                const won = match.winner_id === profile.id;
                const isDraw = match.result === 'draw';
                const opponentName = isP1 ? match.player2_name : match.player1_name;
                const eloBefore = isP1 ? match.p1_elo_before : match.p2_elo_before;
                const eloAfter = isP1 ? match.p1_elo_after : match.p2_elo_after;
                const eloChange = eloBefore && eloAfter ? eloAfter - eloBefore : null;

                return (
                  <div key={match.id} className="px-6 py-4 flex items-center gap-4 hover:bg-arena-cyan/5 transition-colors">
                    {/* Result */}
                    <div className={`w-16 text-center font-orbitron font-bold text-sm px-2 py-1 rounded ${
                      isDraw ? 'bg-gray-500/20 text-gray-300' : won ? 'bg-arena-green/20 text-arena-green' : 'bg-arena-red/20 text-arena-red'
                    }`}>
                      {isDraw ? 'DRAW' : won ? 'WIN' : 'LOSS'}
                    </div>

                    {/* Game type */}
                    <span className="text-xl">{GAME_EMOJIS[match.game_type]}</span>

                    {/* Opponent */}
                    <div className="flex-1">
                      <p className="font-rajdhani font-bold text-white">
                        vs {opponentName || 'AI Bot'}
                      </p>
                      <p className="text-xs text-gray-500 font-rajdhani">
                        {match.total_moves} moves · {match.duration_secs ? `${Math.floor(match.duration_secs / 60)}m ${match.duration_secs % 60}s` : '—'}
                      </p>
                    </div>

                    {/* ELO Change */}
                    {eloChange !== null && (
                      <span className={`font-orbitron font-bold text-sm ${eloChange >= 0 ? 'text-arena-green' : 'text-arena-red'}`}>
                        {eloChange >= 0 ? '+' : ''}{eloChange}
                      </span>
                    )}

                    {/* Date */}
                    <span className="text-gray-500 text-xs font-rajdhani">
                      {match.ended_at ? new Date(match.ended_at).toLocaleDateString() : '—'}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
