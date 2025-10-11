import { useChatStore } from '../state/chatStore';
import MessageItem from './MessageItem';

export default function MessageList() {
  const { messages } = useChatStore();
  if (messages.length === 0) {
    return (
      <div className="text-center py-16 text-[var(--muted)]">
        Drop up to 4 product images, ask a single question, and I’ll analyze each image in parallel.
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-4">
      {messages.map((m) => (
        <MessageItem key={m.id} msg={m} />
      ))}
    </div>
  );
}
