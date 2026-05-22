import { GoogleGenerativeAI } from "@google/generative-ai";

export async function checkOllama() {
  try {
    const response = await fetch("http://localhost:11434/api/tags");
    return response.ok;
  } catch {
    return false;
  }
}

export async function* streamOllama(prompt: string, model = "gemma4:e2b") {
  const response = await fetch("http://localhost:11434/api/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      prompt,
      stream: true,
      system: "You are Dainiki AI, a majestic journaling assistant. Your task is to polish user entries for better flow, grammar, and emotional resonance while preserving their personal voice. Use clean Markdown formatting with clear spacing. If summarizing, be concise but profound. IMPORTANT: Return ONLY the polished content or summary, no conversational filler."
    }),
  });

  if (!response.ok) throw new Error("Ollama stream failed");

  const reader = response.body?.getReader();
  if (!reader) return;

  const decoder = new TextDecoder();
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    const chunk = decoder.decode(value, { stream: true });
    
    // Handle multiple JSON objects in one chunk (common in streaming)
    const lines = chunk.split('\n').filter(l => l.trim());
    for (const line of lines) {
      try {
        const json = JSON.parse(line);
        if (json.response) yield json.response;
        if (json.done) return;
      } catch {
        // Partial JSON chunk, wait for next
      }
    }
  }
}

export async function* streamGemini(prompt: string, apiKey: string) {
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ 
    model: "gemini-1.5-flash-lite",
    systemInstruction: "You are Dainiki AI, a majestic journaling assistant. Your task is to polish user entries for better flow, grammar, and emotional resonance while preserving their personal voice. Use clean Markdown formatting with clear spacing. If summarizing, be concise but profound. IMPORTANT: Return ONLY the polished content or summary, no conversational filler."
  });
  
  const result = await model.generateContentStream(prompt);
  for await (const chunk of result.stream) {
    yield chunk.text();
  }
}
