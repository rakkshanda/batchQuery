import { useRef, useState } from 'react';
import { useChatStore } from '../state/chatStore';
import { validateFiles, validatePrompt } from '../lib/validators';
import { analyzeBatch } from '../lib/api';

export default function PromptBar() {
  const { uploads, setUploads, sendStart, addAssistantPlaceholder, patchAssistantCard, busy, mode } =
    useChatStore();
  const [prompt, setPrompt] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const onPickFiles = () => fileInputRef.current?.click();

  const onFilesChosen = (files: FileList | null) => {
    if (!files) return;
    const selected = Array.from(files);
    const merged = [...uploads, ...selected].slice(0, 4); // cap at 4
    const { ok, message } = validateFiles(merged);
    if (!ok) return alert(message);
    setUploads(merged);
  };

  const removeUpload = (idx: number) => {
    const copy = uploads.slice();
    copy.splice(idx, 1);
    setUploads(copy);
  };

  const onSend = async () => {
    const vp = validatePrompt(prompt);
    const vf = validateFiles(uploads);
    if (!vp.ok) return alert(vp.message);
    if (!vf.ok) return alert(vf.message);

    const userId = sendStart(prompt, uploads); // creates user message
    const assistantId = addAssistantPlaceholder(uploads); // empty cards

    // kick off per-image analysis
    const startedAt = performance.now();
    const runners = uploads.map((file, i) =>
      analyzeBatch(prompt, [file], mode)
        .then((res) => {
          const elapsed = Math.round(performance.now() - startedAt);
          const text = res[0]?.answer ?? 'No answer';
          patchAssistantCard(assistantId, i, { status: 'done', text, elapsedMs: elapsed });
        })
        .catch((err) => {
          const elapsed = Math.round(performance.now() - startedAt);
          patchAssistantCard(assistantId, i, { status: 'error', text: String(err?.message || err), elapsedMs: elapsed });
        }),
    );

    await Promise.allSettled(runners);
    setPrompt('');
    setUploads([]);
  };

  return (
    <div className="rounded-2xl bg-white shadow-soft p-2 border border-black/5">
      {/* selected thumbnails */}
      {uploads.length > 0 && (
        <div className="flex items-center gap-2 px-2 pb-2">
          {uploads.map((f, i) => (
            <div key={i} className="relative">
              <img
                src={URL.createObjectURL(f)}
                alt={`upload-${i}`}
                className="h-14 w-14 object-cover rounded-lg border border-black/10"
              />
              <button
                onClick={() => removeUpload(i)}
                className="absolute -top-2 -right-2 rounded-full bg-black/70 text-white text-xs w-5 h-5"
                aria-label={`remove image ${i + 1}`}
              >
                ×
              </button>
            </div>
          ))}
          <div className="ml-auto text-xs text-[var(--muted)]">{uploads.length}/4</div>
        </div>
      )}

      {/* composer row */}
      <div className="flex items-center gap-2">
        <button
          onClick={onPickFiles}
          className="rounded-xl border border-black/10 bg-white px-3 py-2 text-sm hover:bg-black/5 transition"
          disabled={busy}
        >
          + Upload
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          multiple
          hidden
          onChange={(e) => onFilesChosen(e.target.files)}
        />
        <input
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Ask anything…"
          className="flex-1 rounded-xl border border-black/10 bg-white px-3 py-2 text-sm outline-none"
          disabled={busy}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              onSend();
            }
          }}
        />
        <button
          onClick={onSend}
          disabled={busy}
          className="rounded-xl bg-black text-white px-4 py-2 text-sm disabled:opacity-50"
        >
          Send
        </button>
      </div>
    </div>
  );
}
