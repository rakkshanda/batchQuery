import OpenAI from "openai";

const API_KEY = process.env.OPENAI_API_KEY || process.env.VITE_OPENAI_API_KEY;

export const config = { runtime: "edge" }; // Vercel edge function

if (!API_KEY) {
  console.log("❌ API_KEY is missing");
} else {
  console.log("✅ API_KEY loaded");
}

const openai = new OpenAI({
  apiKey: API_KEY, // server-side only
});

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  if (!API_KEY) {
    return new Response(JSON.stringify({ error: "Missing API_KEY" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  console.log("📩 Received request");

  try {
    const form = await req.formData();
    const prompt = String(form.get("prompt") ?? "");

    // Collect images
    const images: Blob[] = [];
    const keys: string[] = [];
    (form as any).forEach((v: any, k: string) => {
      keys.push(k);
      if (v instanceof Blob && (k.startsWith('image_') || k === 'files' || k === 'file')) {
        images.push(v as Blob);
      }
    });
    console.log('Form keys:', keys);
    console.log('Images received:', images.length);

    if (images.length === 0) {
      return new Response(JSON.stringify([{ answer: 'No images received by server' }]), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Convert all images to base64 data URLs
    const imageDataUrls = await Promise.all(
      images.map(async (img) => {
        const arr = new Uint8Array(await img.arrayBuffer());
        let binary = "";
        for (let i = 0; i < arr.length; i++) binary += String.fromCharCode(arr[i]);
        const base64 = btoa(binary);
        return `data:${img.type};base64,${base64}`;
      })
    );

    console.log("📤 Sending single batch request to OpenAI for", imageDataUrls.length, "images");

    const res = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.2,
      messages: [
        {
          role: "system",
          content: "You are an assistant that analyzes multiple e-commerce product images at once. Return your output as a JSON array with one object per image, each containing {\"index\": number, \"answer\": string}. Keep answers concise.",
        },
        {
          role: "user",
          content: [
            { type: "text", text: `${prompt}\nReturn only valid JSON in the exact format described.` },
            ...imageDataUrls.map((url) => ({
              type: "image_url" as const,
              image_url: { url },
            })),
          ],
        },
      ],
    });

    let content = res.choices[0].message?.content?.trim() || "";
    console.log("🧠 Raw model output:", content);

    let parsed: { index: number; answer: string }[] = [];
    try {
      // Remove markdown fences if the model wrapped the JSON in ```json
      content = content.replace(/```json|```/g, "").trim();
      parsed = JSON.parse(content);
      if (!Array.isArray(parsed) || parsed.length !== images.length) {
        throw new Error("JSON structure mismatch");
      }
    } catch (e) {
      console.error("⚠️ Failed to parse JSON, returning fallback answers", e);
      parsed = images.map((_, i) => ({
        index: i,
        answer: "Could not interpret AI response.",
      }));
    }

    const answers = parsed.map((p) => ({ answer: p.answer }));
    console.log("✅ Returning all answers");
    return new Response(JSON.stringify(answers), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error processing request:", error);
    return new Response("Internal Server Error", { status: 500 });
  }
}