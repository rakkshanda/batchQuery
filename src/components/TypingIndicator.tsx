export default function TypingIndicator() {
  return (
    <div className="flex justify-start">
      <div className="bg-[var(--surface)] text-[var(--text)] rounded-2xl p-3 shadow-soft border border-black/10 dark:border-white/10">
        <div className="flex items-center space-x-1">
          <span className="text-sm text-[var(--muted)]">Thinking</span>
          <div className="flex space-x-1">
            <div className="w-2 h-2 bg-blue-300 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
            <div className="w-2 h-2 bg-blue-300 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
            <div className="w-2 h-2 bg-blue-300 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
          </div>
          <div className="ml-1">
            <div className="w-0.5 h-4 bg-blue-300 cursor-flicker"></div>
          </div>
        </div>
      </div>
    </div>
  );
}
