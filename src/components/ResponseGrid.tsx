import { useState } from 'react';
import type { AssistantCard } from '../state/chatStore';
import { useChatStore } from '../state/chatStore';

export default function ResponseGrid({ cards }: { cards: AssistantCard[] }) {
  const [hoveredCard, setHoveredCard] = useState<number | null>(null);
  const { setUploads } = useChatStore();

  const handleAskAboutImage = (card: AssistantCard) => {
    // Convert the preview URL back to a File object
    // This is a simplified approach - in a real app you'd want to store the original file
    fetch(card.previewUrl)
      .then(response => response.blob())
      .then(blob => {
        const file = new File([blob], `image-${Date.now()}.jpg`, { type: 'image/jpeg' });
        setUploads([file]);
      })
      .catch(error => {
        console.error('Error loading image:', error);
      });
  };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {cards.map((c, i) => (
        <div 
          key={i} 
          className={`rounded-xl border border-black/10 p-2 transition-all duration-200 ${
            cards.length > 1 ? 'cursor-pointer' : ''
          } ${
            hoveredCard === i && cards.length > 1 ? 'border-blue-500 shadow-lg transform scale-105' : 'hover:border-gray-300'
          }`}
          onMouseEnter={() => cards.length > 1 && setHoveredCard(i)}
          onMouseLeave={() => cards.length > 1 && setHoveredCard(null)}
        >
          <img
            src={c.previewUrl}
            alt={`response-${i}`}
            className="w-full h-40 object-cover rounded-lg border border-black/10"
          />
          <div className="mt-2 text-xs text-[var(--muted)]">
            {c.status === 'error' && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-50 text-red-700">
                Error
              </span>
            )}
          </div>
          <p className="mt-2 text-sm">{c.text ?? (c.status === 'loading' ? 'Thinking…' : '')}</p>
          
          {/* Ask button - only show on hover and when there are multiple images */}
          {hoveredCard === i && c.status === 'done' && cards.length > 1 && (
            <div className="mt-3 flex justify-center">
              <button
                onClick={() => handleAskAboutImage(c)}
                className="px-4 py-2 bg-blue-500 text-white text-sm rounded-lg hover:bg-blue-600 transition-colors shadow-md"
              >
                Ask
              </button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
