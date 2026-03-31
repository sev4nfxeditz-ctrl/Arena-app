'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuthStore } from '@/store/useAuthStore';
import { useGameStore } from '@/store/useGameStore';
import { connectSocket, getSocket } from '@/lib/socket';
import type { GameType, GameMove } from '@shared/types';

// ---- TicTacToe Board Component ----
function TicTacToeBoard({ state, onMove, myId }: { state: any; onMove: (move: any) => void; myId: string }) {
  const isMyTurn = state?.players?.[state?.currentMark] === myId;
  const marks = { X: '✕', O: '○' };

  return (
    <div className="flex flex-col items-center">
      <div className="grid grid-cols-3 gap-3 mb-6">
        {state?.board?.map((cell: string | null, i: number) => (
          <button
            key={i}
            onClick={() => isMyTurn && !cell && !state.winner && onMove({ position: i, to: i })}
            disabled={!isMyTurn || !!cell || !!state.winner}
            className={`w-24 h-24 md:w-28 md:h-28 rounded-xl text-4xl font-bold transition-all duration-200
              ${cell
                ? cell === 'X'
                  ? 'bg-arena-cyan/20 text-arena-cyan border-2 border-arena-cyan/40'
                  : 'bg-arena-pink/20 text-arena-pink border-2 border-arena-pink/40'
                : isMyTurn && !state.winner
                  ? 'bg-arena-bg-card border-2 border-gray-700/50 hover:border-arena-cyan/40 hover:bg-arena-cyan/5 cursor-pointer'
                  : 'bg-arena-bg-card border-2 border-gray-800/30 cursor-not-allowed'
              }
              ${state?.winningLine?.includes(i) ? 'animate-glow-pulse ring-2 ring-arena-green' : ''}
            `}
          >
            {cell ? marks[cell as keyof typeof marks] : ''}
          </button>
        ))}
      </div>

      {state?.winner && (
        <div className="text-center animate-scale-in">
          <p className="text-2xl font-orbitron font-bold text-arena-green">
            {state.winner === myId ? '🎉 YOU WIN!' : '😞 YOU LOSE'}
          </p>
        </div>
      )}
      {!state?.winner && state?.moveCount >= 9 && (
        <p className="text-xl font-orbitron text-arena-orange">🤝 DRAW</p>
      )}
    </div>
  );
}

// ---- Chess Board Placeholder (uses react-chessboard in production) ----
function ChessBoard({ state, onMove, myId }: { state: any; onMove: (move: any) => void; myId: string }) {
  return (
    <div className="glass-panel p-6 text-center">
      <p className="text-gray-400 font-rajdhani mb-4">Chess Board</p>
      <div className="w-[400px] h-[400px] bg-arena-bg-card border border-arena-cyan/20 rounded-xl flex items-center justify-center mx-auto">
        <div className="text-center">
          <p className="text-6xl mb-4">♟️</p>
          <p className="text-gray-400 font-rajdhani">FEN: {state?.fen?.substring(0, 30)}...</p>
          <p className="text-arena-cyan font-orbitron text-sm mt-2">
            Move #{state?.moveCount || 0}
          </p>
        </div>
      </div>
    </div>
  );
}

// ---- Checkers Board Component ----
function CheckersBoard({ state, onMove, myId }: { state: any; onMove: (move: any) => void; myId: string }) {
  const [selected, setSelected] = useState<number | null>(null);
  const isMyTurn = state?.players?.[state?.currentColor] === myId;
  const myColor = state?.players?.red === myId ? 'red' : 'black';

  const handleCellClick = (idx: number) => {
    if (!isMyTurn) return;

    if (selected === null) {
      // Select a piece
      const piece = state.board[idx];
      if (piece && ((myColor === 'red' && (piece === 'r' || piece === 'R')) || (myColor === 'black' && (piece === 'b' || piece === 'B')))) {
        setSelected(idx);
      }
    } else {
      // Move to this cell
      if (state.board[idx] === null) {
        onMove({ from: selected, to: idx });
        setSelected(null);
      } else {
        setSelected(null);
      }
    }
  };

  const renderBoard = () => {
    const cells = [];
    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        const isDark = (row + col) % 2 === 1;
        let boardIdx: number | null = null;

        if (isDark) {
          const isEvenRow = row % 2 === 0;
          boardIdx = row * 4 + (isEvenRow ? Math.floor(col / 2) : Math.floor(col / 2));
        }

        const piece = boardIdx !== null ? state?.board?.[boardIdx] : null;
        const isSelected = boardIdx === selected;
        const isLastMove = boardIdx !== null && (state?.lastMove?.from === boardIdx || state?.lastMove?.to === boardIdx);

        cells.push(
          <div
            key={`${row}-${col}`}
            onClick={() => isDark && boardIdx !== null && handleCellClick(boardIdx)}
            className={`w-12 h-12 md:w-14 md:h-14 flex items-center justify-center transition-all duration-150
              ${isDark ? 'bg-emerald-900/40 cursor-pointer hover:bg-emerald-800/50' : 'bg-amber-100/10'}
              ${isSelected ? 'ring-2 ring-arena-cyan bg-arena-cyan/20' : ''}
              ${isLastMove ? 'bg-arena-green/20' : ''}
            `}
          >
            {piece && (
              <div className={`w-9 h-9 md:w-10 md:h-10 rounded-full flex items-center justify-center text-lg font-bold border-2 transition-transform hover:scale-110
                ${piece === 'r' || piece === 'R'
                  ? 'bg-red-600 border-red-400 text-white'
                  : 'bg-gray-800 border-gray-500 text-white'
                }
                ${piece === 'R' || piece === 'B' ? 'ring-2 ring-arena-gold' : ''}
              `}>
                {piece === 'R' || piece === 'B' ? '♛' : '●'}
              </div>
            )}
          </div>
        );
      }
    }
    return cells;
  };

  return (
    <div className="flex flex-col items-center">
      <div className="grid grid-cols-8 border-2 border-arena-cyan/20 rounded-xl overflow-hidden">
        {renderBoard()}
      </div>
    </div>
  );
}

