import { create } from 'zustand';
import type { ChatMessage } from '@shared/types';

interface ChatStore {
  messages: Record<string, ChatMessage[]>;
  activeChannel: string;
  isOpen: boolean;

  addMessage: (channel: string, message: ChatMessage) => void;
  setHistory: (channel: string, messages: ChatMessage[]) => void;
  setActiveChannel: (channel: string) => void;
  toggleChat: () => void;
  setOpen: (open: boolean) => void;
}

export const useChatStore = create<ChatStore>((set) => ({
  messages: { global: [] },
  activeChannel: 'global',
  isOpen: false,

  addMessage: (channel, message) => set((state) => ({
    messages: {
      ...state.messages,
      [channel]: [...(state.messages[channel] || []), message].slice(-200), // Keep last 200
    },
  })),

  setHistory: (channel, messages) => set((state) => ({
    messages: { ...state.messages, [channel]: messages },
  })),

  setActiveChannel: (channel) => set({ activeChannel: channel }),

  toggleChat: () => set((state) => ({ isOpen: !state.isOpen })),

  setOpen: (open) => set({ isOpen: open }),
}));
