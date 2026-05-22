import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextRequest } from "next/server";
import { getSession } from "@/lib/actions/auth";

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { prompt } = await req.json();
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return new Response("AI configuration error: Missing API Key", { status: 500 });
  }

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ 
      model: "gemini-2.5-flash",
      systemInstruction: "You are Dainiki AI, a majestic journaling assistant. Your task is to polish user entries for better flow, grammar, and emotional resonance while preserving their personal voice. Use clean Markdown formatting with clear spacing. If summarizing, be concise but profound. IMPORTANT: Return ONLY the polished content or summary, no conversational filler."
    });

    const result = await model.generateContentStream(prompt);
    
    const stream = new ReadableStream({
      async start(controller) {
        for await (const chunk of result.stream) {
          const text = chunk.text();
          controller.enqueue(new TextEncoder().encode(text));
        }
        controller.close();
      },
    });

    return new Response(stream, {
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  } catch (error: any) {
    console.error("AI Route Error:", error);
    return new Response(error.message || "AI failed to respond", { status: 500 });
  }
}
