import { useEffect, useRef } from 'react';
import MessageList from './MessageList';
import PromptBar from './PromptBar';
import { useChatStore } from '../state/chatStore';

export default function ChatLayout() {
  const { messages, clearChat, mode, setMode, busy } = useChatStore();
  const scrollerRef = useRef<HTMLDivElement>(null);

  // autoscroll to bottom when messages change
  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages]);

  return (
    <div className="mx-auto max-w-[760px] min-h-screen flex flex-col">
      {/* top bar */}
      <header className="sticky top-0 z-10 bg-[var(--bg)]/70 backdrop-blur border-b border-black/5">
        <div className="flex items-center justify-between py-3 px-4">
          <h1 className="font-semibold">Rakshand's BatchQuery</h1>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-sm">
              <span className="text-[var(--muted)]">Mode</span>
              <select
                value={mode}
                onChange={(e) => setMode(e.target.value as 'mock' | 'live')}
                className="rounded-md border border-black/10 bg-white px-2 py-1 text-sm"
                disabled={busy}
              >
                <option value="mock">Test</option>
                <option value="live">Live</option>
              </select>
            </label>
            <button
              onClick={clearChat}
              className="text-sm rounded-md border border-black/10 px-3 py-1 hover:bg-black/5 transition"
              disabled={busy}
            >
              Clear
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
    </div>
  );
}
