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
  if (mode === 'mock') {
    // simulate staggered finishes
    await sleep(500 + Math.random() * 600);
    return files.map((_, i) => ({ answer: mockAnswer(prompt, i) }));
  }
  // ---- LIVE (stub): call your backend or OpenAI here ----
  // Example (backend route):
  // const form = new FormData();
  // form.set('prompt', prompt);
  // files.forEach((f, i) => form.set(`image_${i}`, f));
  // const res = await fetch('/api/analyze', { method: 'POST', body: form });
  // if (!res.ok) throw new Error(await res.text());
  // return await res.json();

  // For now, fallback to mock to keep UX flowing:
  await sleep(400);
  return files.map((_, i) => ({ answer: `[LIVE placeholder] ${mockAnswer(prompt, i)}` }));
}

function mockAnswer(prompt: string, i: number) {
  // very small heuristic: if question contains "how many"
  if (/how many|count/i.test(prompt)) {
    const n = (i + 1) * 2 - 1; // 1,3,5,7…
    return `${n}`;
  }
  return pick(i);
}
