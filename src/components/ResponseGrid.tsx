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
          className={`rounded-xl border border-black/10 p-2 transition-all duration-200 relative ${
            cards.length > 1 ? 'cursor-pointer' : ''
          } ${
            hoveredCard === i && cards.length > 1 ? 'border-[#089669] shadow-lg transform scale-105' : 'hover:border-gray-300'
          }`}
          onMouseEnter={() => cards.length > 1 && setHoveredCard(i)}
          onMouseLeave={() => cards.length > 1 && setHoveredCard(null)}
        >
          <div className="relative">
            <img
              src={c.previewUrl}
              alt={`response-${i}`}
              className="w-full h-24 object-cover rounded-lg border border-black/10"
            />
            
            {/* Floating Ask button - only show on hover and when there are multiple images */}
            {hoveredCard === i && c.status === 'done' && cards.length > 1 && (
              <button
                onClick={() => handleAskAboutImage(c)}
                className="absolute top-2 right-2 w-8 h-8 text-white rounded-full flex items-center justify-center hover:opacity-90 transition-colors shadow-lg"
                style={{ backgroundColor: '#089669' }}
                title="Ask about this image"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={1.5}
                  stroke="currentColor"
                  className="w-4 h-4"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
                </svg>
              </button>
            )}
          </div>
          
          <div className="mt-2 text-xs text-[var(--muted)]">
            {c.status === 'error' && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-50 text-red-700">
                Error
              </span>
            )}
          </div>
          <p className="mt-2 text-sm">{c.text ?? (c.status === 'loading' ? 'Thinking…' : '')}</p>
        </div>
      ))}
    </div>
  );
}
