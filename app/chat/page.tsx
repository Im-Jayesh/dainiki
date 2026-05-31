"use client";

import { useAuth } from "@/contexts/auth-context";
import { useSettings } from "@/contexts/settings-context";
import { useState, useEffect, useRef } from "react";
import { Sidebar } from "@/components/sidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn, formatMarkdown } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, Send, Bot, User as UserIcon, RefreshCw, ChevronRight } from "lucide-react";
import { encrypt, decrypt } from "@/lib/crypto";
import { getAllEntries } from "@/lib/actions/journal";
import { updatePersonalityProfile } from "@/lib/actions/auth";

const THEME_STYLES: Record<string, string> = {
  zinc: "bg-white dark:bg-black text-zinc-900 dark:text-zinc-100",
  rose: "bg-[#fff1f2] dark:bg-[#4c0519] text-[#9f1239] dark:text-[#fff1f2]",
  slate: "bg-[#f8fafc] dark:bg-[#0f172a] text-[#1e293b] dark:text-[#f1f5f9]",
  velvet: "bg-[#faf5ff] dark:bg-[#3b0764] text-[#7e22ce] dark:text-[#faf5ff]"
};

interface Message {
  role: "user" | "ai";
  content: string;
}

export default function ChatPage() {
  const { user, encryptionKey, isAuth, setCredits } = useAuth();
  const { appearance } = useSettings();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isGeneratingProfile, setIsGeneratingProfile] = useState(false);
  const [profile, setProfile] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    const loadProfile = async () => {
      if (!user || !user.settings || !encryptionKey || !user.salt) return;
      try {
        const settings = JSON.parse(user.settings);
        if (settings.personalityProfile) {
          const decryptedProfile = await decrypt(settings.personalityProfile, encryptionKey, user.salt);
          setProfile(decryptedProfile);
        }
      } catch (e) {
        console.error("Failed to decrypt profile", e);
      }
    };
    loadProfile();
  }, [user, encryptionKey]);

  const generateProfile = async () => {
    if (!user || !encryptionKey || !user.salt) return;
    setIsGeneratingProfile(true);
    try {
      const data = await getAllEntries({ view: "active" });
      const decryptedEntries = await Promise.all(data.slice(0, 10).map(async (e) => {
        try {
          return await decrypt(e.content, encryptionKey, user.salt);
        } catch {
          return "";
        }
      }));

      const combinedText = decryptedEntries.map((content, i) => {
        const entry = data[i];
        return `Date: ${entry.created_at}, Mood: ${entry.mood_name || 'Unknown'}\nContent: ${content.replace(/<[^>]*>?/gm, '').substring(0, 1000)}`;
      }).join("\n\n---\n\n");
      
      const prompt = `Analyze the following 10 journal entries and their associated moods. 
      Create a simple, grounded summary of the user's current mindset and emotional state. 
      Look for recurring themes, what's bothering them, and what's making them happy. 
      This is a background summary for a supportive AI friend to help them understand the user better.
      Keep it brief and use natural, direct language. Under 200 words.
      
      Entries:\n${combinedText}`;

      const response = await fetch("/api/ai", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ prompt, feature: "profile_generation" }) });
      if (!response.ok) throw new Error("Failed to generate profile");

      const reader = response.body?.getReader();
      if (!reader) throw new Error("No response stream");

      const decoder = new TextDecoder();
      let fullResponse = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        fullResponse += decoder.decode(value);
      }

      setProfile(fullResponse);
      const encryptedProfile = await encrypt(fullResponse, encryptionKey, user.salt);
      await updatePersonalityProfile(encryptedProfile);
      
    } catch (err) {
      console.error(err);
    } finally {
      setIsGeneratingProfile(false);
    }
  };

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;
    
    const { deductAiCredit } = await import("@/lib/actions/auth");
    const creditRes = await deductAiCredit();
    if (!creditRes.success) {
      setMessages(prev => [...prev, { role: "ai", content: creditRes.error || "No credits remaining for today." }]);
      return;
    }
    if (setCredits && creditRes.remaining !== undefined) setCredits(creditRes.remaining);

    const userMsg = input.trim();
    setInput("");
    setMessages(prev => [...prev, { role: "user", content: userMsg }]);
    setIsLoading(true);

    try {
      const chatHistory = messages.map(m => `${m.role === 'ai' ? 'AI' : 'User'}: ${m.content}`).join('\n');
      const prompt = `Conversation history:\n${chatHistory}\nUser: ${userMsg}\nAI:`;

      const response = await fetch("/api/ai", { 
        method: "POST", 
        headers: { "Content-Type": "application/json" }, 
        body: JSON.stringify({ prompt, profile, feature: "chat" }) 
      });
      
      if (!response.ok) throw new Error("Failed to get response");

      setMessages(prev => [...prev, { role: "ai", content: "" }]);

      const reader = response.body?.getReader();
      if (!reader) throw new Error("No response stream");

      const decoder = new TextDecoder();
      let fullResponse = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value);
        fullResponse += chunk;
        setMessages(prev => {
          const newMsgs = [...prev];
          newMsgs[newMsgs.length - 1].content = fullResponse;
          return newMsgs;
        });
      }
    } catch (e) {
      console.error(e);
      setMessages(prev => [...prev, { role: "ai", content: "I'm having trouble responding right now. Please try again." }]);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isAuth) return null;

  return (
    <div 
      className={cn("flex h-screen w-full overflow-hidden transition-colors duration-500", THEME_STYLES[appearance.theme] || THEME_STYLES.zinc)}
      style={{ fontFamily: `var(--${appearance.fontFamily})` }}
    >
      <Sidebar open={sidebarOpen} onToggle={() => setSidebarOpen(!sidebarOpen)} />
      
      <main className="flex-1 flex flex-col relative overflow-hidden h-full">
        {!sidebarOpen && (
          <Button variant="ghost" size="icon" className="absolute left-6 top-6 z-10 h-10 w-10 text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-950 rounded-xl shadow-sm border border-zinc-100 dark:border-zinc-900" onClick={() => setSidebarOpen(true)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        )}

        <div className="absolute right-6 top-6 z-10">
           <Button onClick={generateProfile} disabled={isGeneratingProfile} variant="outline" size="sm" className="h-10 px-4 text-xs font-medium text-zinc-900 dark:text-zinc-100 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white/50 dark:bg-black/50 backdrop-blur-sm hover:bg-zinc-100 dark:hover:bg-zinc-900">
              <RefreshCw className={cn("h-4 w-4 mr-2", isGeneratingProfile && "animate-spin")} /> Update AI Knowledge
           </Button>
        </div>

        <div className="flex-1 flex flex-col max-w-4xl mx-auto w-full p-6 pt-24 md:pt-24 lg:pt-32 h-full">
          <div className="mb-8">
            <h1 className="text-4xl md:text-5xl font-black tracking-tight mb-2 flex items-center gap-4">
               Dainiki Companion <Sparkles className="h-8 w-8 text-amber-500" />
            </h1>
            <p className="text-[10px] font-bold uppercase tracking-[0.4em] text-zinc-400">
               Your private, empathetic listener
            </p>
          </div>

          <div 
            ref={scrollRef}
            className="flex-1 overflow-y-auto custom-scrollbar mb-6 space-y-6 pr-4"
          >
            {messages.length === 0 && (
              <div className="h-full flex flex-col items-center justify-center opacity-50 text-center space-y-4">
                <Bot className="h-16 w-16" />
                <p className="text-sm max-w-sm">I'm here to listen, support, and reflect with you. What's on your mind?</p>
              </div>
            )}
            
            <AnimatePresence>
              {messages.map((msg, idx) => (
                <motion.div 
                  key={idx}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={cn(
                    "flex gap-4 max-w-[85%]",
                    msg.role === "user" ? "ml-auto flex-row-reverse" : "mr-auto"
                  )}
                >
                  <div className={cn(
                    "h-8 w-8 rounded-full flex items-center justify-center shrink-0 mt-1",
                    msg.role === "user" ? "bg-zinc-900 text-zinc-50 dark:bg-zinc-100 dark:text-zinc-900" : "bg-amber-500 text-white"
                  )}>
                    {msg.role === "user" ? <UserIcon className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
                  </div>
                  <div className={cn(
                    "p-4 rounded-xl text-sm leading-relaxed",
                    msg.role === "user" ? "bg-zinc-100 dark:bg-zinc-900" : "bg-white dark:bg-zinc-950 border border-zinc-100 dark:border-zinc-800 shadow-sm prose prose-zinc dark:prose-invert prose-sm max-w-none"
                  )}>
                     <div dangerouslySetInnerHTML={{ __html: msg.role === "ai" ? formatMarkdown(msg.content) : msg.content.replace(/\n/g, '<br/>') }} />
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>

          <div className="relative shrink-0">
            <input 
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              placeholder="Share your thoughts..."
              autoFocus
              className="w-full h-14 pl-6 pr-14 rounded-xl bg-zinc-100/50 dark:bg-zinc-900/50 border-none shadow-inner text-sm focus:outline-none focus-visible:ring-1 focus-visible:ring-zinc-300"
            />
            <Button 
              size="icon" 
              onClick={handleSend} 
              disabled={isLoading || !input.trim()}
              className="absolute right-2 top-2 h-10 w-10 rounded-xl bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:hover:bg-zinc-200"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
}
