import type { AssistantCard } from '../state/chatStore';

export default function ResponseGrid({ cards }: { cards: AssistantCard[] }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {cards.map((c, i) => (
        <div key={i} className="rounded-xl border border-black/10 p-2">
          <img
            src={c.previewUrl}
            alt={`response-${i}`}
            className="w-full h-40 object-cover rounded-lg border border-black/10"
          />
          <div className="mt-2 text-xs text-[var(--muted)] flex items-center justify-between">
            <span
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full ${
                c.status === 'done'
                  ? 'bg-green-50 text-green-700'
                  : c.status === 'error'
                  ? 'bg-red-50 text-red-700'
                  : 'bg-gray-50 text-gray-700'
              }`}
            >
              {c.status === 'loading' ? 'Analyzing…' : c.status === 'done' ? 'Done' : 'Error'}
            </span>
            {typeof c.elapsedMs === 'number' && <span>{c.elapsedMs} ms</span>}
          </div>
          <p className="mt-2 text-sm">{c.text ?? (c.status === 'loading' ? 'Thinking…' : '')}</p>
        </div>
      ))}
    </div>
  );
}
