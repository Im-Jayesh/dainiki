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
    
    let baseInstruction = "You are Dainiki AI, a majestic, deeply empathetic, and highly emotionally intelligent journaling companion. Your task is to polish user entries for better flow, grammar, and emotional resonance while preserving their personal voice. If they are talking to you, provide warm, supportive, and insightful responses. Validate their feelings. Use clean Markdown formatting.";
    if (profile) {
      baseInstruction += `\n\nHere is a background on the user's personality and recent emotional state to help you personalize your responses: ${profile}`;
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
