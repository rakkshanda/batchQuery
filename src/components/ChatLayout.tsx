import { useEffect, useRef, useState } from 'react';
import MessageList from './MessageList';
import PromptBar from './PromptBar';
import { useChatStore } from '../state/chatStore';
import { validateFiles } from '../lib/validators';

export default function ChatLayout() {
  const { messages, clearChat, mode, setMode, busy, uploads, setUploads } = useChatStore();
  const scrollerRef = useRef<HTMLDivElement>(null);

  const [dark, setDark] = useState(() => {
    if (typeof window === 'undefined') return false;
    try {
      const saved = localStorage.getItem('theme');
      if (saved === 'dark') return true;
      if (saved === 'light') return false;
      // fall back to system preference
      return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    } catch {
      return false;
    }
  });

  const [dragActive, setDragActive] = useState(false);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle('dark', dark);
    try { localStorage.setItem('theme', dark ? 'dark' : 'light'); } catch {}
  }, [dark]);

  // autoscroll to bottom when messages change
  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages]);

  useEffect(() => {
    function onDragEnter(e: DragEvent) {
      e.preventDefault();
      if (e.dataTransfer && e.dataTransfer.items && e.dataTransfer.items.length > 0) {
        setDragActive(true);
      }
    }
    function onDragOver(e: DragEvent) {
      e.preventDefault();
      if (e.dataTransfer) {
        e.dataTransfer.dropEffect = 'copy';
      }
      setDragActive(true);
    }
    function onDragLeave(e: DragEvent) {
      e.preventDefault();
      setDragActive(false);
    }
    function onDrop(e: DragEvent) {
      e.preventDefault();
      setDragActive(false);

      const dt = e.dataTransfer;
      if (!dt) return;

      let dropped: File[] = [];
      if (dt.items && dt.items.length > 0) {
        for (const item of Array.from(dt.items)) {
          if (item.kind === 'file') {
            const f = item.getAsFile();
            if (f) dropped.push(f);
          }
        }
      } else if (dt.files && dt.files.length > 0) {
        dropped = Array.from(dt.files);
      }

      if (dropped.length > 0) {
        const merged = [...uploads, ...dropped].slice(0, 4);
        const { ok, message } = validateFiles(merged);
        if (!ok) {
          console.warn(message);
        } else {
          setUploads(merged);
        }
      }

      try { dt.clearData(); } catch {}
    }

    window.addEventListener('dragenter', onDragEnter);
    window.addEventListener('dragover', onDragOver);
    window.addEventListener('dragleave', onDragLeave);
    window.addEventListener('drop', onDrop);

    return () => {
      window.removeEventListener('dragenter', onDragEnter);
      window.removeEventListener('dragover', onDragOver);
      window.removeEventListener('dragleave', onDragLeave);
      window.removeEventListener('drop', onDrop);
    };
  }, [uploads, setUploads]);

  return (
    <div className="mx-auto max-w-[760px] min-h-screen flex flex-col text-[var(--text)] bg-[var(--bg)]">
      {/* top bar */}
      <header className="sticky top-0 z-10 bg-[var(--surface)]/70 backdrop-blur border-b border-black/10 dark:border-white/10">
        <div className="flex items-center justify-between py-3 px-4">
          <h1 className="font-semibold">Rakshanda's BatchQuery</h1>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-sm">
              <span className="text-[var(--muted)]">Mode</span>
              <select
                value={mode}
                onChange={(e) => setMode(e.target.value as 'mock' | 'live')}
                className="rounded-md border px-2 py-1 text-sm bg-[var(--surface)] text-[var(--text)] border-black/10 dark:border-white/10 hover:bg-black/5 dark:hover:bg-white/10 transition"
                disabled={busy}
              >
                <option value="mock">Test</option>
                <option value="live">Live</option>
              </select>
            </label>
            <button
              onClick={() => setDark((d) => !d)}
              aria-pressed={dark}
              title="Toggle dark mode"
              className="text-sm rounded-md border px-3 py-1 transition bg-[var(--surface)] text-[var(--text)] border-black/10 dark:border-white/10 hover:bg-black/5 dark:hover:bg-white/10"
            >
              Dark Mode: {dark ? 'On' : 'Off'}
            </button>
            <button
              onClick={clearChat}
              className="text-sm rounded-md border px-3 py-1 transition bg-[var(--surface)] text-[var(--text)] border-black/10 dark:border-white/10 hover:bg-black/5 dark:hover:bg-white/10"
              disabled={busy}
            >
              New chat
            </button>
          </div>
        </div>
      </header>

      {/* messages */}
      <div
        ref={scrollerRef}
        className="flex-1 overflow-y-auto px-4 py-4"
        aria-live="polite"
      >
        <div className="bg-[var(--surface)] shadow-sm rounded-2xl p-4">
          <MessageList />
        </div>
      </div>

      {/* composer */}
      <footer className="sticky bottom-0 bg-[var(--bg)]/70 backdrop-blur px-4 pb-4">
        <PromptBar />
      </footer>

      {dragActive && (
        <div className="fixed inset-0 z-50 pointer-events-none">
          <div className="absolute inset-0 bg-black/10 dark:bg-white/5 backdrop-blur-[1px]" />
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-[var(--text)] text-6xl font-light select-none pointer-events-none">+</div>
          </div>
        </div>
      )}
    </div>
  );
}
