"use client";

import { useAuth } from "@/contexts/auth-context";
import { useSettings } from "@/contexts/settings-context";
import { useState, useEffect, useRef, useCallback } from "react";
import { Sidebar } from "@/components/sidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn, formatMarkdown } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, Send, Bot, User as UserIcon, RefreshCw, ChevronRight, ChevronLeft, Plus, MessageSquare, Trash2 } from "lucide-react";
import { encrypt, decrypt } from "@/lib/crypto";
import { getAllEntries } from "@/lib/actions/journal";
import { updatePersonalityProfile, deductAiCredit } from "@/lib/actions/auth";
import { getChatHistory, saveChatMessage, getChatSessions, deleteChatSession } from "@/lib/actions/chat";

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

interface DecryptedSession {
  session_id: string;
  session_title: string;
  last_activity: string;
}

export default function ChatPage() {
  const { user, encryptionKey, isAuth, setCredits, refreshStatus } = useAuth();
  const { appearance } = useSettings();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [chatSidebarOpen, setChatSidebarOpen] = useState(true);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  
  // Profile & Mindset states
  const [isGeneratingProfile, setIsGeneratingProfile] = useState(false);
  const [profile, setProfile] = useState<string | null>(null);
  const [isMindsetCollapsed, setIsMindsetCollapsed] = useState(true);

  // Chat sessions states
  const [chatSessions, setChatSessions] = useState<DecryptedSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [currentSessionTitle, setCurrentSessionTitle] = useState<string>("New Chat");

  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const hasLoadedInitialSessionRef = useRef(false);
  const [isLoading, setIsLoading] = useState(false);

  // Auto-focus input on page mount + redirect any typing to the input (like ChatGPT)
  useEffect(() => {
    inputRef.current?.focus();

    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      // Ignore if already focused on an input/textarea/contenteditable
      const active = document.activeElement;
      if (
        active instanceof HTMLInputElement ||
        active instanceof HTMLTextAreaElement ||
        (active instanceof HTMLElement && active.isContentEditable)
      ) return;

      // Ignore modifier-only keys, special keys, and browser shortcuts
      if (
        e.metaKey || e.ctrlKey || e.altKey ||
        e.key === "Escape" || e.key === "Tab" || e.key === "Enter" ||
        e.key === "Backspace" || e.key === "Delete" ||
        e.key.startsWith("Arrow") || e.key.startsWith("F") ||
        e.key === "Shift" || e.key === "Control" || e.key === "Alt" ||
        e.key === "Meta" || e.key === "CapsLock" || e.key === "NumLock" ||
        e.key.length > 1 // non-printable keys
      ) return;

      // Focus the input — the browser will naturally route the keystroke to it
      inputRef.current?.focus();
    };

    document.addEventListener("keydown", handleGlobalKeyDown);
    return () => document.removeEventListener("keydown", handleGlobalKeyDown);
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Load E2E Encrypted Chat Sessions List
  const loadSessions = useCallback(async () => {
    if (!user || !encryptionKey || !user.salt) return;
    try {
      const rawSessions = await getChatSessions();
      const decrypted = await Promise.all(rawSessions.map(async (s) => {
        try {
          const decTitle = await decrypt(s.session_title, encryptionKey, user.salt!);
          return {
            session_id: s.session_id,
            session_title: decTitle,
            last_activity: s.last_activity
          };
        } catch {
          return {
            session_id: s.session_id,
            session_title: "🔒 Encrypted Chat",
            last_activity: s.last_activity
          };
        }
      }));
      setChatSessions(decrypted);

      // Auto-load latest session on fresh open
      if (decrypted.length > 0 && !hasLoadedInitialSessionRef.current && currentSessionId === null) {
        const latest = decrypted[0];
        setCurrentSessionId(latest.session_id);
        setCurrentSessionTitle(latest.session_title);
        hasLoadedInitialSessionRef.current = true;
      }
    } catch (e) {
      console.error("Failed to load chat sessions:", e);
    }
  }, [user, encryptionKey, currentSessionId]);

  // Initial Boot Data Loading
  useEffect(() => {
    const loadData = async () => {
      if (!user || !encryptionKey || !user.salt) return;
      
      // Load Profile Mindset summary
      try {
        if (user.settings) {
          const settings = JSON.parse(user.settings);
          if (settings.personalityProfile) {
            const decryptedProfile = await decrypt(settings.personalityProfile, encryptionKey, user.salt);
            setProfile(decryptedProfile);
          } else {
            setProfile(null);
          }
        } else {
          setProfile(null);
        }
      } catch (e) {
        console.error("Failed to decrypt profile", e);
      }

      await loadSessions();
    };
    loadData();
  }, [user, encryptionKey, loadSessions]);

  // Load selected session history
  useEffect(() => {
    const loadSessionHistory = async () => {
      if (!user || !encryptionKey || !user.salt) return;
      if (currentSessionId === null) {
        setMessages([]);
        return;
      }
      try {
        const history = await getChatHistory(currentSessionId);
        const decryptedHistory = await Promise.all(history.map(async (msg) => {
          try {
            const decryptedContent = await decrypt(msg.content, encryptionKey, user.salt);
            return { role: msg.role, content: decryptedContent } as Message;
          } catch (err) {
            return { role: msg.role, content: "🔒 Decryption Failed" } as Message;
          }
        }));
        setMessages(decryptedHistory);
      } catch (e) {
        console.error("Failed to load session history:", e);
        setMessages([]);
      }
    };
    loadSessionHistory();
  }, [currentSessionId, user, encryptionKey]);

  // Start a fresh conversation
  const handleNewChat = () => {
    setCurrentSessionId(null);
    setCurrentSessionTitle("New Chat");
    setMessages([]);
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  // Delete a specific session
  const handleDeleteSession = async (sessionId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("Are you sure you want to delete this chat session? This cannot be undone.")) return;
    
    try {
      const success = await deleteChatSession(sessionId);
      if (success) {
        if (currentSessionId === sessionId) {
          handleNewChat();
        }
        await loadSessions();
      }
    } catch (err) {
      console.error("Failed to delete session:", err);
    }
  };

  // Generate Profile summary based on the last 10 days of entries
  const generateProfile = async () => {
    if (!user || !encryptionKey || !user.salt) return;
    setIsGeneratingProfile(true);
    setIsMindsetCollapsed(false); // Auto expand to show activity
    
    try {
      const data = await getAllEntries({ view: "active" });
      
      // Calculate 10 days ago date boundary
      const tenDaysAgo = new Date();
      tenDaysAgo.setDate(tenDaysAgo.getDate() - 10);
      
      // Filter entries within the last 10 days
      let targetEntries = data.filter(e => new Date(e.created_at) >= tenDaysAgo);
      
      // Fallback to the most recent 10 entries if no entries in past 10 days
      if (targetEntries.length === 0) {
        targetEntries = data.slice(0, 10);
      }

      const decryptedEntries = await Promise.all(targetEntries.map(async (e) => {
        try {
          return await decrypt(e.content, encryptionKey, user.salt!);
        } catch {
          return "";
        }
      }));

      const combinedText = decryptedEntries.map((content, i) => {
        const entry = targetEntries[i];
        return `Date: ${entry.created_at}, Mood: ${entry.mood_name || 'Unknown'}\nContent: ${content.replace(/<[^>]*>?/gm, '').substring(0, 1000)}`;
      }).join("\n\n---\n\n");
      
      const prompt = `Analyze the following journal entries and their associated moods. 
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
      
      // Sync auth context with server database settings (fixes stale settings)
      await refreshStatus();
      
    } catch (err) {
      console.error("Failed to generate background profile:", err);
    } finally {
      setIsGeneratingProfile(false);
    }
  };

  // Send message handler
  const handleSend = async () => {
    if (!input.trim() || isLoading || !user || !encryptionKey || !user.salt) return;
    
    const creditRes = await deductAiCredit();
    if (!creditRes.success) {
      setMessages(prev => [...prev, { role: "ai", content: creditRes.error || "No credits remaining for today." }]);
      return;
    }
    if (setCredits && creditRes.remaining !== undefined) setCredits(creditRes.remaining);

    const userMsg = input.trim();
    setInput("");
    
    // Add user message locally
    setMessages(prev => [...prev, { role: "user", content: userMsg }]);
    setIsLoading(true);

    try {
      // 1. Establish session details if it's a new conversation
      let activeSessionId = currentSessionId;
      let activeSessionTitle = currentSessionTitle;
      let isNewSession = false;

      if (!activeSessionId) {
        activeSessionId = "session_" + Date.now() + "_" + Math.random().toString(36).substring(2, 9);
        activeSessionTitle = userMsg.substring(0, 25) + (userMsg.length > 25 ? "..." : "");
        isNewSession = true;
        
        setCurrentSessionId(activeSessionId);
        setCurrentSessionTitle(activeSessionTitle);
      }

      // 2. Encrypt and save user message to DB
      const encryptedUserMsg = await encrypt(userMsg, encryptionKey, user.salt);
      const encryptedTitle = isNewSession ? await encrypt(activeSessionTitle, encryptionKey, user.salt) : undefined;
      await saveChatMessage("user", encryptedUserMsg, activeSessionId, encryptedTitle);

      // 3. Prepare sliced history context
      const SaverConversation = [...messages, { role: "user", content: userMsg } as Message];
      const recentMessages = SaverConversation.slice(-10);
      const chatHistory = recentMessages.map(m => `${m.role === 'ai' ? 'AI' : 'User'}: ${m.content}`).join('\n');
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

      // 4. Encrypt and save AI response to DB
      const encryptedAiResponse = await encrypt(fullResponse, encryptionKey, user.salt);
      await saveChatMessage("ai", encryptedAiResponse, activeSessionId);

      // 5. Reload sessions to update sidebar
      if (isNewSession) {
        await loadSessions();
      }

    } catch (e) {
      console.error(e);
      setMessages(prev => [...prev, { role: "ai", content: "I'm having trouble responding right now. Please try again." }]);
    } finally {
      setIsLoading(false);
    }
  };

  const renderSessionsGroup = () => {
    if (chatSessions.length === 0) {
      return (
        <div className="text-center py-8 text-[10px] text-zinc-400 font-bold uppercase tracking-wider">
          No past chats
        </div>
      );
    }

    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const groups: { [key: string]: DecryptedSession[] } = {
      Today: [],
      Yesterday: [],
      "Previous 7 Days": [],
      Older: []
    };

    chatSessions.forEach(s => {
      const date = new Date(s.last_activity);
      if (date.toDateString() === today.toDateString()) {
        groups.Today.push(s);
      } else if (date.toDateString() === yesterday.toDateString()) {
        groups.Yesterday.push(s);
      } else if (date >= sevenDaysAgo) {
        groups["Previous 7 Days"].push(s);
      } else {
        groups.Older.push(s);
      }
    });

    return Object.entries(groups).map(([groupName, items]) => {
      if (items.length === 0) return null;

      return (
        <div key={groupName} className="space-y-1 mt-4">
          <p className="px-3 text-[8px] font-black uppercase tracking-widest text-zinc-400 dark:text-zinc-600 mb-2">
            {groupName}
          </p>
          {items.map(s => (
            <div 
              key={s.session_id}
              onClick={() => {
                hasLoadedInitialSessionRef.current = true;
                setCurrentSessionId(s.session_id);
                setCurrentSessionTitle(s.session_title);
                setTimeout(() => inputRef.current?.focus(), 50);
              }}
              className={cn(
                "group flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold cursor-pointer transition-colors relative overflow-hidden",
                currentSessionId === s.session_id
                  ? "bg-zinc-100 dark:bg-zinc-900 text-zinc-950 dark:text-zinc-50"
                  : "text-zinc-500 hover:bg-zinc-50 dark:hover:bg-zinc-950 hover:text-zinc-900 dark:hover:text-zinc-100"
              )}
            >
              <div className="flex items-center gap-2 truncate pr-6">
                <MessageSquare className="h-3.5 w-3.5 shrink-0 text-zinc-400" />
                <span className="truncate">{s.session_title}</span>
              </div>
              <button 
                onClick={(e) => handleDeleteSession(s.session_id, e)}
                className="opacity-0 group-hover:opacity-100 h-6 w-6 rounded-lg flex items-center justify-center text-zinc-400 hover:text-red-500 hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-all absolute right-2 top-1/2 -translate-y-1/2"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      );
    });
  };

  if (!isAuth) return null;

  return (
    <div 
      className={cn("flex h-screen w-full overflow-hidden transition-colors duration-500", THEME_STYLES[appearance.theme] || THEME_STYLES.zinc)}
      style={{ fontFamily: `var(--${appearance.fontFamily})` }}
    >
      <Sidebar open={sidebarOpen} onToggle={() => setSidebarOpen(!sidebarOpen)} />
      
      <main className="flex-1 flex relative overflow-hidden h-full">
        {/* ChatGPT Style History Sidebar */}
        <AnimatePresence>
          {chatSidebarOpen && (
            <motion.div 
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 260, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={{ duration: 0.3, type: "spring", bounce: 0.1 }}
              className="h-full border-r border-zinc-200 dark:border-zinc-800 bg-[#f9f9f8]/60 dark:bg-[#141414]/60 backdrop-blur-md flex flex-col shrink-0 overflow-hidden z-20"
            >
              <div className="p-4 flex items-center justify-between border-b border-zinc-100 dark:border-zinc-900 shrink-0">
                <span className="text-[9px] font-black uppercase tracking-widest text-zinc-400">Chat History</span>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-7 w-7 text-zinc-400 rounded-full hover:bg-zinc-200 dark:hover:bg-zinc-800"
                  onClick={() => setChatSidebarOpen(false)}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
              </div>

              {/* New Chat Button */}
              <div className="p-3 shrink-0">
                <Button 
                  onClick={handleNewChat}
                  variant="outline" 
                  className="w-full h-10 rounded-xl text-xs font-bold uppercase tracking-wider bg-transparent border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100/50 dark:hover:bg-zinc-900/50"
                >
                  <Plus className="h-4 w-4 mr-2" /> New Chat
                </Button>
              </div>

              {/* Scrollable Conversations List */}
              <div className="flex-1 overflow-y-auto px-2 pb-4 space-y-2 custom-scrollbar">
                {renderSessionsGroup()}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Main Conversation Feed */}
        <div className="flex-1 flex flex-col relative overflow-hidden h-full min-w-0">
          {/* Collapsible Toggles */}
          <div className="absolute left-4 top-4 z-10 flex gap-2">
            {!sidebarOpen && (
              <Button variant="ghost" size="icon" className="h-10 w-10 text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-950 rounded-xl shadow-sm border border-zinc-100 dark:border-zinc-900 bg-white/50 dark:bg-black/50 backdrop-blur-sm" onClick={() => setSidebarOpen(true)}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            )}
            {!chatSidebarOpen && (
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-10 w-10 text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-950 rounded-xl shadow-sm border border-zinc-100 dark:border-zinc-900 bg-white/50 dark:bg-black/50 backdrop-blur-sm" 
                onClick={() => setChatSidebarOpen(true)}
              >
                <MessageSquare className="h-4 w-4" />
              </Button>
            )}
          </div>

          <div className="absolute right-4 top-4 z-10 flex gap-2">
            <Button onClick={generateProfile} disabled={isGeneratingProfile} variant="outline" size="sm" className="h-10 px-3 lg:px-4 text-xs font-medium text-zinc-900 dark:text-zinc-100 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white/50 dark:bg-black/50 backdrop-blur-sm hover:bg-zinc-100 dark:hover:bg-zinc-900">
              <RefreshCw className={cn("h-4 w-4 lg:mr-2", isGeneratingProfile && "animate-spin")} /> <span className="hidden lg:inline">Update AI Knowledge</span>
            </Button>
          </div>

          <div className="flex-1 flex flex-col max-w-4xl mx-auto w-full p-4 pt-20 lg:p-6 lg:pt-28 h-full">
            <div className="mb-4">
              <h1 className="text-3xl lg:text-4xl font-black tracking-tight mb-1 flex items-center gap-3">
                Dainiki Companion <Sparkles className="h-5 w-5 text-amber-500" />
              </h1>
              <p className="text-[9px] font-bold uppercase tracking-[0.4em] text-zinc-400">
                {currentSessionId ? `Conversation: ${currentSessionTitle}` : "Your private, E2E encrypted listener"}
              </p>
            </div>

            {/* Premium AI Mindset Profile Collapsible Card */}
            <div className="mb-4 border border-zinc-200 dark:border-zinc-800 rounded-xl bg-zinc-50/10 dark:bg-zinc-950/10 overflow-hidden shadow-sm transition-all">
              <button 
                onClick={() => setIsMindsetCollapsed(!isMindsetCollapsed)}
                className="w-full px-4 py-2.5 flex items-center justify-between text-left focus:outline-none"
              >
                <div className="flex items-center gap-2">
                  <Sparkles className="h-3.5 w-3.5 text-indigo-500 animate-pulse" />
                  <span className="text-[10px] font-black uppercase tracking-wider text-zinc-600 dark:text-zinc-400">
                    AI Mindset Profile (Last 10 Days)
                  </span>
                </div>
                <div className="flex items-center gap-1.5 text-[9px] text-zinc-400 font-bold uppercase tracking-widest">
                  <span>{profile ? "Show summary" : "No summary"}</span>
                  <ChevronRight className={cn("h-3.5 w-3.5 transition-transform duration-300", !isMindsetCollapsed && "rotate-90")} />
                </div>
              </button>

              {!isMindsetCollapsed && (
                <div className="p-4 border-t border-zinc-100 dark:border-zinc-900 bg-white/40 dark:bg-black/40 text-xs leading-relaxed text-zinc-600 dark:text-zinc-400">
                  {isGeneratingProfile ? (
                    <div className="flex items-center gap-2 text-zinc-400 animate-pulse uppercase tracking-wider font-bold text-[9px]">
                      <RefreshCw className="h-3.5 w-3.5 animate-spin" /> Dainiki is analyzing mood trends...
                    </div>
                  ) : profile ? (
                    <div className="prose prose-zinc dark:prose-invert prose-sm max-w-none text-zinc-700 dark:text-zinc-300">
                      <div dangerouslySetInnerHTML={{ __html: formatMarkdown(profile) }} />
                    </div>
                  ) : (
                    <div className="py-2 text-center">
                      <p className="text-zinc-400 font-bold uppercase tracking-widest text-[9px] mb-2">No AI Mindset summary created yet</p>
                      <Button 
                        size="sm" 
                        variant="outline" 
                        className="h-8 rounded-lg text-[9px] font-bold uppercase tracking-wider bg-transparent"
                        onClick={generateProfile}
                      >
                        <RefreshCw className="h-3 w-3 mr-1.5" /> Analyze Mindset
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Conversation Feed */}
            <div 
              ref={scrollRef}
              className="flex-1 overflow-y-auto custom-scrollbar mb-4 lg:mb-6 space-y-6 pr-2 lg:pr-4 min-h-0"
            >
              {messages.length === 0 && (
                <div className="h-full flex flex-col items-center justify-center opacity-50 text-center space-y-4 px-4 py-12">
                  <Bot className="h-12 w-12 text-zinc-300 dark:text-zinc-700 stroke-[1.5]" />
                  <div>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 font-bold uppercase tracking-wider">
                      {currentSessionId ? `Start of conversation in "${currentSessionTitle}"` : "Dainiki Companion"}
                    </p>
                    <p className="text-[9px] text-zinc-400 dark:text-zinc-600 mt-1 uppercase tracking-widest">
                      Say hello to start the discussion
                    </p>
                  </div>
                </div>
              )}

              {messages.map((msg, index) => (
                <div 
                  key={index}
                  className={cn(
                    "flex gap-3 text-sm p-4 rounded-xl border max-w-[85%] shadow-sm transition-colors",
                    msg.role === "user" 
                      ? "ml-auto bg-zinc-50 dark:bg-zinc-950 border-zinc-150 dark:border-zinc-900" 
                      : "mr-auto bg-zinc-50/40 dark:bg-zinc-950/40 border-zinc-100 dark:border-zinc-900"
                  )}
                >
                  <div className="shrink-0 mt-0.5">
                    {msg.role === "user" ? (
                      <div className="h-6 w-6 rounded-lg bg-zinc-100 dark:bg-zinc-900 flex items-center justify-center border border-zinc-200 dark:border-zinc-800">
                        <UserIcon className="h-3.5 w-3.5 text-zinc-500 dark:text-zinc-400" />
                      </div>
                    ) : (
                      <div className="h-6 w-6 rounded-lg bg-indigo-500/10 dark:bg-indigo-500/20 flex items-center justify-center border border-indigo-500/20">
                        <Bot className="h-3.5 w-3.5 text-indigo-500" />
                      </div>
                    )}
                  </div>
                  <div className="space-y-1.5 flex-1 min-w-0">
                    <p className="text-[9px] font-black uppercase tracking-widest text-zinc-400">
                      {msg.role === "user" ? "You" : "Dainiki"}
                    </p>
                    <div 
                      className="prose prose-zinc dark:prose-invert prose-sm max-w-none text-zinc-800 dark:text-zinc-200 leading-relaxed text-xs"
                      dangerouslySetInnerHTML={{ __html: formatMarkdown(msg.content) }}
                    />
                  </div>
                </div>
              ))}

              {isLoading && messages[messages.length - 1]?.role !== "ai" && (
                <div className="flex gap-3 text-sm mr-auto bg-zinc-50/40 dark:bg-zinc-950/40 border border-zinc-100 dark:border-zinc-900 p-4 rounded-xl max-w-[85%] shadow-sm animate-pulse">
                  <div className="shrink-0 mt-0.5">
                    <div className="h-6 w-6 rounded-lg bg-indigo-500/10 dark:bg-indigo-500/20 flex items-center justify-center border border-indigo-500/20 animate-spin">
                      <Sparkles className="h-3.5 w-3.5 text-indigo-500" />
                    </div>
                  </div>
                  <div className="space-y-1.5 flex-1 min-w-0">
                    <p className="text-[9px] font-black uppercase tracking-widest text-zinc-400">
                      Dainiki is typing...
                    </p>
                    <p className="text-xs text-zinc-400 font-medium animate-pulse">...</p>
                  </div>
                </div>
              )}
            </div>

            {/* Input Form */}
            <div className="flex gap-2 shrink-0">
              <Input
                ref={inputRef}
                placeholder={currentSessionId ? "Message Dainiki..." : "Send a message to start a new chat..."}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSend()}
                className="h-12 bg-zinc-50 dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800 rounded-xl focus:ring-1 text-xs px-4"
              />
              <Button 
                onClick={handleSend}
                disabled={isLoading || !input.trim()}
                className="h-12 w-12 rounded-xl"
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
