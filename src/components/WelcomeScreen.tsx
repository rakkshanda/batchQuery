import { useState, useRef, useEffect } from 'react';
import { useChatStore } from '../state/chatStore';
import { validateFiles } from '../lib/validators';
import { analyzeBatch } from '../lib/api';

interface WelcomeScreenProps {
  onStartChat: () => void;
}

export default function WelcomeScreen({ onStartChat }: WelcomeScreenProps) {
  const [prompt, setPrompt] = useState('');
  const [dragActive, setDragActive] = useState(false);
  const [uploads, setUploads] = useState<File[]>([]);
  const [errorMsg, setErrorMsg] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const formatBytes = (bytes: number) => {
    if (!Number.isFinite(bytes)) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB'];
    let i = 0;
    let v = bytes;
    while (v >= 1024 && i < units.length - 1) { v /= 1024; i++; }
    return `${v.toFixed(v < 10 && i > 0 ? 1 : 0)} ${units[i]}`;
  };

  const onFilesChosen = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const newUploads = Array.from(files);
    const merged = [...uploads, ...newUploads].slice(0, 4);
    const { ok, message } = validateFiles(merged);
    if (!ok) {
      setErrorMsg(message);
      setTimeout(() => setErrorMsg(''), 3000);
      return;
    }
    setUploads(merged);
  };

  const removeUpload = (index: number) => {
    setUploads(uploads.filter((_, i) => i !== index));
  };

  const onDropFiles = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      onFilesChosen(e.dataTransfer.files);
    }
  };

  // Auto-resize textarea
  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const adjustHeight = () => {
      textarea.style.height = '33px'; // Set initial height to 33px
      const scrollHeight = textarea.scrollHeight;
      const maxHeight = 120; // Maximum height in pixels (about 5-6 lines)
      
      if (scrollHeight > 33) {
        if (scrollHeight <= maxHeight) {
          textarea.style.height = scrollHeight + 'px';
          textarea.style.overflowY = 'hidden';
        } else {
          textarea.style.height = maxHeight + 'px';
          textarea.style.overflowY = 'auto';
        }
      } else {
        textarea.style.height = '33px';
        textarea.style.overflowY = 'hidden';
      }
    };

    adjustHeight();
  }, [prompt]);

  const handleSend = async () => {
    if (!prompt.trim() && uploads.length === 0) return;
    
    // Clear the input and uploads immediately when send is pressed
    const currentPrompt = prompt;
    const currentUploads = [...uploads];
    setPrompt('');
    setUploads([]);
    
    // Send the message and transition to chat
    const { sendStart, setUploads: setStoreUploads, mode, setIsTyping, addAssistantPlaceholder, patchAssistantCard, setPendingImages } = useChatStore.getState();
    setStoreUploads(currentUploads); // Set uploads in store before transitioning
    onStartChat(); // Transition to chat interface
    
    // Process the message to get a response
    if (currentUploads.length > 0) {
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

        // Handle image uploads
        const assistantId = addAssistantPlaceholder(currentUploads);
        const startedAt = performance.now();
        
        try {
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
          
          console.error('❌ Image processing failed:', errorMsg);
          
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
    } else {
      // Handle text-only messages
      try {
        setIsTyping(true);
        const results = await analyzeBatch(currentPrompt.trim(), [], mode);
        const answer = results[0]?.answer ?? 'No answer';
        useChatStore.getState().addAssistantText(answer);
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        useChatStore.getState().addAssistantText(`Error: ${errorMsg}`);
      }
    }
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white">
  

      {/* Main Content */}
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-80px)] px-4">
    

        {/* Title */}
        <h1 className="text-5xl font-serif mb-8 text-white">Hey there!</h1>

        {/* Input Container */}
        <div className="w-full max-w-2xl">
          <div 
            className={`rounded-xl border border-gray-700 p-4 transition ${
              dragActive ? "border-blue-500 ring-2 ring-blue-500" : ""
            }`}
            style={{ backgroundColor: 'var(--bg)' }}
            onDragEnter={(e) => { e.preventDefault(); e.stopPropagation(); setDragActive(true); }}
            onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy'; }}
            onDragLeave={(e) => { e.preventDefault(); e.stopPropagation(); setDragActive(false); }}
            onDrop={onDropFiles}
          >
            {/* Upload Previews */}
            {uploads.length > 0 && (
              <div className="flex items-center gap-2 mb-3">
                {uploads.map((f, i) => (
                  <div key={i} className="relative group">
                    <img
                      src={URL.createObjectURL(f)}
                      alt={`upload-${i}`}
                      className="h-14 w-14 object-cover rounded-lg border border-gray-600 cursor-zoom-in"
                    />
                    <div className="pointer-events-none absolute inset-0 rounded-lg bg-black/0 group-hover:bg-black/40 transition flex items-end justify-center">
                      <div className="opacity-0 group-hover:opacity-100 transition m-1 text-[10px] leading-tight px-1.5 py-0.5 rounded-md bg-gray-800/95 text-white border border-gray-600">
                        <div className="truncate max-w-[3.5rem]">{f.type || 'image'}</div>
                        <div>{formatBytes(f.size)}</div>
                      </div>
                    </div>
                    <button
                      onClick={() => removeUpload(i)}
                      className="absolute -top-2 -right-2 rounded-full bg-black/70 text-white text-xs w-5 h-5"
                      aria-label={`remove image ${i + 1}`}
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
            
            {/* Text Area */}
            <div className="mb-3">
              <textarea
                ref={textareaRef}
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="How can I help you today?"
                className="w-full rounded-lg px-3 py-2 text-sm outline-none text-white placeholder-gray-400 focus:outline-none resize-none"
                style={{ backgroundColor: 'var(--bg)', height: '33px' }}
                onKeyDown={onKeyDown}
              />
            </div>
            
            {/* Bottom Controls Row */}
            <div className="flex items-center justify-between">
              {/* Left Buttons */}
              <div className="flex gap-2">
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="group rounded-lg p-2 transition flex items-center justify-center
                    bg-gray-700 text-gray-300 hover:bg-gray-600 hover:text-white"
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
                  onClick={() => {}}
                  className="group rounded-lg p-2 transition flex items-center justify-center
                    bg-gray-700 text-gray-300 hover:bg-gray-600 hover:text-white"
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
                  onClick={() => {}}
                  className="group rounded-lg p-2 transition flex items-center justify-center
                    bg-gray-700 text-gray-300 hover:bg-gray-600 hover:text-white"
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
              
              {/* Right Elements */}
              <div className="flex items-center gap-2">
                <button
                  onClick={handleSend}
                  disabled={!prompt.trim() && uploads.length === 0}
                  className="group rounded-lg p-2 transition flex items-center justify-center
                    text-white hover:opacity-90 disabled:bg-gray-600 disabled:text-gray-400"
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
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4l-8 8h16l-8-8z" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
          
          {/* Error Message */}
          {errorMsg && (
            <div className="mt-2 text-center text-xs text-red-400">
              {errorMsg}
            </div>
          )}
        </div>

   
      </div>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        multiple
        hidden
        onChange={(e) => onFilesChosen(e.target.files)}
      />
    </div>
  );
}
