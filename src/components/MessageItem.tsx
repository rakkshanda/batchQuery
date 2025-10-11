import React, { useState } from 'react';
import ResponseGrid from './ResponseGrid';
import type { Message } from '../state/chatStore';
import { ClipboardIcon, PencilSquareIcon } from '@heroicons/react/24/outline';

const hasText = (m: Message): m is Message & { text: string } =>
  typeof (m as any)?.text === 'string';

export default function MessageItem({ msg }: { msg: Message }) {
  const isUser = msg.role === 'user';
  const [copied, setCopied] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const messageText = hasText(msg) ? msg.text : '';
  const [editText, setEditText] = useState(messageText);
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`relative group max-w-[85%] rounded-2xl p-3 shadow-soft border border-black/10 dark:border-white/10 ${
          isUser
            ? 'bg-[var(--surface)] text-[var(--text)]'
            : 'bg-[var(--surface)] text-[var(--text)]'
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
                className="w-full h-40 object-cover rounded-xl border border-black/10 dark:border-white/10"
              />
            ))}
          </div>
        )}

        {/* text or responses */}
        {isEditing ? (
          <div className="flex flex-col space-y-2">
            <textarea
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              className="w-full text-sm leading-relaxed rounded-md border border-gray-300 dark:border-gray-700 bg-[var(--surface)] text-[var(--text)] p-2 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
              rows={3}
            />
            <div className="flex justify-end space-x-2">
              <button
                onClick={() => setIsEditing(false)}
                className="text-xs px-2 py-1 rounded-md bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-gray-600"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  console.log('Saved edited text:', editText);
                  setIsEditing(false);
                }}
                className="text-xs px-2 py-1 rounded-md bg-blue-500 text-white hover:bg-blue-600"
              >
                Save
              </button>
            </div>
          </div>
        ) : msg.variant === 'assistant-batch' ? (
          <ResponseGrid cards={msg.cards} />
        ) : (
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-[var(--text)]">{messageText}</p>
        )}

        {isUser && !isEditing && (
          <div className="absolute -bottom-5 right-0 hidden group-hover:flex space-x-2">
            <button
              onClick={() => {
                navigator.clipboard.writeText(messageText || '');
                setCopied(true);
                setTimeout(() => setCopied(false), 1500);
              }}
              className="p-1 bg-white/80 dark:bg-gray-700/80 rounded-md border border-gray-300 dark:border-gray-600 hover:bg-gray-200 dark:hover:bg-gray-600 transition"
              title={copied ? 'Copied!' : 'Copy'}
            >
              {copied ? (
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={1.5}
                  stroke="currentColor"
                  className="w-4 h-4 text-green-500"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                </svg>
              ) : (
                <ClipboardIcon className="w-4 h-4 text-gray-600 dark:text-gray-300" />
              )}
            </button>
            <button
              onClick={() => setIsEditing(true)}
              className="p-1 bg-white/80 dark:bg-gray-700/80 rounded-md border border-gray-300 dark:border-gray-600 hover:bg-gray-200 dark:hover:bg-gray-600 transition"
              title="Edit"
            >
              <PencilSquareIcon className="w-4 h-4 text-gray-600 dark:text-gray-300" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
