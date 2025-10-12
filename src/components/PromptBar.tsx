import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useChatStore } from '../state/chatStore';
import { validateFiles } from '../lib/validators';
import { analyzeBatch } from '../lib/api';

export default function PromptBar() {
  const { uploads, setUploads, removeUpload, sendStart, addAssistantPlaceholder, patchAssistantCard, busy, mode, setIsTyping, pendingImages, setPendingImages, messages } =
    useChatStore();
  const [prompt, setPrompt] = useState('');
  const [dragActive, setDragActive] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [preview, setPreview] = useState<{ url: string; name: string } | null>(null);
  const [resetKey, setResetKey] = useState(0);

  // Always start with clean state when PromptBar mounts
  useEffect(() => {
    setPrompt('');
    setUploads([]);
  }, []);

  // Reset whenever uploads change (from external sources)
  useEffect(() => {
    if (uploads.length === 0) {
      setPrompt('');
    }
  }, [uploads.length]);

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
    
    // Clear the file input so it can be used again
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
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
    
    // Clear the input and uploads immediately when send is pressed
    const currentPrompt = prompt;
    const currentUploads = [...uploads];
    
    // Force complete reset of PromptBar
    setPrompt('');
    setUploads([]);
    setResetKey(prev => prev + 1); // Force component reset
    
    // Force a re-render to ensure UI updates immediately
    await new Promise(resolve => requestAnimationFrame(resolve));
    
    // Scroll newest message into view (top-aligned) when send is pressed
    setTimeout(() => {
      const chatContainer = document.querySelector('[data-chat-scroll]');
      if (chatContainer) {
        const lastMessage = chatContainer.querySelector('.message-item:last-child') as HTMLElement | null;
        if (lastMessage) {
          lastMessage.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }
    }, 100);
    
    // if no images, handle text-only chat
    if (currentUploads.length === 0) {
      if (!currentPrompt.trim()) {
        setErrorMsg('Type a question or add at least one image.');
        return;
      }
      sendStart(currentPrompt, currentUploads);
      try {
        setIsTyping(true);
        const res = await analyzeBatch(currentPrompt, [], mode);
        const text = res[0]?.answer ?? 'No answer';
        useChatStore.getState().addAssistantText(text);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        useChatStore.getState().addAssistantText(`Error: ${msg}`);
      }
      return;
    }

    // Check if we have pending images and user is responding with text
    if (pendingImages && currentPrompt.trim() && currentUploads.length === 0) {
      // User is responding to the follow-up question with text only
      sendStart(currentPrompt, pendingImages);
      
      // Process with LLM using pending images + user text
      const assistantId = addAssistantPlaceholder(pendingImages);
      const startedAt = performance.now();
      
      try {
        console.log(`🚀 Making 1 API call for ${pendingImages.length} images with follow-up text`);
        console.log('📤 Sending to backend:', { prompt: currentPrompt, imageCount: pendingImages.length });
        
        const results = await analyzeBatch(currentPrompt, pendingImages, mode);
        const elapsed = Math.round(performance.now() - startedAt);
        
        console.log(`✅ Received ${results.length} responses in ${elapsed}ms`);
        console.log('📥 Results:', results);
        
        // Update each card with its corresponding result
        results.forEach((result, i) => {
          patchAssistantCard(assistantId, i, {
            status: 'done',
            text: result.answer,
            elapsedMs: elapsed
          });
        });
      } catch (err) {
        const elapsed = Math.round(performance.now() - startedAt);
        const errorMsg = err instanceof Error ? err.message : String(err);
        
        // Mark all cards as error
        pendingImages.forEach((_, i) => {
          patchAssistantCard(assistantId, i, {
            status: 'error',
            text: errorMsg,
            elapsedMs: elapsed,
          });
        });
      }
      
      // Clear pending images after processing
      setPendingImages(null);
      return;
    }

    // Check if only images are sent without text
    if (!currentPrompt.trim()) {
      // No text provided - ask follow-up question directly
      sendStart('', currentUploads);
      const followUpText = currentUploads.length === 1 
        ? 'How can I help you with this image?' 
        : 'How can I help you with these images?';
      useChatStore.getState().addAssistantText(followUpText);
      
      // Store images for follow-up
      setPendingImages([...currentUploads]);
    } else {
      // Text provided - process with LLM
      sendStart(currentPrompt, currentUploads);

      // optimized single API call for all images
      const assistantId = addAssistantPlaceholder(currentUploads);
      const startedAt = performance.now();
      
      try {
        // Send all images in one API call
        console.log(`🚀 Making 1 API call for ${currentUploads.length} images`);
        console.log('📤 Sending to backend:', { prompt: currentPrompt, imageCount: currentUploads.length });
        
        const results = await analyzeBatch(currentPrompt, currentUploads, mode);
        const elapsed = Math.round(performance.now() - startedAt);
        
        console.log(`✅ Received ${results.length} responses in ${elapsed}ms`);
        console.log('📥 Results:', results);
        
        // Update each card with its corresponding result
        results.forEach((result, i) => {
          patchAssistantCard(assistantId, i, {
            status: 'done',
            text: result.answer,
            elapsedMs: elapsed
          });
        });
      } catch (err) {
        const elapsed = Math.round(performance.now() - startedAt);
        const errorMsg = err instanceof Error ? err.message : String(err);
        
        // Mark all cards as error
        currentUploads.forEach((_, i) => {
          patchAssistantCard(assistantId, i, {
            status: 'error',
            text: errorMsg,
            elapsedMs: elapsed,
          });
        });
      }
    }

    // Clear the file input after sending
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div
      key={resetKey}
      className={
        "relative rounded-xl shadow-sm p-3 border border-gray-700 transition " +
        (dragActive ? "border-blue-500 ring-2 ring-blue-500 " : "")
      }
      style={{ backgroundColor: '#0b1020' }}
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

      {/* Text Area */}
      <div className="mb-3 px-2">
        <input
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder={messages.length === 0 ? "How can I help you today?" : "Type a message..."}
          className="w-full rounded-lg px-3 py-2 text-sm outline-none text-white placeholder-gray-400 focus:outline-none resize-none"
          style={{ backgroundColor: '#0b1020' }}
          disabled={busy}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              onSend();
            }
          }}
        />
      </div>
      
      {/* Bottom Controls Row */}
      <div className="flex items-center justify-between px-2">
        {/* Left Buttons */}
        <div className="flex gap-2">
          <button
            onClick={onPickFiles}
            className={`group rounded-lg p-2 transition flex items-center justify-center
              bg-gray-700 text-gray-300 hover:bg-gray-600 hover:text-white
              disabled:opacity-50 disabled:pointer-events-none`}
            disabled={busy}
                  title="Upload image"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2}
              stroke="currentColor"
              className="w-4 h-4"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
          </button>
          
          <button
            onClick={() => console.log('Microphone clicked')}
            className={`group rounded-lg p-2 transition flex items-center justify-center
              bg-gray-700 text-gray-300 hover:bg-gray-600 hover:text-white
              disabled:opacity-50 disabled:pointer-events-none`}
            disabled={busy}
            title="Voice input"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2}
              stroke="currentColor"
              className="w-4 h-4"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 10v2a7 7 0 01-14 0v-2M12 19v4M8 23h8" />
            </svg>
          </button>
          
          <button
            onClick={() => console.log('History clicked')}
            className={`group rounded-lg p-2 transition flex items-center justify-center
              bg-gray-700 text-gray-300 hover:bg-gray-600 hover:text-white
              disabled:opacity-50 disabled:pointer-events-none`}
            disabled={busy}
            title="History"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2}
              stroke="currentColor"
              className="w-4 h-4"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </button>
        </div>
        
        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          multiple
          hidden
          onChange={(e) => onFilesChosen(e.target.files)}
        />
        
        {/* Right Elements */}
        <div className="flex items-center gap-2">
          <button
            onClick={onSend}
            disabled={busy || (!prompt.trim() && uploads.length === 0)}
            className={`group rounded-lg p-2 transition flex items-center justify-center
              text-white hover:opacity-90
              disabled:bg-gray-600 disabled:text-gray-400 disabled:opacity-70 disabled:pointer-events-none`}
            style={{ backgroundColor: '#089669' }}
            aria-label="Send message"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2}
              stroke="currentColor"
              className="w-4 h-4"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M7 14l5-5 5 5" />
            </svg>
          </button>
        </div>
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
