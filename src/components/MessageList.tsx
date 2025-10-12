import { useChatStore } from '../state/chatStore';
import MessageItem from './MessageItem';
import TypingIndicator from './TypingIndicator';

export default function MessageList() {
  const { messages, isTyping } = useChatStore();
  if (messages.length === 0) {
    return (
      <div className="text-center py-16 text-[var(--muted)]">
       Hi, I am your virtual assistant, let me know if you need help with anything! 
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-4 bg-[var(--background)] text-[var(--foreground)]">
      {messages.map((m) => (
        <MessageItem key={m.id} msg={m} />
      ))}
      {isTyping && <TypingIndicator />}
    </div>
  );
}
