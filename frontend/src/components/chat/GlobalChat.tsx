'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useChatStore } from '@/store/useChatStore';
import { useAuthStore } from '@/store/useAuthStore';
import { getSocket } from '@/lib/socket';

const CHANNELS = [
  { id: 'global', name: 'Global', emoji: '🌍' },
  { id: 'chess', name: 'Chess', emoji: '♟️' },
  { id: 'checkers', name: 'Checkers', emoji: '⚫' },
  { id: 'tictactoe', name: 'TTT', emoji: '❌' },
];

export default function GlobalChat() {
  const { messages, activeChannel, isOpen, addMessage, setHistory, setActiveChannel, setOpen, toggleChat } = useChatStore();
  const { user } = useAuthStore();
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    socket.on('chat_message', (msg) => {
      addMessage(msg.channel, msg);
    });

    socket.on('chat_history', (msgs) => {
      if (msgs.length > 0) {
        setHistory(msgs[0].channel, msgs);
      }
    });

    // Join default channel
    socket.emit('join_channel', { channel: activeChannel });

    return () => {
      socket.off('chat_message');
      socket.off('chat_history');
    };
  }, [activeChannel]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages[activeChannel]]);

  const sendMessage = () => {
    if (!input.trim()) return;
    const socket = getSocket();
    if (!socket) return;

    socket.emit('send_message', { channel: activeChannel, content: input.trim() });
    setInput('');
  };

  const switchChannel = (channel: string) => {
    const socket = getSocket();
    if (socket) {
      socket.emit('leave_channel', { channel: activeChannel });
      socket.emit('join_channel', { channel });
    }
    setActiveChannel(channel);
  };

  const channelMessages = messages[activeChannel] || [];

  if (!isOpen) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 z-40 w-14 h-14 rounded-full bg-gradient-to-br from-arena-cyan to-arena-green 
                   flex items-center justify-center text-2xl shadow-neon-cyan hover:scale-110 transition-transform"
      >
        💬
      </button>
    );
  }

  return (
    <div className="fixed bottom-6 right-6 z-40 w-80 md:w-96 animate-slide-up">
      <div className="glass-panel flex flex-col h-[500px]">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-arena-cyan/10">
          <h4 className="font-orbitron font-bold text-sm text-neon tracking-wider">CHAT</h4>
          <button onClick={() => setOpen(false)} className="text-gray-400 hover:text-white transition-colors">
            ✕
          </button>
        </div>

        {/* Channel Tabs */}
        <div className="flex gap-1 px-2 py-2 border-b border-gray-800/50 overflow-x-auto">
          {CHANNELS.map(ch => (
            <button
              key={ch.id}
              onClick={() => switchChannel(ch.id)}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-rajdhani font-bold whitespace-nowrap transition-all ${
                activeChannel === ch.id
                  ? 'bg-arena-cyan/10 text-arena-cyan border border-arena-cyan/30'
                  : 'text-gray-400 hover:text-gray-300 hover:bg-gray-800/50'
              }`}
            >
              {ch.emoji} {ch.name}
            </button>
          ))}
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-3 py-2 space-y-2">
          {channelMessages.length === 0 && (
            <p className="text-gray-500 text-center text-sm font-rajdhani py-8">No messages yet</p>
          )}
          {channelMessages.map((msg) => (
            <div key={msg.id} className={`${msg.isSystem ? 'text-center' : ''}`}>
              {msg.isSystem ? (
                <p className="text-gray-500 text-xs font-rajdhani italic">{msg.content}</p>
              ) : (
                <div className="group">
                  <div className="flex items-baseline gap-2">
                    <span className={`text-xs font-rajdhani font-bold ${msg.userId === user?.id ? 'text-arena-cyan' : 'text-arena-green'}`}>
                      {msg.username}
                    </span>
                    <span className="text-[10px] text-gray-600 opacity-0 group-hover:opacity-100 transition-opacity">
                      {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <p className="text-sm text-gray-300 font-inter leading-snug">{msg.content}</p>
                </div>
              )}
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="px-3 py-3 border-t border-gray-800/50">
          <div className="flex gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
              className="input-neon text-sm py-2 flex-1"
              placeholder="Type a message..."
              maxLength={500}
            />
            <button
              onClick={sendMessage}
              disabled={!input.trim()}
              className="btn-primary px-4 py-2 text-sm disabled:opacity-30"
            >
              Send
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
