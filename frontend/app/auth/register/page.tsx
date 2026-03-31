'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/useAuthStore';
import { apiRequest } from '@/lib/socket';

export default function RegisterPage() {
  const router = useRouter();
  const { login } = useAuthStore();
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password !== confirm) {
      setError('Passwords do not match');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    setLoading(true);

    try {
      const data = await apiRequest('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({ username, email, password }),
      });

      login(data.data.user, data.data.token);
      router.push('/lobby');
    } catch (err: any) {
      setError(err.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-6 py-12">
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[500px] h-[500px] bg-arena-purple/5 rounded-full blur-[100px]" />

      <div className="w-full max-w-md relative">
        <Link href="/" className="flex items-center justify-center gap-3 mb-10">
          <span className="text-4xl">⚡</span>
          <h1 className="text-3xl font-orbitron font-black text-neon tracking-widest">ARENA PRO</h1>
        </Link>

        <div className="glass-panel p-8">
          <h2 className="text-2xl font-orbitron font-bold text-white text-center mb-2">JOIN THE ARENA</h2>
          <p className="text-gray-400 text-center mb-8 font-rajdhani">Create your player account</p>

          {error && (
            <div className="bg-arena-red/10 border border-arena-red/30 text-arena-red px-4 py-3 rounded-lg mb-6 text-sm font-rajdhani">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-gray-400 text-sm font-rajdhani font-semibold mb-2 tracking-wider">USERNAME</label>
              <input
                id="register-username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="input-neon"
                placeholder="ProGamer42"
                required
                minLength={3}
                maxLength={20}
                pattern="[a-zA-Z0-9_]+"
              />
              <p className="text-gray-500 text-xs mt-1 font-rajdhani">3–20 characters, letters, numbers, underscores</p>
            </div>

            <div>
              <label className="block text-gray-400 text-sm font-rajdhani font-semibold mb-2 tracking-wider">EMAIL</label>
              <input
                id="register-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input-neon"
                placeholder="player@arena.pro"
                required
              />
            </div>

            <div>
              <label className="block text-gray-400 text-sm font-rajdhani font-semibold mb-2 tracking-wider">PASSWORD</label>
              <input
                id="register-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input-neon"
                placeholder="••••••••"
                required
                minLength={6}
              />
            </div>

            <div>
              <label className="block text-gray-400 text-sm font-rajdhani font-semibold mb-2 tracking-wider">CONFIRM PASSWORD</label>
              <input
                id="register-confirm"
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className="input-neon"
                placeholder="••••••••"
                required
              />
            </div>

            <button
              id="register-submit"
              type="submit"
              disabled={loading}
              className="btn-primary w-full text-lg py-4 disabled:opacity-50"
            >
              {loading ? '⏳ CREATING...' : '⚡ CREATE ACCOUNT'}
            </button>
          </form>

          <p className="text-center text-gray-400 mt-8 font-rajdhani">
            Already have an account?{' '}
            <Link href="/auth/login" className="text-arena-cyan hover:text-arena-green transition-colors font-semibold">
              Sign In
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
