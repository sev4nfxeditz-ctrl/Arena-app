'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { apiRequest } from '@/lib/socket';

interface DashboardData {
  overview: {
    uptime: string;
    onlinePlayers: number;
    activeGames: number;
    totalGamesPlayed: number;
    totalConnections: number;
  };
  performance: {
    httpResponseTime: { avg: number; p50: number; p95: number; p99: number; count: number };
    gameMoveTIme: { avg: number; p50: number; p95: number; p99: number; count: number };
    matchmakingWait: { avg: number; p50: number; p95: number; p99: number; count: number };
    gameDuration: { avg: number; p50: number; p95: number; p99: number; count: number };
  };
  traffic: {
    totalHttpRequests: number;
    httpErrors: number;
    serverErrors: number;
    socketEvents: number;
  };
  games: Record<string, { started: number; completed: number }>;
  errors: { timestamp: number; message: string; category?: string }[];
  timestamp: string;
}

interface HealthData {
  status: string;
  uptime: number;
  checks: Record<string, { status: string; latency?: number }>;
}

function StatCard({ label, value, icon, color = 'cyan' }: { label: string; value: string | number; icon: string; color?: string }) {
  const colorClasses: Record<string, string> = {
    cyan: 'from-arena-cyan/20 to-arena-cyan/5 border-arena-cyan/20 text-arena-cyan',
    green: 'from-arena-green/20 to-arena-green/5 border-arena-green/20 text-arena-green',
    purple: 'from-arena-purple/20 to-arena-purple/5 border-arena-purple/20 text-arena-purple',
    orange: 'from-arena-orange/20 to-arena-orange/5 border-arena-orange/20 text-arena-orange',
    red: 'from-arena-red/20 to-arena-red/5 border-arena-red/20 text-arena-red',
  };

  return (
    <div className={`glass-panel p-5 bg-gradient-to-br ${colorClasses[color]} border transition-all hover:-translate-y-1`}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-2xl">{icon}</span>
      </div>
      <p className="text-2xl font-orbitron font-bold text-white">{value}</p>
      <p className="text-xs text-gray-400 font-rajdhani tracking-wider mt-1">{label}</p>
    </div>
  );
}

function PerformanceRow({ label, stats }: { label: string; stats: { avg: number; p50: number; p95: number; p99: number; count: number } }) {
  const getColor = (val: number, warn: number, crit: number) =>
    val >= crit ? 'text-arena-red' : val >= warn ? 'text-arena-orange' : 'text-arena-green';

  return (
    <tr className="border-b border-gray-800/50 hover:bg-arena-cyan/5 transition-colors">
      <td className="px-4 py-3 font-rajdhani font-semibold text-gray-300">{label}</td>
      <td className={`px-4 py-3 font-orbitron text-sm ${getColor(stats.avg, 200, 500)}`}>{stats.avg}ms</td>
      <td className={`px-4 py-3 font-orbitron text-sm ${getColor(stats.p50, 150, 400)}`}>{stats.p50}ms</td>
      <td className={`px-4 py-3 font-orbitron text-sm ${getColor(stats.p95, 300, 800)}`}>{stats.p95}ms</td>
      <td className={`px-4 py-3 font-orbitron text-sm ${getColor(stats.p99, 500, 1000)}`}>{stats.p99}ms</td>
      <td className="px-4 py-3 text-gray-400 font-rajdhani">{stats.count}</td>
    </tr>
  );
}

