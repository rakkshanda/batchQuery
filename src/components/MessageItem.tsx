import ResponseGrid from './ResponseGrid';
import type { Message } from '../state/chatStore';

export default function MessageItem({ msg }: { msg: Message }) {
  const isUser = msg.role === 'user';
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[85%] rounded-2xl p-3 shadow-soft border border-black/5 ${
          isUser ? 'bg-gray-100' : 'bg-white'
        }`}
      >
        {/* attachments (for user) */}
        {isUser && msg.attachments?.length > 0 && (
          <div className="grid grid-cols-2 gap-2 mb-2">
            {msg.attachments.map((a, i) => (
              <img
                key={i}
                src={a.previewUrl}
                alt={`attachment-${i}`}
                className="w-full h-40 object-cover rounded-xl border border-black/10"
              />
            ))}
          </div>
        )}

        {/* text or responses */}
        {msg.variant === 'assistant-batch' ? (
          <ResponseGrid cards={msg.cards} />
        ) : (
          <p className="whitespace-pre-wrap text-sm leading-relaxed">{msg.text}</p>
        )}

        <div className="mt-2 text-[10px] text-[var(--muted)]">{new Date(msg.createdAt).toLocaleTimeString()}</div>
      </div>
    </div>
  );
}
