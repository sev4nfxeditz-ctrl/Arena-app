'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useAuthStore } from '@/store/useAuthStore';

const GAME_CARDS = [
  {
    id: 'chess',
    name: 'Chess',
    emoji: '♟️',
    description: 'The ultimate strategy game. Checkmate your opponent in this timeless battle of wits.',
    gradient: 'from-blue-500/20 to-cyan-500/20',
    border: 'border-blue-500/20 hover:border-blue-400/40',
    glow: 'hover:shadow-[0_0_30px_rgba(59,130,246,0.3)]',
    players: '2,847',
  },
  {
    id: 'checkers',
    name: 'Checkers',
    emoji: '⚫',
    description: 'Jump, capture, and king your way to victory. Strategic simplicity at its finest.',
    gradient: 'from-red-500/20 to-orange-500/20',
    border: 'border-red-500/20 hover:border-red-400/40',
    glow: 'hover:shadow-[0_0_30px_rgba(239,68,68,0.3)]',
    players: '1,203',
  },
  {
    id: 'tictactoe',
    name: 'Tic Tac Toe',
    emoji: '❌',
    description: 'Three in a row wins! Quick matches, instant fun. Perfect for warming up.',
    gradient: 'from-green-500/20 to-emerald-500/20',
    border: 'border-green-500/20 hover:border-green-400/40',
    glow: 'hover:shadow-[0_0_30px_rgba(34,197,94,0.3)]',
    players: '968',
  },
];

const FEATURES = [
  { icon: '⚡', title: 'Real-Time Multiplayer', desc: 'Play against real opponents with WebSocket-powered instant moves' },
  { icon: '🤖', title: 'AI Opponents', desc: 'Challenge AI bots from Easy to Grandmaster with adjustable difficulty' },
  { icon: '🏆', title: 'Ranked Matches', desc: 'Climb the ELO ladder from Bronze to Diamond with competitive rankings' },
  { icon: '💬', title: 'Global Chat', desc: 'Chat with players worldwide in our real-time lobby' },
  { icon: '📊', title: 'Leaderboards', desc: 'Track your stats, win streaks, and compete for the top spots' },
  { icon: '🔗', title: 'Play with Friends', desc: 'Create private rooms with invite codes for friendly matches' },
];

