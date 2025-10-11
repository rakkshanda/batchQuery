import { create } from 'zustand';

export type UploadFile = File;

export type UserMessage = {
  id: string;
  role: 'user';
  createdAt: number;
  text: string;
  attachments: { previewUrl: string }[];
  variant: 'user';
};

export type AssistantCard = {
  previewUrl: string;
  status: 'loading' | 'done' | 'error';
  text?: string;
  elapsedMs?: number;
};

export type AssistantBatchMessage = {
  id: string;
  role: 'assistant';
  createdAt: number;
  variant: 'assistant-batch';
  cards: AssistantCard[];
};

export type AssistantTextMessage = {
  id: string;
  role: 'assistant';
  createdAt: number;
  variant: 'assistant-text';
  text: string;
};

export type Message = UserMessage | AssistantBatchMessage | AssistantTextMessage;

type Store = {
  messages: Message[];
  uploads: UploadFile[];
  mode: 'mock' | 'live';
  busy: boolean;

  setMode: (m: 'mock' | 'live') => void;
  setUploads: (f: UploadFile[]) => void;
  clearChat: () => void;

  sendStart: (prompt: string, files: UploadFile[]) => string;
  addAssistantPlaceholder: (files: UploadFile[]) => string;
  patchAssistantCard: (assistantId: string, cardIndex: number, patch: Partial<AssistantCard>) => void;
};

const id = () => Math.random().toString(36).slice(2);

export const useChatStore = create<Store>((set, get) => ({
  messages: [],
  uploads: [],
  mode: 'mock',
  busy: false,

  setMode: (m) => set({ mode: m }),
  setUploads: (f) => set({ uploads: f }),
  clearChat: () => set({ messages: [] }),

  sendStart: (prompt, files) => {
    const userMsg: UserMessage = {
      id: id(),
      role: 'user',
      createdAt: Date.now(),
      text: prompt,
      attachments: files.map((f) => ({ previewUrl: URL.createObjectURL(f) })),
      variant: 'user',
    };
    set((s) => ({ messages: [...s.messages, userMsg], busy: true }));
    return userMsg.id;
  },

  addAssistantPlaceholder: (files) => {
    const cards: AssistantCard[] = files.map((f) => ({
      previewUrl: URL.createObjectURL(f),
      status: 'loading',
    }));
    const aMsg: AssistantBatchMessage = {
      id: id(),
      role: 'assistant',
      createdAt: Date.now(),
      variant: 'assistant-batch',
      cards,
    };
    set((s) => ({ messages: [...s.messages, aMsg] }));
    return aMsg.id;
  },

  patchAssistantCard: (assistantId, cardIndex, patch) => {
    set((s) => {
      const msgs = s.messages.map((m) => {
        if (m.id !== assistantId || m.variant !== 'assistant-batch') return m;
        const cards = m.cards.map((c, i) => (i === cardIndex ? { ...c, ...patch } : c));
        const allDone = cards.every((c) => c.status !== 'loading');
        return {
          ...m,
          cards,
          ...(allDone ? {} : {}),
        } as AssistantBatchMessage;
      });
      // if all cards resolved, set busy=false
      const assistant = msgs.find((m) => m.id === assistantId) as AssistantBatchMessage | undefined;
      const done = assistant?.cards?.every((c) => c.status !== 'loading');
      return { messages: msgs, busy: done ? false : s.busy };
    });
  },
}));
