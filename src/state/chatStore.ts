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
  pendingImages: UploadFile[] | null; // Images waiting for follow-up text
  mode: 'mock' | 'live';
  busy: boolean;
  isTyping: boolean;

  setMode: (m: 'mock' | 'live') => void;
  setUploads: (f: UploadFile[] | ((prev: UploadFile[]) => UploadFile[])) => void;
  removeUpload: (index: number) => void;
  clearUploads: () => void;
  clearChat: () => void;
  setIsTyping: (typing: boolean) => void;
  setPendingImages: (images: UploadFile[] | null) => void;

  sendStart: (prompt: string, files: UploadFile[]) => string;
  addAssistantPlaceholder: (files: UploadFile[]) => string;
  patchAssistantCard: (assistantId: string, cardIndex: number, patch: Partial<AssistantCard>) => void;
  addAssistantText: (text: string) => string;
  removeLastAssistant: () => void;
  replaceLastAssistantText: (text: string) => void;
};

const id = () => Math.random().toString(36).slice(2);

export const useChatStore = create<Store>((set, _get) => ({
  messages: [],
  uploads: [],
  pendingImages: null,
  mode: 'mock',
  busy: false,
  isTyping: false,

  setMode: (m) => set({ mode: m }),
  setUploads: (f) =>
    set((s) => ({
      uploads: typeof f === 'function' ? (f as (prev: UploadFile[]) => UploadFile[])(s.uploads) : f,
    })),
  removeUpload: (index) =>
    set((s) => ({
      uploads: s.uploads.filter((_, i) => i !== index),
    })),
  clearUploads: () => set({ uploads: [] }),
  clearChat: () => set({ messages: [], pendingImages: null }),
  setIsTyping: (typing) => set({ isTyping: typing }),
  setPendingImages: (images) => set({ pendingImages: images }),

  sendStart: (prompt, files) => {
    const userMsg: UserMessage = {
      id: id(),
      role: 'user',
      createdAt: Date.now(),
      text: prompt,
      attachments: files.map((f) => ({ previewUrl: URL.createObjectURL(f) })),
      variant: 'user',
    };
    // Only show typing for text-only messages (no files)
    const showTyping = files.length === 0;
    set((s) => ({ messages: [...s.messages, userMsg], busy: true, isTyping: showTyping }));
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

  addAssistantText: (text: string) => {
    const aMsg: AssistantTextMessage = {
      id: id(),
      role: 'assistant',
      createdAt: Date.now(),
      variant: 'assistant-text',
      text,
    };
    set((s) => ({ messages: [...s.messages, aMsg], busy: false, isTyping: false }));
    
    // Scroll down when response is added
    setTimeout(() => {
      const chatContainer = document.querySelector('[data-chat-scroll]');
      if (chatContainer) {
        chatContainer.scrollTop = chatContainer.scrollHeight;
      }
    }, 100);
    
    return aMsg.id;
  },

  removeLastAssistant: () =>
    set((s) => {
      const msgs = Array.isArray(s.messages) ? (s.messages as Message[]) : ([] as Message[]);
      let idx = -1;
      for (let i = msgs.length - 1; i >= 0; i--) {
        const m = msgs[i];
        if (m.role === 'assistant' && m.variant === 'assistant-text') {
          idx = i;
          break;
        }
      }
      if (idx === -1) return { messages: msgs };
      const next = msgs.slice() as Message[];
      next.splice(idx, 1);
      return { messages: next };
    }),

  replaceLastAssistantText: (text: string) =>
    set((s) => {
      const msgs = Array.isArray(s.messages) ? (s.messages as Message[]) : ([] as Message[]);
      for (let i = msgs.length - 1; i >= 0; i--) {
        const m = msgs[i];
        if (m.role === 'assistant' && m.variant === 'assistant-text') {
          const target = m as AssistantTextMessage;
          const updated: AssistantTextMessage = { ...target, text };
          const next = msgs.slice() as Message[];
          next[i] = updated;
          return { messages: next };
        }
      }
      return { messages: msgs };
    }),
}));
