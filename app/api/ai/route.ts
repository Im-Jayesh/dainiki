import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextRequest } from "next/server";
import { getSession } from "@/lib/actions/auth";
import { db } from "@/lib/db";

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { prompt, profile, feature = "assist" } = await req.json();
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return new Response("AI configuration error: Missing API Key", { status: 500 });
  }

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    
    let baseInstruction = `You are Dainiki AI, a supportive, empathetic, and grounded journaling companion. 
    Your mission is to be a safe haven for the user's thoughts and provide helpful, human-like reflections.
    
    TONE & VOICE:
    1. MATCH THE USER: Adjust your tone to match how the user writes. If they are casual, be casual. If they are brief, be concise.
    2. AVOID FORMALITY: Do not sound like an academic or a poet. Avoid "majestic", "sophisticated", or overly flowery language (e.g., no "weaving thoughts" or "deep warmth and validation"). Just be a real, helpful friend.
    3. BE GROUNDED: Talk like a normal person would in a conversation. Use simple, direct language.
    4. PROVIDE SUPPORT: If they are struggling, offer gentle, practical perspective and validation without being melodramatic.
    5. STRUCTURE: Use clean Markdown (bold, italic, lists) where appropriate, but don't overdo it.
    
    If they are writing an entry: Help them clarify their thoughts or offer a brief, grounded reflection.
    If they are chatting: Be a proactive listener who helps them find clarity through normal conversation.`;
    
    if (profile) {
      baseInstruction += `\n\nUSER BACKGROUND & MOOD TRENDS (Last 10 Days): ${profile}`;
    }

    const model = genAI.getGenerativeModel({ 
      model: "gemini-2.5-flash",
      systemInstruction: baseInstruction
    });

    const result = await model.generateContentStream(prompt);
    
    const stream = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of result.stream) {
            const text = chunk.text();
            controller.enqueue(new TextEncoder().encode(text));
          }
          controller.close();
          
          const response = await result.response;
          const usage = response.usageMetadata;
          if (usage) {
             await db.execute({
               sql: "INSERT INTO ai_usage_logs (user_id, prompt_tokens, completion_tokens, feature) VALUES (?, ?, ?, ?)",
               args: [session.userId, usage.promptTokenCount || 0, usage.candidatesTokenCount || 0, feature]
             });
          }
        } catch (err) {
          controller.error(err);
        }
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
