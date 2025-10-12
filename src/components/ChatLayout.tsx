import { useEffect, useRef, useState } from 'react';
import MessageList from './MessageList';
import PromptBar from './PromptBar';
import WelcomeScreen from './WelcomeScreen';
import { useChatStore } from '../state/chatStore';
import { validateFiles } from '../lib/validators';

export default function ChatLayout() {
  const { messages, clearChat, mode, setMode, busy, uploads, setUploads, isTyping } = useChatStore();
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
  const [showWelcome, setShowWelcome] = useState(true);
  const [headerVisible, setHeaderVisible] = useState(false);
  const [showSettingsDropdown, setShowSettingsDropdown] = useState(false);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle('dark', dark);
    try { localStorage.setItem('theme', dark ? 'dark' : 'light'); } catch {}
  }, [dark]);

  // Hide welcome screen when messages are added
  useEffect(() => {
    if (messages.length > 0) {
      setShowWelcome(false);
    }
  }, [messages.length]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (showSettingsDropdown) {
        const target = event.target as Element;
        if (!target.closest('.settings-dropdown')) {
          setShowSettingsDropdown(false);
        }
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showSettingsDropdown]);

  // autoscroll to top when messages change or typing state changes
  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    
    const scrollToTop = () => {
      // Scroll to the very top
      el.scrollTo({ top: 0, behavior: 'smooth' });
    };
    
    // Use requestAnimationFrame to ensure DOM has updated
    requestAnimationFrame(scrollToTop);
    
    // Also try after a short delay to ensure content is rendered
    setTimeout(scrollToTop, 100);
  }, [messages.length, isTyping]);

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
    <>
      {showWelcome ? (
        <WelcomeScreen onStartChat={() => {
          setShowWelcome(false);
          // Clear uploads when transitioning to chat window
          useChatStore.getState().setUploads([]);
        }} />
      ) : (
        <div className="mx-auto max-w-[760px] min-h-screen flex flex-col text-white bg-gray-900">
      {/* top bar */}
      {headerVisible && (
        <header className="sticky top-0 z-10 bg-gray-800/70 backdrop-blur border-b border-gray-700">
          <div className="flex items-center justify-between py-3 px-4">
            <h1 className="font-semibold">Rakshanda's BatchQuery</h1>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setMode(mode === 'live' ? 'mock' : 'live')}
                aria-pressed={mode === 'live'}
                title="Toggle LLM mode"
                className={`text-sm rounded-md border px-3 py-1 transition ${
                  mode === 'live' 
                    ? 'bg-green-500 text-white border-green-500 hover:bg-green-600' 
                    : 'bg-gray-700 text-white border-gray-600 hover:bg-gray-600'
                }`}
                disabled={busy}
              >
                LLM {mode === 'live' ? 'On' : 'Off'}
              </button>
              <button
                onClick={() => setDark((d) => !d)}
                aria-pressed={dark}
                title="Toggle dark mode"
                className="text-sm rounded-md border px-3 py-1 transition bg-gray-700 text-white border-gray-600 hover:bg-gray-600"
              >
                Dark Mode {dark ? 'On' : 'Off'}
              </button>
              <button
                onClick={clearChat}
                className="text-sm rounded-md border px-3 py-1 transition bg-gray-700 text-white border-gray-600 hover:bg-gray-600"
                disabled={busy}
              >
                New chat
              </button>
              <button
                onClick={() => setHeaderVisible(false)}
                className="text-sm rounded-md border px-3 py-1 transition bg-gray-700 text-white border-gray-600 hover:bg-gray-600"
                title="Hide header"
              >
                ✕
              </button>
            </div>
          </div>
        </header>
      )}

      {/* Settings button - always visible */}
      <div className="fixed top-4 right-4 z-20">
        <div className="relative settings-dropdown">
          <button
            onClick={() => setShowSettingsDropdown(!showSettingsDropdown)}
            className="text-sm rounded-md border px-3 py-1 transition bg-gray-700 text-white border-gray-600 hover:bg-gray-600 shadow-lg"
            title="Show settings"
          >
            ⚙️
          </button>
          
          {/* Dropdown menu */}
          {showSettingsDropdown && (
            <div className="absolute top-full right-0 mt-2 w-48 bg-gray-800 border border-gray-700 rounded-lg shadow-lg">
              <div className="py-2">
                <button
                  onClick={() => {
                    setMode(mode === 'live' ? 'mock' : 'live');
                  }}
                  className={`w-full text-left px-4 py-2 text-sm transition flex items-center justify-between ${
                    mode === 'live' 
                      ? 'bg-green-500 text-white' 
                      : 'text-gray-300 hover:bg-gray-700'
                  }`}
                  disabled={busy}
                >
                  <span>LLM</span>
                  <div className={`w-8 h-4 rounded-full transition-colors ${
                    mode === 'live' ? 'bg-white' : 'bg-gray-500'
                  }`}>
                    <div className={`w-3 h-3 rounded-full bg-gray-800 transition-transform ${
                      mode === 'live' ? 'translate-x-4' : 'translate-x-0.5'
                    } mt-0.5`}></div>
                  </div>
                </button>
                
                <button
                  onClick={() => {
                    setDark((d) => !d);
                  }}
                  className="w-full text-left px-4 py-2 text-sm text-gray-300 hover:bg-gray-700 transition flex items-center justify-between"
                >
                  <span>Dark Mode</span>
                  <div className={`w-8 h-4 rounded-full transition-colors ${
                    dark ? 'bg-blue-500' : 'bg-gray-500'
                  }`}>
                    <div className={`w-3 h-3 rounded-full bg-white transition-transform ${
                      dark ? 'translate-x-4' : 'translate-x-0.5'
                    } mt-0.5`}></div>
                  </div>
                </button>
                
                <button
                  onClick={() => {
                    clearChat();
                    setShowSettingsDropdown(false);
                  }}
                  className="w-full text-left px-4 py-2 text-sm text-gray-300 hover:bg-gray-700 transition"
                  disabled={busy}
                >
                  New chat
                </button>
                
                <button
                  onClick={() => {
                    setHeaderVisible(!headerVisible);
                    setShowSettingsDropdown(false);
                  }}
                  className="w-full text-left px-4 py-2 text-sm text-gray-300 hover:bg-gray-700 transition"
                >
                  {headerVisible ? 'Hide header' : 'Show header'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* messages */}
      <div
        ref={scrollerRef}
        data-chat-scroll
        className="flex-1 overflow-y-auto px-4 py-4"
        aria-live="polite"
      >
        <div className="p-4 bg-gray-900">
          <MessageList />
        </div>
      </div>

      {/* composer */}
      <footer className="sticky bottom-0 backdrop-blur px-4 pb-4 bg-gray-900">
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
      )}
    </>
  );
}
