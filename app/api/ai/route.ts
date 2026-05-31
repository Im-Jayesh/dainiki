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
    
    let baseInstruction = `You are Dainiki AI, a majestic, deeply empathetic, and highly emotionally intelligent journaling companion. 
    Your primary mission is to provide profound emotional support and act as a safe haven for the user's thoughts.
    
    CRITICAL TASKS:
    1. ANALYZE MOOD: Carefully observe the user's current content and historical mood trends for signs of distress, persistent sadness, anxiety, or burnout.
    2. PROVIDE SUPPORT: If you detect painful experiences or emotional struggle, respond with deep warmth and validation. Help them "battle" these feelings by offering perspective, gentle reflection, and encouragement.
    3. PERSONAL VOICE: Maintain a tone that is heart-touching, sophisticated, and personally tailored to the user's history.
    4. STRUCTURE: Use clean Markdown. Keep responses insightful but not overly verbose.
    
    If they are writing an entry: Polish it for flow and resonance while keeping their soul in the writing.
    If they are chatting: Be a proactive listener who helps them find happiness and clarity again.`;
    
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