// ---- Main Game Room Page ----
export default function GameRoomPage() {
  const params = useParams();
  const router = useRouter();
  const { user, token } = useAuthStore();
  const { gameState, players, timers, moveHistory, gameResult, updateGameState, updateTimers, setGameResult, startGame } = useGameStore();

  const gameType = params?.type as GameType;
  const roomId = params?.roomId as string;

  useEffect(() => {
    if (!token) { router.push('/auth/login'); return; }

    const socket = connectSocket(token);

    socket.on('game_start', (data) => {
      startGame(data.roomId, data.state, data.players, data.timeControl);
    });

    socket.on('game_update', (data) => {
      updateGameState(data.state, data.move, data.timers);
    });

    socket.on('timer_update', (data) => {
      updateTimers(data);
    });

    socket.on('game_over', (data) => {
      setGameResult(data);
    });

    socket.on('opponent_disconnected', (data) => {
      // Show notification
    });

    socket.on('draw_offered', (_data) => {
      if (confirm('Opponent offers a draw. Accept?')) {
        socket.emit('accept_draw', { roomId });
      } else {
        socket.emit('decline_draw', { roomId });
      }
    });

    return () => {
      socket.off('game_start');
      socket.off('game_update');
      socket.off('timer_update');
      socket.off('game_over');
      socket.off('opponent_disconnected');
      socket.off('draw_offered');
    };
  }, [token, roomId]);

  const makeMove = useCallback((move: any) => {
    const socket = getSocket();
    if (!socket || !roomId) return;

    socket.emit('make_move', { roomId, move });

    // For AI games, trigger AI response after our move
    if (roomId.includes('ai')) {
      setTimeout(() => {
        socket.emit('ai_move', { roomId, move: { to: '' } as GameMove });
      }, 100);
    }
  }, [roomId]);

  const resign = () => {
    if (confirm('Are you sure you want to resign?')) {
      const socket = getSocket();
      if (socket) socket.emit('resign', { roomId });
    }
  };

  const offerDraw = () => {
    const socket = getSocket();
    if (socket) socket.emit('offer_draw', { roomId });
  };

  const formatTime = (seconds: number) => {
    if (!isFinite(seconds)) return '∞';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const myPlayer = players.find(p => p.userId === user?.id);
  const opponent = players.find(p => p.userId !== user?.id);

  return (
    <div className="min-h-screen">
      {/* Navbar */}
      <nav className="sticky top-0 z-50 bg-arena-bg/80 backdrop-blur-xl border-b border-arena-cyan/10">
        <div className="max-w-7xl mx-auto px-6 py-3 flex items-center justify-between">
          <Link href="/lobby" className="text-gray-400 hover:text-arena-cyan transition-colors font-rajdhani font-semibold">
            ← Back to Lobby
          </Link>
          <span className="font-orbitron font-bold text-neon text-sm tracking-widest uppercase">
            {gameType} MATCH
          </span>
          <div className="w-20" />
        </div>
      </nav>

      <div className="max-w-5xl mx-auto px-6 py-8">
        <div className="flex flex-col lg:flex-row gap-8 items-start">
          {/* ---- Player Cards + Board ---- */}
          <div className="flex-1">
            {/* Opponent Card */}
            <div className="glass-panel p-4 mb-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-arena-red to-arena-orange flex items-center justify-center text-white font-bold">
                  {opponent?.username?.charAt(0)?.toUpperCase() || '?'}
                </div>
                <div>
                  <p className="font-rajdhani font-bold text-white">{opponent?.username || 'Opponent'}</p>
                  <p className="text-xs text-gray-400 font-rajdhani">ELO: {opponent?.eloRating || '?'}</p>
                </div>
              </div>
              {timers && (
                <div className={`font-orbitron text-xl font-bold px-4 py-2 rounded-lg ${
                  timers.player2.isActive ? 'bg-arena-cyan/10 text-arena-cyan animate-pulse' : 'text-gray-500'
                }`}>
                  {formatTime(timers.player2.remaining)}
                </div>
              )}
            </div>

            {/* Game Board */}
            <div className="glass-panel p-8 flex items-center justify-center min-h-[400px]">
              {gameState ? (
                <>
                  {gameType === 'tictactoe' && <TicTacToeBoard state={gameState} onMove={makeMove} myId={user?.id || ''} />}
                  {gameType === 'chess' && <ChessBoard state={gameState} onMove={makeMove} myId={user?.id || ''} />}
                  {gameType === 'checkers' && <CheckersBoard state={gameState} onMove={makeMove} myId={user?.id || ''} />}
                </>
              ) : (
                <div className="text-center animate-float">
                  <p className="text-5xl mb-4">⏳</p>
                  <p className="text-gray-400 font-rajdhani text-lg">Waiting for game to start...</p>
                </div>
              )}
            </div>

            {/* My Card */}
            <div className="glass-panel p-4 mt-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-arena-cyan to-arena-green flex items-center justify-center text-arena-bg font-bold">
                  {user?.username?.charAt(0)?.toUpperCase() || '?'}
                </div>
                <div>
                  <p className="font-rajdhani font-bold text-white">{user?.username || 'You'} <span className="text-arena-cyan text-xs">(you)</span></p>
                  <p className="text-xs text-gray-400 font-rajdhani">ELO: {myPlayer?.eloRating || '?'}</p>
                </div>
              </div>
              {timers && (
                <div className={`font-orbitron text-xl font-bold px-4 py-2 rounded-lg ${
                  timers.player1.isActive ? 'bg-arena-cyan/10 text-arena-cyan animate-pulse' : 'text-gray-500'
                }`}>
                  {formatTime(timers.player1.remaining)}
                </div>
              )}
            </div>
          </div>

          {/* ---- Sidebar: Controls + Move History ---- */}
          <div className="w-full lg:w-72 space-y-4">
            {/* Game Controls */}
            {!gameResult && (
              <div className="glass-panel p-4 space-y-3">
                <h4 className="font-orbitron font-bold text-sm text-gray-400 tracking-wider">CONTROLS</h4>
                <button onClick={offerDraw} className="btn-neon w-full text-sm">🤝 Offer Draw</button>
                <button onClick={resign} className="btn-danger w-full text-sm">🏳️ Resign</button>
              </div>
            )}

            {/* Game Result */}
            {gameResult && (
              <div className="glass-panel p-6 text-center animate-scale-in">
                <p className="text-4xl mb-3">
                  {gameResult.winnerId === user?.id ? '🎉' : gameResult.winnerId === null ? '🤝' : '😞'}
                </p>
                <p className="text-xl font-orbitron font-bold mb-2">
                  {gameResult.winnerId === user?.id ? 'VICTORY!' : gameResult.winnerId === null ? 'DRAW' : 'DEFEAT'}
                </p>
                {gameResult.eloChanges && (
                  <div className="mt-3">
                    <p className={`font-orbitron font-bold text-lg ${
                      (gameResult.eloChanges.player1.change || 0) >= 0 ? 'text-arena-green' : 'text-arena-red'
                    }`}>
                      {(gameResult.eloChanges.player1.change || 0) >= 0 ? '+' : ''}
                      {gameResult.eloChanges.player1.change} ELO
                    </p>
                  </div>
                )}
                <Link href="/lobby" className="btn-primary w-full mt-4 inline-block text-center">
                  PLAY AGAIN
                </Link>
              </div>
            )}

            {/* Move History */}
            <div className="glass-panel p-4">
              <h4 className="font-orbitron font-bold text-sm text-gray-400 tracking-wider mb-3">MOVES</h4>
              <div className="max-h-64 overflow-y-auto space-y-1">
                {moveHistory.length === 0 ? (
                  <p className="text-gray-500 text-sm font-rajdhani">No moves yet</p>
                ) : (
                  moveHistory.map((move, i) => (
                    <div key={i} className="flex items-center gap-2 text-sm font-rajdhani">
                      <span className="text-gray-500 w-6">{i + 1}.</span>
                      <span className="text-gray-300">{move.notation || JSON.stringify(move)}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
