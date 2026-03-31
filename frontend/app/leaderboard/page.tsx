'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { apiRequest } from '@/lib/socket';
import type { GameType } from '@shared/types';
import { RANK_TIERS, getRankForElo } from '@shared/constants';

const GAMES: { id: GameType; name: string; emoji: string }[] = [
  { id: 'chess', name: 'Chess', emoji: '♟️' },
  { id: 'checkers', name: 'Checkers', emoji: '⚫' },
  { id: 'tictactoe', name: 'Tic Tac Toe', emoji: '❌' },
];

function RankBadge({ tier }: { tier: string }) {
  const classes: Record<string, string> = {
    Bronze: 'badge-bronze',
    Silver: 'badge-silver',
    Gold: 'badge-gold',
    Platinum: 'badge-platinum',
    Diamond: 'badge-diamond',
  };
  const icons: Record<string, string> = {
    Bronze: '🥉', Silver: '🥈', Gold: '🥇', Platinum: '💎', Diamond: '👑',
  };

  return (
    <span className={classes[tier] || 'badge-bronze'}>
      {icons[tier] || '🥉'} {tier}
    </span>
  );
}

export default function LeaderboardPage() {
  const [selectedGame, setSelectedGame] = useState<GameType>('chess');
  const [entries, setEntries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    fetchLeaderboard();
  }, [selectedGame, page, search]);

  const fetchLeaderboard = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: page.toString(), limit: '25' });
      if (search) params.set('search', search);
      const data = await apiRequest(`/api/leaderboard/${selectedGame}?${params}`);
      setEntries(data.data || []);
      setTotal(data.total || 0);
    } catch {
      setEntries([]);
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen">
      {/* Navbar */}
      <nav className="sticky top-0 z-50 bg-arena-bg/80 backdrop-blur-xl border-b border-arena-cyan/10">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3">
            <span className="text-2xl">⚡</span>
            <span className="text-xl font-orbitron font-black text-neon tracking-widest">ARENA PRO</span>
          </Link>
          <div className="flex items-center gap-6">
            <Link href="/lobby" className="btn-primary text-sm">PLAY</Link>
          </div>
        </div>
      </nav>

      <div className="max-w-5xl mx-auto px-6 py-12">
        <h2 className="text-4xl font-orbitron font-black text-neon text-center mb-2">🏆 LEADERBOARD</h2>
        <p className="text-gray-400 text-center mb-10 font-rajdhani text-lg">Top players ranked by ELO rating</p>

        {/* Game Tabs */}
        <div className="flex justify-center gap-3 mb-8">
          {GAMES.map(game => (
            <button
              key={game.id}
              onClick={() => { setSelectedGame(game.id); setPage(1); }}
              className={`flex items-center gap-2 px-5 py-3 rounded-xl border transition-all duration-300 font-orbitron font-bold text-sm ${
                selectedGame === game.id
                  ? 'border-arena-cyan/50 bg-arena-cyan/10 text-white'
                  : 'border-gray-700/50 bg-arena-bg-card text-gray-400 hover:border-gray-600'
              }`}
            >
              <span>{game.emoji}</span> {game.name}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="max-w-sm mx-auto mb-8">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input-neon text-center"
            placeholder="🔍 Search player..."
          />
        </div>

        {/* Table */}
        <div className="glass-panel overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-arena-cyan/5 border-b border-arena-cyan/10">
                  <th className="px-4 py-4 text-left text-xs font-orbitron tracking-wider text-gray-400">#</th>
                  <th className="px-4 py-4 text-left text-xs font-orbitron tracking-wider text-gray-400">PLAYER</th>
                  <th className="px-4 py-4 text-center text-xs font-orbitron tracking-wider text-gray-400">RANK</th>
                  <th className="px-4 py-4 text-center text-xs font-orbitron tracking-wider text-gray-400">ELO</th>
                  <th className="px-4 py-4 text-center text-xs font-orbitron tracking-wider text-gray-400">W/L/D</th>
                  <th className="px-4 py-4 text-center text-xs font-orbitron tracking-wider text-gray-400">WIN%</th>
                  <th className="px-4 py-4 text-center text-xs font-orbitron tracking-wider text-gray-400">STREAK</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={7} className="px-4 py-20 text-center text-gray-500 font-rajdhani">Loading...</td></tr>
                ) : entries.length === 0 ? (
                  <tr><td colSpan={7} className="px-4 py-20 text-center text-gray-500 font-rajdhani">No players found. Play some games to appear here!</td></tr>
                ) : (
                  entries.map((entry, i) => {
                    const rank = (page - 1) * 25 + i + 1;
                    const rankColors = ['text-arena-gold', 'text-gray-300', 'text-arena-bronze'];
                    return (
                      <tr key={entry.user_id} className="border-b border-gray-800/50 hover:bg-arena-cyan/5 transition-colors">
                        <td className="px-4 py-4">
                          <span className={`font-orbitron font-bold text-lg ${rankColors[rank - 1] || 'text-gray-400'}`}>
                            {rank <= 3 ? ['🥇', '🥈', '🥉'][rank - 1] : rank}
                          </span>
                        </td>
                        <td className="px-4 py-4">
                          <Link href={`/profile/${entry.username}`} className="flex items-center gap-3 hover:text-arena-cyan transition-colors">
                            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-arena-cyan to-arena-green flex items-center justify-center text-arena-bg font-bold text-xs">
                              {entry.username?.charAt(0)?.toUpperCase()}
                            </div>
                            <span className="font-rajdhani font-bold">{entry.username}</span>
                          </Link>
                        </td>
                        <td className="px-4 py-4 text-center">
                          <RankBadge tier={entry.rank_tier} />
                        </td>
                        <td className="px-4 py-4 text-center">
                          <span className="font-orbitron font-bold text-arena-cyan">{entry.elo_rating}</span>
                        </td>
                        <td className="px-4 py-4 text-center font-rajdhani">
                          <span className="text-arena-green">{entry.wins}</span>
                          <span className="text-gray-500">/</span>
                          <span className="text-arena-red">{entry.losses}</span>
                          <span className="text-gray-500">/</span>
                          <span className="text-gray-300">{entry.draws}</span>
                        </td>
                        <td className="px-4 py-4 text-center font-rajdhani font-bold text-gray-300">
                          {entry.win_rate}%
                        </td>
                        <td className="px-4 py-4 text-center">
                          {entry.win_streak > 0 && (
                            <span className="text-arena-orange font-rajdhani font-bold">🔥 {entry.win_streak}</span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {total > 25 && (
            <div className="flex justify-center gap-2 py-4 border-t border-gray-800/50">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="btn-neon text-xs px-3 py-2 disabled:opacity-30"
              >
                ← Prev
              </button>
              <span className="flex items-center px-4 text-gray-400 font-rajdhani text-sm">
                Page {page} of {Math.ceil(total / 25)}
              </span>
              <button
                onClick={() => setPage(p => p + 1)}
                disabled={page * 25 >= total}
                className="btn-neon text-xs px-3 py-2 disabled:opacity-30"
              >
                Next →
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