export default function HomePage() {
  const { isAuthenticated, user } = useAuthStore();

  return (
    <div className="min-h-screen">
      {/* ---- Navbar ---- */}
      <nav className="sticky top-0 z-50 bg-arena-bg/80 backdrop-blur-xl border-b border-arena-cyan/10">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3">
            <span className="text-3xl">⚡</span>
            <h1 className="text-2xl font-orbitron font-black text-neon tracking-widest">
              ARENA PRO
            </h1>
          </Link>

          <div className="hidden md:flex items-center gap-8">
            <Link href="/lobby" className="text-gray-300 hover:text-arena-cyan transition-colors font-rajdhani font-semibold text-lg tracking-wide">
              Play
            </Link>
            <Link href="/leaderboard" className="text-gray-300 hover:text-arena-cyan transition-colors font-rajdhani font-semibold text-lg tracking-wide">
              Leaderboard
            </Link>
          </div>

          <div className="flex items-center gap-4">
            {isAuthenticated ? (
              <>
                <Link href={`/profile/${user?.username}`} className="flex items-center gap-2 text-gray-300 hover:text-arena-cyan transition-colors">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-arena-cyan to-arena-green flex items-center justify-center text-arena-bg font-bold text-sm">
                    {user?.username?.charAt(0).toUpperCase()}
                  </div>
                  <span className="font-rajdhani font-semibold hidden sm:block">{user?.username}</span>
                </Link>
                <Link href="/lobby" className="btn-primary text-sm">
                  PLAY NOW
                </Link>
              </>
            ) : (
              <>
                <Link href="/auth/login" className="btn-neon text-sm">
                  LOGIN
                </Link>
                <Link href="/auth/register" className="btn-primary text-sm">
                  SIGN UP
                </Link>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* ---- Hero Section ---- */}
      <section className="relative py-20 md:py-32 px-6 overflow-hidden">
        {/* Radial glow */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-arena-cyan/5 rounded-full blur-[120px]" />

        <div className="max-w-5xl mx-auto text-center relative">
          <div className="animate-fade-in">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-arena-cyan/10 border border-arena-cyan/20 text-arena-cyan text-sm font-rajdhani mb-8">
              <span className="w-2 h-2 bg-arena-green rounded-full animate-pulse" />
              LIVE — Players Online Now
            </div>

            <h2 className="text-5xl md:text-7xl font-orbitron font-black mb-6 leading-tight">
              <span className="text-neon">PLAY. COMPETE.</span>
              <br />
              <span className="text-white">DOMINATE.</span>
            </h2>

            <p className="text-lg md:text-xl text-gray-400 max-w-2xl mx-auto mb-10 font-rajdhani leading-relaxed">
              The ultimate online gaming arena. Play Chess, Checkers, and Tic Tac Toe
              against real opponents or AI. Climb the ranks. Become a legend.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link href="/lobby" className="btn-primary text-lg px-10 py-4 font-orbitron">
                ⚡ ENTER THE ARENA
              </Link>
              <Link href="/leaderboard" className="btn-neon text-lg px-10 py-4">
                🏆 LEADERBOARD
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ---- Game Cards ---- */}
      <section className="py-20 px-6">
        <div className="max-w-6xl mx-auto">
          <h3 className="text-3xl font-orbitron font-bold text-center mb-4 text-neon">
            CHOOSE YOUR GAME
          </h3>
          <p className="text-gray-400 text-center mb-12 font-rajdhani text-lg">
            Each game features ranked matchmaking, AI opponents, and private rooms
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {GAME_CARDS.map((game, i) => (
              <Link href={`/lobby?game=${game.id}`} key={game.id}>
                <div className={`card-game bg-gradient-to-br ${game.gradient} ${game.border} ${game.glow} animate-slide-up`}
                     style={{ animationDelay: `${i * 150}ms`, animationFillMode: 'both' }}>
                  <div className="text-6xl mb-4">{game.emoji}</div>
                  <h4 className="text-2xl font-orbitron font-bold mb-2 text-white">{game.name}</h4>
                  <p className="text-gray-400 font-rajdhani mb-6 leading-relaxed">{game.description}</p>
                  <div className="flex items-center justify-between">
                    <span className="text-arena-green text-sm font-rajdhani font-semibold">
                      <span className="w-2 h-2 bg-arena-green rounded-full inline-block mr-2 animate-pulse" />
                      {game.players} playing
                    </span>
                    <span className="text-arena-cyan text-sm font-orbitron">PLAY →</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ---- Features Grid ---- */}
      <section className="py-20 px-6 bg-arena-bg-light/30">
        <div className="max-w-6xl mx-auto">
          <h3 className="text-3xl font-orbitron font-bold text-center mb-12 text-neon">
            PLATFORM FEATURES
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {FEATURES.map((feature, i) => (
              <div key={i} className="glass-panel p-6 animate-slide-up"
                   style={{ animationDelay: `${i * 100}ms`, animationFillMode: 'both' }}>
                <div className="text-4xl mb-3">{feature.icon}</div>
                <h4 className="text-lg font-orbitron font-bold text-white mb-2">{feature.title}</h4>
                <p className="text-gray-400 font-rajdhani">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---- Footer ---- */}
      <footer className="py-10 px-6 border-t border-arena-cyan/10">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="text-xl">⚡</span>
            <span className="font-orbitron font-bold text-neon">ARENA PRO</span>
          </div>
          <p className="text-gray-500 font-rajdhani text-sm">
            © 2024 Arena Pro. Built for competitive gamers.
          </p>
          <div className="flex items-center gap-6">
            <Link href="/leaderboard" className="text-gray-400 hover:text-arena-cyan transition-colors text-sm font-rajdhani">
              Leaderboard
            </Link>
            <Link href="/lobby" className="text-gray-400 hover:text-arena-cyan transition-colors text-sm font-rajdhani">
              Play
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