export default function MonitoringDashboard() {
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [health, setHealth] = useState<HealthData | null>(null);
  const [loading, setLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);

  const fetchData = async () => {
    try {
      const [dashData, healthData] = await Promise.all([
        apiRequest('/api/monitoring/dashboard'),
        apiRequest('/api/monitoring/health'),
      ]);
      setDashboard(dashData.data);
      setHealth(healthData);
    } catch (err) {
      console.error('Failed to fetch monitoring data:', err);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
    if (autoRefresh) {
      const interval = setInterval(fetchData, 5000);
      return () => clearInterval(interval);
    }
  }, [autoRefresh]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center animate-float">
          <p className="text-5xl mb-4">📊</p>
          <p className="text-gray-400 font-rajdhani">Loading monitoring data...</p>
        </div>
      </div>
    );
  }

  const d = dashboard;
  const h = health;

  return (
    <div className="min-h-screen">
      {/* Navbar */}
      <nav className="sticky top-0 z-50 bg-arena-bg/80 backdrop-blur-xl border-b border-arena-cyan/10">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3">
            <span className="text-2xl">⚡</span>
            <span className="text-xl font-orbitron font-black text-neon tracking-widest">ARENA PRO</span>
          </Link>
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 text-sm font-rajdhani text-gray-400">
              <input
                type="checkbox"
                checked={autoRefresh}
                onChange={(e) => setAutoRefresh(e.target.checked)}
                className="accent-arena-cyan"
              />
              Auto-refresh (5s)
            </label>
            <button onClick={fetchData} className="btn-neon text-sm">🔄 Refresh</button>
            <Link href="/lobby" className="btn-primary text-sm">Play</Link>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-3xl font-orbitron font-black text-neon">📊 MONITORING</h2>
            <p className="text-gray-400 font-rajdhani mt-1">
              Last updated: {d?.timestamp ? new Date(d.timestamp).toLocaleTimeString() : '—'}
            </p>
          </div>

          {/* Health Status */}
          <div className="flex items-center gap-3">
            {h && Object.entries(h.checks).map(([name, check]) => (
              <div key={name} className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-rajdhani font-bold ${
                check.status === 'ok'
                  ? 'border-arena-green/30 bg-arena-green/10 text-arena-green'
                  : 'border-arena-red/30 bg-arena-red/10 text-arena-red'
              }`}>
                <span className={`w-2 h-2 rounded-full ${check.status === 'ok' ? 'bg-arena-green animate-pulse' : 'bg-arena-red'}`} />
                {name} {check.latency ? `(${check.latency}ms)` : ''}
              </div>
            ))}
          </div>
        </div>

        {/* ---- Overview Stats ---- */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
          <StatCard icon="⏱️" label="UPTIME" value={d?.overview?.uptime || '—'} color="cyan" />
          <StatCard icon="👥" label="ONLINE PLAYERS" value={d?.overview?.onlinePlayers || 0} color="green" />
          <StatCard icon="🎮" label="ACTIVE GAMES" value={d?.overview?.activeGames || 0} color="purple" />
          <StatCard icon="🏆" label="GAMES PLAYED" value={d?.overview?.totalGamesPlayed || 0} color="orange" />
          <StatCard icon="🔌" label="TOTAL CONNECTIONS" value={d?.overview?.totalConnections || 0} color="cyan" />
        </div>

        {/* ---- Traffic Stats ---- */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <StatCard icon="📡" label="HTTP REQUESTS" value={d?.traffic?.totalHttpRequests || 0} color="cyan" />
          <StatCard icon="⚠️" label="HTTP ERRORS" value={d?.traffic?.httpErrors || 0} color={d?.traffic?.httpErrors ? 'red' : 'green'} />
          <StatCard icon="💥" label="SERVER ERRORS" value={d?.traffic?.serverErrors || 0} color={d?.traffic?.serverErrors ? 'red' : 'green'} />
          <StatCard icon="🔗" label="SOCKET EVENTS" value={d?.traffic?.socketEvents || 0} color="purple" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* ---- Performance Table ---- */}
          <div className="glass-panel overflow-hidden">
            <div className="px-4 py-3 border-b border-arena-cyan/10">
              <h3 className="font-orbitron font-bold text-sm text-neon tracking-wider">⚡ PERFORMANCE</h3>
            </div>
            <table className="w-full">
              <thead>
                <tr className="bg-arena-cyan/5 border-b border-gray-800/50">
                  <th className="px-4 py-2 text-left text-xs font-orbitron tracking-wider text-gray-500">METRIC</th>
                  <th className="px-4 py-2 text-left text-xs font-orbitron tracking-wider text-gray-500">AVG</th>
                  <th className="px-4 py-2 text-left text-xs font-orbitron tracking-wider text-gray-500">P50</th>
                  <th className="px-4 py-2 text-left text-xs font-orbitron tracking-wider text-gray-500">P95</th>
                  <th className="px-4 py-2 text-left text-xs font-orbitron tracking-wider text-gray-500">P99</th>
                  <th className="px-4 py-2 text-left text-xs font-orbitron tracking-wider text-gray-500">COUNT</th>
                </tr>
              </thead>
              <tbody>
                {d?.performance && (
                  <>
                    <PerformanceRow label="HTTP Response" stats={d.performance.httpResponseTime} />
                    <PerformanceRow label="Move Time" stats={d.performance.gameMoveTIme} />
                    <PerformanceRow label="Matchmaking Wait" stats={d.performance.matchmakingWait} />
                    <PerformanceRow label="Game Duration" stats={d.performance.gameDuration} />
                  </>
                )}
              </tbody>
            </table>
          </div>

          {/* ---- Game Stats ---- */}
          <div className="glass-panel overflow-hidden">
            <div className="px-4 py-3 border-b border-arena-cyan/10">
              <h3 className="font-orbitron font-bold text-sm text-neon tracking-wider">🎮 GAMES</h3>
            </div>
            <div className="p-4 space-y-4">
              {d?.games && Object.entries(d.games).map(([game, stats]) => (
                <div key={game} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">
                      {game === 'chess' ? '♟️' : game === 'checkers' ? '⚫' : '❌'}
                    </span>
                    <span className="font-rajdhani font-bold text-white capitalize">{game}</span>
                  </div>
                  <div className="flex items-center gap-6 text-sm">
                    <div>
                      <span className="text-gray-500 font-rajdhani">Started: </span>
                      <span className="text-arena-cyan font-orbitron">{stats.started}</span>
                    </div>
                    <div>
                      <span className="text-gray-500 font-rajdhani">Completed: </span>
                      <span className="text-arena-green font-orbitron">{stats.completed}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ---- Recent Errors ---- */}
        <div className="glass-panel overflow-hidden">
          <div className="px-4 py-3 border-b border-arena-cyan/10 flex items-center justify-between">
            <h3 className="font-orbitron font-bold text-sm text-neon tracking-wider">🚨 RECENT ERRORS</h3>
            <span className="text-xs text-gray-500 font-rajdhani">{d?.errors?.length || 0} errors</span>
          </div>
          {!d?.errors?.length ? (
            <p className="p-8 text-center text-gray-500 font-rajdhani">
              ✅ No errors recorded — system is healthy
            </p>
          ) : (
            <div className="max-h-64 overflow-y-auto divide-y divide-gray-800/50">
              {d.errors.map((error, i) => (
                <div key={i} className="px-4 py-3 hover:bg-arena-red/5 transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {error.category && (
                        <span className="text-xs px-2 py-0.5 rounded bg-arena-red/20 text-arena-red font-rajdhani font-bold">
                          {error.category}
                        </span>
                      )}
                      <span className="text-sm text-gray-300 font-inter">{error.message}</span>
                    </div>
                    <span className="text-xs text-gray-500 font-rajdhani">
                      {new Date(error.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
