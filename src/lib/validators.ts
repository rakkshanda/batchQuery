export function validatePrompt(p: string) {
  const s = p.trim();
  if (s.length < 2) return { ok: false, message: 'Please enter a question.' };
  if (s.length > 500) return { ok: false, message: 'Question too long (max 500 chars).' };
  return { ok: true, message: '' };
}

const ACCEPT = ['image/png', 'image/jpeg', 'image/webp'];
const MAX_SIZE = 10 * 1024 * 1024; // 10MB

export function validateFiles(files: File[]) {
  if (!files || files.length === 0) return { ok: false, message: 'Attach at least one image.' };
  if (files.length > 4) return { ok: false, message: 'You can attach up to 4 images.' };
  for (const f of files) {
    if (!ACCEPT.includes(f.type)) return { ok: false, message: `Unsupported type: ${f.type}` };
    if (f.size > MAX_SIZE) return { ok: false, message: `${f.name} is larger than 10MB.` };
  }
  return { ok: true, message: '' };
}
