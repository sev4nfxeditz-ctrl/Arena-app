'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuthStore } from '@/store/useAuthStore';
import { useGameStore } from '@/store/useGameStore';
import { connectSocket, getSocket } from '@/lib/socket';
import type { GameType, TimePreset } from '../../../../shared/types';
import { TIME_CONTROLS } from '../../../../shared/constants';

const GAMES = [
  { id: 'chess' as GameType, name: 'Chess', emoji: '♟️', color: 'from-blue-500 to-cyan-500' },
  { id: 'checkers' as GameType, name: 'Checkers', emoji: '⚫', color: 'from-red-500 to-orange-500' },
  { id: 'tictactoe' as GameType, name: 'Tic Tac Toe', emoji: '❌', color: 'from-green-500 to-emerald-500' },
];

const TIME_PRESETS: { preset: TimePreset; icon: string }[] = [
  { preset: 'bullet', icon: '🔥' },
  { preset: 'blitz', icon: '⚡' },
  { preset: 'rapid', icon: '⏱️' },
  { preset: 'casual', icon: '☕' },
];

export default function LobbyPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isAuthenticated, token, user } = useAuthStore();
  const { isSearching, setSearching, aiDifficulty, setAiDifficulty } = useGameStore();

  const [selectedGame, setSelectedGame] = useState<GameType>(
    (searchParams?.get('game') as GameType) || 'chess'
  );
  const [selectedTime, setSelectedTime] = useState<TimePreset>('rapid');
  const [showModal, setShowModal] = useState<'none' | 'matchmaking' | 'private' | 'ai'>('none');
  const [roomCode, setRoomCode] = useState('');
  const [createdCode, setCreatedCode] = useState('');
  const [searchTime, setSearchTime] = useState(0);

  // Connect socket on mount
  useEffect(() => {
    if (isAuthenticated && token) {
      const socket = connectSocket(token);

      socket.on('match_found', (data) => {
        setSearching(false);
        setShowModal('none');
        router.push(`/game/${data.gameType}/${data.roomId}`);
      });

      socket.on('game_start', (data) => {
        router.push(`/game/${selectedGame}/${data.roomId}`);
      });

      socket.on('notification', (data) => {
        if (data.type === 'room_created' && data.data?.roomCode) {
          setCreatedCode(data.data.roomCode);
        }
      });

      socket.on('error', (data) => {
        alert(data.message);
        setSearching(false);
      });

      return () => {
        socket.off('match_found');
        socket.off('game_start');
        socket.off('notification');
        socket.off('error');
      };
    }
  }, [isAuthenticated, token]);

  // Search timer
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isSearching) {
      interval = setInterval(() => setSearchTime(t => t + 1), 1000);
    } else {
      setSearchTime(0);
    }
    return () => clearInterval(interval);
  }, [isSearching]);

  const startQuickMatch = () => {
    if (!isAuthenticated) { router.push('/auth/login'); return; }
    const socket = getSocket();
    if (!socket) return;

    socket.emit('join_queue', { gameType: selectedGame, timeControl: selectedTime });
    setSearching(true, selectedGame);
    setShowModal('matchmaking');
  };

  const cancelSearch = () => {
    const socket = getSocket();
    if (socket) socket.emit('leave_queue');
    setSearching(false);
    setShowModal('none');
  };

  const createPrivateRoom = () => {
    if (!isAuthenticated) { router.push('/auth/login'); return; }
    const socket = getSocket();
    if (!socket) return;

    socket.emit('create_private', { gameType: selectedGame, timeControl: selectedTime });
    setShowModal('private');
  };

  const joinPrivateRoom = () => {
    if (!roomCode.trim()) return;
    const socket = getSocket();
    if (!socket) return;

    socket.emit('join_private', { roomCode: roomCode.toUpperCase() });
  };

  const startAIGame = () => {
    if (!isAuthenticated) { router.push('/auth/login'); return; }
    const socket = getSocket();
    if (!socket) return;

    socket.emit('start_ai_game', { gameType: selectedGame, difficulty: aiDifficulty });
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
            <Link href="/leaderboard" className="text-gray-300 hover:text-arena-cyan transition-colors font-rajdhani font-semibold">
              Leaderboard
            </Link>
            {user && (
              <Link href={`/profile/${user.username}`} className="flex items-center gap-2 text-gray-300 hover:text-arena-cyan transition-colors">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-arena-cyan to-arena-green flex items-center justify-center text-arena-bg font-bold text-sm">
                  {user.username?.charAt(0).toUpperCase()}
                </div>
              </Link>
            )}
          </div>
        </div>
      </nav>

      <div className="max-w-6xl mx-auto px-6 py-12">
        <h2 className="text-4xl font-orbitron font-black text-neon text-center mb-2">GAME LOBBY</h2>
        <p className="text-gray-400 text-center mb-12 font-rajdhani text-lg">Select your game and battle mode</p>

        {/* ---- Game Selector ---- */}
        <div className="flex justify-center gap-4 mb-10">
          {GAMES.map(game => (
            <button
              key={game.id}
              onClick={() => setSelectedGame(game.id)}
              className={`flex items-center gap-3 px-6 py-4 rounded-xl border transition-all duration-300 font-orbitron font-bold ${
                selectedGame === game.id
                  ? `border-arena-cyan/50 bg-arena-cyan/10 text-white shadow-neon-cyan`
                  : 'border-gray-700/50 bg-arena-bg-card text-gray-400 hover:border-gray-600 hover:text-gray-300'
              }`}
            >
              <span className="text-2xl">{game.emoji}</span>
              <span className="hidden sm:inline">{game.name}</span>
            </button>
          ))}
        </div>

        {/* ---- Time Control ---- */}
        <div className="flex justify-center gap-3 mb-12">
          {TIME_PRESETS.map(({ preset, icon }) => {
            const tc = TIME_CONTROLS[preset];
            return (
              <button
                key={preset}
                onClick={() => setSelectedTime(preset)}
                className={`flex flex-col items-center gap-1 px-5 py-3 rounded-lg border transition-all duration-300 ${
                  selectedTime === preset
                    ? 'border-arena-green/50 bg-arena-green/10 text-arena-green'
                    : 'border-gray-700/50 bg-arena-bg-card text-gray-400 hover:border-gray-600'
                }`}
              >
                <span className="text-lg">{icon}</span>
                <span className="text-xs font-orbitron font-bold uppercase">{tc.label}</span>
                <span className="text-[10px] text-gray-500">
                  {tc.totalSeconds ? `${Math.floor(tc.totalSeconds / 60)}min` : '∞'}
                  {tc.incrementSeconds > 0 ? ` +${tc.incrementSeconds}s` : ''}
                </span>
              </button>
            );
          })}
        </div>

        {/* ---- Mode Cards ---- */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto">
          {/* Quick Match */}
          <div className="glass-panel p-8 text-center hover:border-arena-cyan/30 transition-all duration-300 hover:shadow-neon-cyan">
            <div className="text-5xl mb-4">⚔️</div>
            <h3 className="text-xl font-orbitron font-bold text-white mb-2">QUICK MATCH</h3>
            <p className="text-gray-400 font-rajdhani mb-6">Find a random opponent matched to your skill</p>
            <button onClick={startQuickMatch} className="btn-primary w-full">
              FIND MATCH
            </button>
          </div>

          {/* Private Room */}
          <div className="glass-panel p-8 text-center hover:border-arena-purple/30 transition-all duration-300 hover:shadow-neon-purple">
            <div className="text-5xl mb-4">🔗</div>
            <h3 className="text-xl font-orbitron font-bold text-white mb-2">FRIEND MATCH</h3>
            <p className="text-gray-400 font-rajdhani mb-4">Play with friends using a room code</p>
            <div className="space-y-3">
              <button onClick={createPrivateRoom} className="btn-neon-fill w-full">
                CREATE ROOM
              </button>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={roomCode}
                  onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                  className="input-neon text-center text-sm tracking-widest flex-1"
                  placeholder="CODE"
                  maxLength={6}
                />
                <button onClick={joinPrivateRoom} className="btn-neon px-4 text-sm">
                  JOIN
                </button>
              </div>
            </div>
          </div>

          {/* AI Match */}
          <div className="glass-panel p-8 text-center hover:border-arena-green/30 transition-all duration-300 hover:shadow-neon-green">
            <div className="text-5xl mb-4">🤖</div>
            <h3 className="text-xl font-orbitron font-bold text-white mb-2">VS AI</h3>
            <p className="text-gray-400 font-rajdhani mb-4">Practice against AI opponents</p>
            <div className="mb-4">
              <label className="text-gray-400 text-xs font-rajdhani font-semibold tracking-wider">
                DIFFICULTY: <span className="text-arena-cyan">{aiDifficulty}</span>/10
              </label>
              <input
                type="range"
                min={1}
                max={10}
                value={aiDifficulty}
                onChange={(e) => setAiDifficulty(parseInt(e.target.value))}
                className="w-full mt-2 accent-arena-cyan"
              />
              <div className="flex justify-between text-xs text-gray-500 font-rajdhani">
                <span>Easy</span>
                <span>Hard</span>
              </div>
            </div>
            <button onClick={startAIGame} className="btn-primary w-full">
              START GAME
            </button>
          </div>
        </div>
      </div>

      {/* ---- Matchmaking Modal ---- */}
      {showModal === 'matchmaking' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="glass-panel p-10 text-center max-w-sm w-full mx-6 animate-scale-in">
            <div className="text-6xl mb-6 animate-float">⚔️</div>
            <h3 className="text-xl font-orbitron font-bold text-white mb-2">SEARCHING...</h3>
            <p className="text-gray-400 font-rajdhani mb-6">Finding a worthy opponent</p>

            <div className="w-full bg-arena-bg rounded-full h-2 mb-4 overflow-hidden">
              <div className="h-full bg-gradient-to-r from-arena-cyan to-arena-green rounded-full animate-pulse" style={{ width: '60%' }} />
            </div>

            <p className="text-arena-cyan font-orbitron text-2xl mb-8">
              {Math.floor(searchTime / 60)}:{(searchTime % 60).toString().padStart(2, '0')}
            </p>

            <button onClick={cancelSearch} className="btn-danger w-full">
              CANCEL
            </button>
          </div>
        </div>
      )}

      {/* ---- Private Room Modal ---- */}
      {showModal === 'private' && createdCode && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="glass-panel p-10 text-center max-w-sm w-full mx-6 animate-scale-in">
            <div className="text-6xl mb-6">🔗</div>
            <h3 className="text-xl font-orbitron font-bold text-white mb-2">ROOM CREATED</h3>
            <p className="text-gray-400 font-rajdhani mb-6">Share this code with your friend</p>

            <div className="bg-arena-bg border-2 border-arena-cyan/40 rounded-xl p-6 mb-6">
              <p className="text-4xl font-orbitron font-black text-arena-cyan tracking-[0.5em]">
                {createdCode}
              </p>
            </div>

            <p className="text-gray-500 text-sm font-rajdhani mb-6">Waiting for opponent to join...</p>

            <button
              onClick={() => { navigator.clipboard.writeText(createdCode); }}
              className="btn-neon w-full mb-3"
            >
              📋 COPY CODE
            </button>
            <button onClick={() => { setShowModal('none'); setCreatedCode(''); }} className="btn-danger w-full">
              CANCEL
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
