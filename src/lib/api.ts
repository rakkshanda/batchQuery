/**
 * Single entry for analysis.
 * Returns an array the same length as `files`, each with `{ answer }`.
 * Mock mode gives deterministic placeholders.
 * Live mode stub included—wire your server route or OpenAI SDK here.
 */

export type AnalyzeResult = { answer: string };

const SAMPLES = [
  'No visible defects detected.',
  'Possible glare on the top-right; background looks acceptable.',
  'Slight shadowing under the product; overall OK.',
  'I’m not fully sure—image is partially occluded.',
  'There appear to be minor scratches near the center.',
];

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const pick = (i: number) => SAMPLES[i % SAMPLES.length];

export async function analyzeBatch(
  prompt: string,
  files: File[],
  mode: 'mock' | 'live',
): Promise<AnalyzeResult[]> {
  console.log(`🔍 analyzeBatch called: ${files.length} files, mode: ${mode}`);
  
  if (mode === 'mock') {
    // simulate staggered finishes
    await sleep(500 + Math.random() * 600);
    return files.map((_, i) => ({ answer: mockAnswer(prompt, i) }));
  }
  
  // ---- LIVE: call OpenAI Vision API here ----
  console.log('🌐 Making API call to /api/analyze');
  const formData = new FormData();
  formData.append('prompt', prompt);
  files.forEach((file) => {
    formData.append('files', file);
  });
  
  const response = await fetch('/api/analyze', {
    method: 'POST',
    body: formData,
  });
  
  console.log('📡 API response status:', response.status);
  const results: AnalyzeResult[] = await response.json();
  console.log('📋 API results:', results);
  return results;
}

function mockAnswer(prompt: string, i: number) {
  // very small heuristic: if question contains "how many"
  if (/how many|count/i.test(prompt)) {
    const n = (i + 1) * 2 - 1; // 1,3,5,7…
    return `${n}`;
  }
  return pick(i);
}
