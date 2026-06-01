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
    2. NO FLOWERY LANGUAGE: Do not use words like "majestic", "sophisticated", "tapestry", "echoes", or "sanctuary". Avoid "weaving thoughts" or "deep warmth". Just be a real, helpful human friend. No poetic filler.
    3. BE GROUNDED: Talk like a normal person would in a 1-on-1 conversation. Use simple, direct language.
    4. PROVIDE SUPPORT: If they are struggling, offer gentle, practical perspective and validation without being melodramatic or overly soft.
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

    // Implement retry logic for 503 (High Demand) errors
    let result;
    let retries = 0;
    const maxRetries = 3;
    
    while (retries <= maxRetries) {
      try {
        result = await model.generateContentStream(prompt);
        break; // Success, exit loop
      } catch (err: any) {
        if (err.status === 503 && retries < maxRetries) {
          retries++;
          const delay = Math.pow(2, retries) * 1000; // Exponential backoff: 2s, 4s, 8s
          console.warn(`[AI] 503 High Demand for ${feature}. Retrying in ${delay}ms... (Attempt ${retries}/${maxRetries})`);
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }
        throw err; // Re-throw if not 503 or max retries reached
      }
    }

    if (!result) throw new Error("AI failed to initialize stream after retries");
    
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
