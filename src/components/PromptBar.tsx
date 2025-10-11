import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useChatStore } from '../state/chatStore';
import { validateFiles } from '../lib/validators';
import { analyzeBatch } from '../lib/api';

export default function PromptBar() {
  const { uploads, setUploads, removeUpload, sendStart, addAssistantPlaceholder, patchAssistantCard, busy, mode } =
    useChatStore();
  const [prompt, setPrompt] = useState('');
  const [dragActive, setDragActive] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [preview, setPreview] = useState<{ url: string; name: string } | null>(null);

  const formatBytes = (bytes: number) => {
    if (!Number.isFinite(bytes)) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB'];
    let i = 0;
    let v = bytes;
    while (v >= 1024 && i < units.length - 1) { v /= 1024; i++; }
    return `${v.toFixed(v < 10 && i > 0 ? 1 : 0)} ${units[i]}`;
  };

  // Close preview on ESC
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setPreview(null); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    if (!preview) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [preview]);

  const onPickFiles = () => fileInputRef.current?.click();

  const onFilesChosen = (files: FileList | File[] | null) => {
    if (!files) return;
    const selected = Array.isArray(files) ? files : Array.from(files);
    const merged = [...uploads, ...selected].slice(0, 4); // cap at 4
    const { ok, message } = validateFiles(merged);
    if (!ok) {
      setErrorMsg(message);
      return;
    }
    setErrorMsg('');
    setUploads(merged);
  };


  const onDropFiles = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    const dt = e.dataTransfer;
    let fileList: File[] = [];

    if (dt?.items && dt.items.length) {
      for (const item of Array.from(dt.items)) {
        if (item.kind === 'file') {
          const f = item.getAsFile();
          if (f) fileList.push(f);
        }
      }
    } else if (dt?.files && dt.files.length) {
      fileList = Array.from(dt.files);
    }

    if (fileList.length > 0) {
      onFilesChosen(fileList);
    }

    // clear data as a best-effort to avoid sticky drag data on some browsers
    try { dt?.clearData(); } catch {}
  };

  const onSend = async () => {
    const vf = validateFiles(uploads);
    if (!vf.ok) {
      setErrorMsg(vf.message);
      return;
    }

    // if user tries to send with no prompt AND no images, block softly (no popup)
    if (uploads.length === 0 && !prompt.trim()) {
      setErrorMsg('Type a question or add at least one image.');
      return;
    }

    setErrorMsg('');
    sendStart(prompt, uploads);

    // if no images, handle text-only chat
    if (uploads.length === 0) {
      if (!prompt.trim()) {
        setErrorMsg('Type a question or add at least one image.');
        return;
      }
      try {
        const res = await analyzeBatch(prompt, [], mode);
        const text = res[0]?.answer ?? 'No answer';
        useChatStore.getState().addAssistantText(text);
        setPrompt('');
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        useChatStore.getState().addAssistantText(`Error: ${msg}`);
      }
      return;
    }

    // existing multi-image flow
    const assistantId = addAssistantPlaceholder(uploads);
    const startedAt = performance.now();
    const promptToUse = (prompt && prompt.trim()) || 'Provide a concise, checklist-style quality check for this product image (defects, guideline issues, presentation problems).';
    const runners = uploads.map((file, i) =>
      analyzeBatch(promptToUse, [file], mode)
        .then((res) => {
          const elapsed = Math.round(performance.now() - startedAt);
          const text = res[0]?.answer ?? 'No answer';
          patchAssistantCard(assistantId, i, { status: 'done', text, elapsedMs: elapsed });
        })
        .catch((err) => {
          const elapsed = Math.round(performance.now() - startedAt);
          patchAssistantCard(assistantId, i, {
            status: 'error',
            text: String(err?.message || err),
            elapsedMs: elapsed,
          });
        })
    );

    await Promise.allSettled(runners);
    setPrompt('');
    setUploads([]);
  };

  return (
    <div
      className={
        "relative rounded-2xl bg-[var(--surface)] shadow-soft p-2 border transition " +
        (dragActive ? "border-blue-400 ring-2 ring-blue-500 dark:border-blue-300 " : "border-black/10 dark:border-white/10")
      }
      onDragEnter={(e) => { e.preventDefault(); e.stopPropagation(); setDragActive(true); }}
      onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy'; }}
      onDragLeave={(e) => { e.preventDefault(); e.stopPropagation(); setDragActive(false); }}
      onDrop={onDropFiles}
    >

      {/* selected thumbnails */}
      {uploads.length > 0 && (
        <div className="flex items-center gap-2 px-2 pb-2">
          {uploads.map((f, i) => (
            <div key={i} className="relative group">
              {(() => {
                const url = URL.createObjectURL(f);
                return (
                  <>
                    <img
                      src={url}
                      alt={`upload-${i}`}
                      className="h-14 w-14 object-cover rounded-lg border border-black/10 dark:border-white/10 cursor-zoom-in"
                      onClick={() => {
                        const previewUrl = URL.createObjectURL(f);
                        setPreview({ url: previewUrl, name: f.name });
                      }}
                    />
                    {/* Hover metadata badge */}
                    <div className="pointer-events-none absolute inset-0 rounded-lg bg-black/0 group-hover:bg-black/40 transition flex items-end justify-center">
                      <div className="opacity-0 group-hover:opacity-100 transition m-1 text-[10px] leading-tight px-1.5 py-0.5 rounded-md bg-[var(--surface)]/95 text-[var(--text)] border border-black/10 dark:border-white/10">
                        <div className="truncate max-w-[3.5rem]">{f.type || 'image'}</div>
                        <div>{formatBytes(f.size)}</div>
                      </div>
                    </div>
                    {/* Spinner while busy */}
                    {busy && (
                      <div className="absolute top-1 left-1 w-4 h-4 rounded-full border-2 border-[var(--text)]/40 border-t-transparent animate-spin" />
                    )}
                    <button
                      onClick={() => removeUpload(i)}
                      className="absolute -top-2 -right-2 rounded-full bg-black/70 text-white text-xs w-5 h-5"
                      aria-label={`remove image ${i + 1}`}
                    >
                      ×
                    </button>
                  </>
                );
              })()}
            </div>
          ))}
        </div>
      )}

      {/* composer row */}
      <div className="flex items-center gap-2">
        <button
          onClick={onPickFiles}
          className="rounded-xl border px-3 py-2 text-sm transition bg-[var(--surface)] text-[var(--text)] border-black/10 dark:border-white/10 hover:bg-black/5 dark:hover:bg-white/10"
          disabled={busy}
        >
          + 
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
          className="flex-1 rounded-xl border px-3 py-2 text-sm outline-none bg-[var(--surface)] text-[var(--text)] placeholder-[var(--muted)] border-black/10 dark:border-white/10 focus:border-black/20 dark:focus:border-white/20"
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
          className="rounded-full p-2 disabled:opacity-50 bg-[var(--text)] text-[var(--bg)] hover:opacity-90 transition flex items-center justify-center"
          aria-label="Send message"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={2}
            stroke="currentColor"
            className="w-5 h-5"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14m-7-7l7 7-7 7" />
          </svg>
        </button>
      </div>
      {errorMsg && (
        <div className="px-2 pt-2 text-xs text-rose-600 dark:text-rose-400">
          {errorMsg}
        </div>
      )}
      {preview &&
        createPortal(
          <div
            className="fixed inset-0 z-[2147483647] bg-black/90 backdrop-blur-sm flex items-center justify-center"
            onClick={() => { if (preview?.url) URL.revokeObjectURL(preview.url); setPreview(null); }}
          >
            <div className="relative max-w-[95vw] max-h-[95vh]" onClick={(e) => e.stopPropagation()}>
              <img
                src={preview.url}
                alt={preview.name}
                className="max-w-full max-h-[90vh] rounded-xl border border-black/10 dark:border-white/10 shadow-2xl"
              />
              <button
                onClick={() => { if (preview?.url) URL.revokeObjectURL(preview.url); setPreview(null); }}
                className="absolute -top-4 -right-4 w-10 h-10 rounded-full bg-black/70 text-white text-lg flex items-center justify-center"
                aria-label="Close preview"
              >
                ×
              </button>
              <div className="absolute bottom-2 left-2 text-xs text-white/90 drop-shadow">
                {preview.name}
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}
