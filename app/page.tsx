"use client";

import { useAuth } from "@/contexts/auth-context";
import { useSettings } from "@/contexts/settings-context";
import { useState, useEffect, useCallback, useRef } from "react";
import { Editor } from "@/components/editor";
import { saveEntry, getAllEntries, deleteEntry, fetchMoods, saveMood, createHistoryItem, getAiHistory, updateAiHistoryStatus, clearAiHistory, getSingleEntry, restoreEntry, toggleArchive } from "@/lib/actions/journal";
import { deductAiCredit } from "@/lib/actions/auth";
import { motion, AnimatePresence } from "framer-motion";
import { Search, Plus, Hash, Smile, Sparkles, AlertCircle, Zap, X, Trash2, Download, Archive, ArchiveRestore, ChevronRight, LayoutDashboard, Palette, Bot, ShieldCheck, Check } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { format } from "date-fns";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn, formatMarkdown } from "@/lib/utils";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AiLoading } from "@/components/ai-loading";
import { encrypt, decrypt } from "@/lib/crypto";
import { Sidebar } from "@/components/sidebar";
import LandingPage from "./landing/page";
import TurndownService from "turndown";
import { useRouter, useSearchParams } from "next/navigation";

interface Entry {
  id: number;
  title: string;
  content: string;
  mood_id?: number;
  mood_name?: string;
  mood_emoji?: string;
  created_at: string;
  is_deleted?: boolean;
  is_archived?: boolean;
  ai_summary?: string | null;
  ai_reflection?: string | null;
  ai_format?: string | null;
  ai_history?: string | null;
}

export interface AiHistoryItem {
  id: string;
  feature: "summarize" | "format" | "reflect";
  content: string;
  created_at: string;
  status?: "pending" | "applied" | "discarded";
}

interface Mood {
  id: number;
  name: string;
  emoji: string;
}

const THEME_STYLES: Record<string, string> = {
  zinc: "text-zinc-900 dark:text-zinc-100",
  rose: "bg-[#fff1f2] dark:bg-[#4c0519] text-[#9f1239] dark:text-[#fff1f2]",
  slate: "bg-[#f8fafc] dark:bg-[#0f172a] text-[#1e293b] dark:text-[#f1f5f9]",
  velvet: "bg-[#faf5ff] dark:bg-[#3b0764] text-[#7e22ce] dark:text-[#faf5ff]"
};

export default function JournalPage() {
  const { isAuth, user, encryptionKey, setCredits } = useAuth();
  const { appearance } = useSettings();
  const router = useRouter();
  const searchParams = useSearchParams();
  
  const [entries, setEntries] = useState<Entry[]>([]);
  const [moods, setMoods] = useState<Mood[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [view, setView] = useState<"active" | "archived" | "deleted">("active");
  const [content, setContent] = useState("");
  const [title, setTitle] = useState("");
  const [moodId, setMoodId] = useState<number | undefined>(undefined);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  
  // Persisted AI feature values loaded from entry
  const [entryAiSummary, setEntryAiSummary] = useState<string | null>(null);
  const [entryAiReflection, setEntryAiReflection] = useState<string | null>(null);
  const [entryAiFormat, setEntryAiFormat] = useState<string | null>(null);
  const [entryAiHistory, setEntryAiHistory] = useState<AiHistoryItem[]>([]);
  const [showAiHistoryPanel, setShowAiHistoryPanel] = useState(false);
  const [aiHistoryTab, setAiHistoryTab] = useState<"summarize" | "format" | "reflect">("summarize");

  // States for active streaming
  const [streamingFeature, setStreamingFeature] = useState<"summarize" | "reflect" | "format" | null>(null);
  const [streamingText, setStreamingText] = useState<string>("");

  const [isQuickEntryOpen, setIsQuickEntryOpen] = useState(false);
  const [quickEntryContent, setQuickEntryContent] = useState("");
  
  const [isAddingMood, setIsAddingMood] = useState(false);
  const [newMoodName, setNewMoodName] = useState("");
  const [newMoodEmoji, setNewMoodEmoji] = useState("😊");
  
  const lastSavedRef = useRef({ title: "", content: "", moodId: undefined as number | undefined });

  const handleSelect = useCallback(async (entry: Entry, keepPanelOpen = false) => {
    setSelectedId(entry.id);
    setTitle(entry.title || "");
    setContent(entry.content || "");
    setMoodId(entry.mood_id);
    setSelectedDate(new Date(entry.created_at));
    
    // Set decrypted AI insights
    setEntryAiSummary(entry.ai_summary || null);
    setEntryAiReflection(entry.ai_reflection || null);
    setEntryAiFormat(entry.ai_format || null);
    
    // Reset streaming
    setStreamingFeature(null);
    setStreamingText("");
    if (!keepPanelOpen) {
      setShowAiHistoryPanel(false);
    }
    
    lastSavedRef.current = { title: entry.title || "", content: entry.content || "", moodId: entry.mood_id };

    // Fetch and decrypt history items
    if (entry.id && encryptionKey && user?.salt) {
      try {
        const rawHistory = await getAiHistory(entry.id);
        const decryptedHistory = await Promise.all(rawHistory.map(async (item) => {
          try {
            const decContent = await decrypt(item.content, encryptionKey, user.salt!);
            return {
              ...item,
              content: decContent
            } as AiHistoryItem;
          } catch (e) {
            return {
              ...item,
              content: "🔒 Decryption Failed"
            } as AiHistoryItem;
          }
        }));
        setEntryAiHistory(decryptedHistory);
      } catch (err) {
        console.error("Failed to load AI history:", err);
        setEntryAiHistory([]);
      }
    } else {
      setEntryAiHistory([]);
    }
  }, [encryptionKey, user]);

  const handleCreateMood = async () => {
    if (!newMoodName.trim() || !newMoodEmoji.trim()) return;
    try {
      await saveMood(newMoodName.trim(), newMoodEmoji.trim());
      const m = await fetchMoods();
      setMoods(m as unknown as Mood[]);
      setIsAddingMood(false);
      setNewMoodName("");
      setNewMoodEmoji("😊");
    } catch (err) {
      console.error("Failed to create mood:", err);
    }
  };

  const loadEntries = useCallback(async () => {
    if (!user || !encryptionKey || !user.salt) return;
    try {
      const data = await getAllEntries({ view });
      const decryptedEntries = await Promise.all(data.map(async (e) => {
        try {
          const dTitle = await decrypt(e.title, encryptionKey, user.salt);
          const dContent = await decrypt(e.content, encryptionKey, user.salt);
          
          let dSummary: string | null = null;
          let dReflection: string | null = null;
          let dFormat: string | null = null;
          
          if (e.ai_summary) dSummary = await decrypt(e.ai_summary, encryptionKey, user.salt);
          if (e.ai_reflection) dReflection = await decrypt(e.ai_reflection, encryptionKey, user.salt);
          if (e.ai_format) dFormat = await decrypt(e.ai_format, encryptionKey, user.salt);
          
          return { 
            ...e, 
            title: dTitle, 
            content: dContent,
            ai_summary: dSummary,
            ai_reflection: dReflection,
            ai_format: dFormat
          } as Entry;
        } catch (err) {
          return { ...e, title: "🔒 Decryption Failed", content: "" } as Entry;
        }
      }));

      setEntries(decryptedEntries);
      const urlId = searchParams.get("id");
      if (urlId) {
        const idNum = Number(urlId);
        const found = decryptedEntries.find(e => e.id === idNum);
        if (found) {
          handleSelect(found, found.id === selectedId);
        } else {
          const e = await getSingleEntry(idNum);
          if (e) {
            try {
              const dTitle = await decrypt(e.title, encryptionKey, user.salt);
              const dContent = await decrypt(e.content, encryptionKey, user.salt);
              
              let dSummary: string | null = null;
              let dReflection: string | null = null;
              let dFormat: string | null = null;
              
              if (e.ai_summary) dSummary = await decrypt(e.ai_summary, encryptionKey, user.salt);
              if (e.ai_reflection) dReflection = await decrypt(e.ai_reflection, encryptionKey, user.salt);
              if (e.ai_format) dFormat = await decrypt(e.ai_format, encryptionKey, user.salt);
              
              handleSelect({ 
                ...e, 
                title: dTitle, 
                content: dContent,
                ai_summary: dSummary,
                ai_reflection: dReflection,
                ai_format: dFormat
              } as Entry, e.id === selectedId);
            } catch (err) {
              handleSelect({ ...e, title: "🔒 Decryption Failed", content: "" }, e.id === selectedId);
            }
          }
        }
      } else if (decryptedEntries.length > 0 && !selectedId) {
        const today = new Date().toDateString();
        const lastEntryDate = new Date(decryptedEntries[0].created_at).toDateString();
        if (today !== lastEntryDate) {
          handleNewEntry();
        } else {
          handleSelect(decryptedEntries[0], decryptedEntries[0].id === selectedId);
        }
      }
    } catch (error) {
      console.error("Failed to load entries:", error);
    }
  }, [user, encryptionKey, view, selectedId, searchParams, handleSelect]);

  useEffect(() => {
    const v = searchParams.get("view");
    if (v === "archived" || v === "deleted") {
      setView(v);
    } else {
      setView("active");
    }
  }, [searchParams]);

  useEffect(() => {
    if (user && encryptionKey && user.salt) loadEntries();
    fetchMoods().then((m) => setMoods(m as unknown as Mood[]));
    
    if (searchParams.get("action") === "quick-entry") setIsQuickEntryOpen(true);
  }, [user, encryptionKey, view, loadEntries, searchParams]);

  const handleAutoSave = useCallback(async () => {
    if (!user || !encryptionKey || view !== "active" || !user.salt) return;
    
    // Don't save if nothing changed
    if (title === lastSavedRef.current.title && content === lastSavedRef.current.content && moodId === lastSavedRef.current.moodId) {
      return;
    }

    // Safety check for decryption failure
    if (selectedId) {
       const existing = entries.find(e => e.id === selectedId);
       if (existing?.title === "🔒 Decryption Failed") return;
    }

    const safeContent = content || "";
    const safeTitle = title || "";
    if (!safeContent.trim() && !safeTitle.trim()) return;
    
    const currentTitle = safeTitle || "Untitled " + format(new Date(), "MMM d, yyyy");
    
    setIsSaving(true);
    try {
      const encryptedTitle = await encrypt(currentTitle, encryptionKey, user.salt);
      const encryptedContent = await encrypt(safeContent, encryptionKey, user.salt);

      const res = await saveEntry({ id: selectedId || undefined, title: encryptedTitle, content: encryptedContent, mood_id: moodId });
      if (!selectedId && res) setSelectedId(res);
      
      lastSavedRef.current = { title: safeTitle, content: safeContent, moodId };
      
      const data = await getAllEntries({ view });
      const decryptedEntries = await Promise.all(data.map(async (e) => {
        try {
          const dTitle = await decrypt(e.title, encryptionKey, user.salt);
          const dContent = await decrypt(e.content, encryptionKey, user.salt);
          return { ...e, title: dTitle, content: dContent } as Entry;
        } catch {
          return { ...e, title: "🔒 Decryption Failed", content: "" } as Entry;
        }
      }));
      setEntries(decryptedEntries);
    } catch (err) {
      console.error("Auto-save failed", err);
    } finally {
      setIsSaving(false);
    }
  }, [user, encryptionKey, view, content, title, moodId, selectedId, entries]);

  // Debounced Auto-Save
  useEffect(() => {
    const timer = setTimeout(() => handleAutoSave(), 2000);
    return () => clearTimeout(timer);
  }, [content, title, moodId, handleAutoSave]);

  const scrollContainerRef = useRef<HTMLDivElement | null>(null);

  // Auto-scroll AI history panel to the bottom when streaming or changing tabs
  useEffect(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight;
    }
  }, [streamingText, entryAiHistory, aiHistoryTab]);

  const handleNewEntry = () => {
    setSelectedId(null);
    setTitle("");
    setContent("");
    setMoodId(undefined);
    setSelectedDate(new Date());
    setEntryAiSummary(null);
    setEntryAiReflection(null);
    setEntryAiFormat(null);
    setStreamingFeature(null);
    setStreamingText("");
  };

  const handleDelete = async (id: number) => {
    await deleteEntry(id);
    if (selectedId === id) handleNewEntry();
    loadEntries();
  };

  const handleHardDelete = async (id: number) => {
    await deleteEntry(id, true);
    if (selectedId === id) handleNewEntry();
    loadEntries();
  };

  const handleRestore = async (id: number) => {
    await restoreEntry(id);
    loadEntries();
  };

  const handleToggleArchive = async (id: number, currentStatus?: boolean) => {
    await toggleArchive(id, !currentStatus);
    if (selectedId === id) handleNewEntry();
    loadEntries();
  };

  const handleExport = (format: "md") => {
    if (!content) return;
    const entryTitle = title || "Untitled";
    const turndownService = new TurndownService();
    const markdown = turndownService.turndown(content);
    const fullContent = `# ${entryTitle}\n\n*${new Date(selectedDate || Date.now()).toLocaleDateString()}*\n\n${markdown}`;
    const blob = new Blob([fullContent], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${entryTitle}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleAiAssist = async (type: "summarize" | "format" | "reflect") => {
    if (!content) return;
    const creditRes = await deductAiCredit();
    if (!creditRes.success) {
      setAiError(creditRes.error || "No credits remaining");
      setTimeout(() => setAiError(null), 5000);
      return;
    }
    if (setCredits) setCredits(creditRes.remaining ?? 0);

    setIsAiLoading(true);
    setAiError(null);
    setStreamingFeature(type);
    setStreamingText("");

    // Open floating history panel and focus/switch to the correct tab
    setShowAiHistoryPanel(true);
    setAiHistoryTab(type);
    
    try {
      // 1. If entry is new, save it first to get an ID so we can associate history items
      let currentEntryId = selectedId;
      if (!currentEntryId) {
        const currentTitle = title || "Untitled " + format(selectedDate || new Date(), "MMM d, yyyy");
        const eTitle = await encrypt(currentTitle, encryptionKey!, user!.salt);
        const eContent = await encrypt(content, encryptionKey!, user!.salt);
        
        const newId = await saveEntry({
          title: eTitle,
          content: eContent,
          mood_id: moodId,
        });
        if (newId) {
          currentEntryId = newId;
          setSelectedId(newId);
          router.replace(`/?id=${newId}`);
        } else {
          throw new Error("Could not save entry to generate AI assist");
        }
      }

      let prompt = "";
      if (type === "summarize") {
        prompt = `Summarize this journal entry in 2-3 sentences. Be practical and grounded: ${content.replace(/<[^>]*>?/gm, '')}`;
      } else if (type === "format") {
        prompt = `Rewrite this journal entry to be more polished and emotionally resonant, but keep my original tone. Use Markdown for structure (paragraphs, bold, lists). Entry: ${content.replace(/<[^>]*>?/gm, '')}`;
      } else {
        prompt = `You are a wise, empathetic reflection partner. Read this journal entry and ask 1-2 deep, open-ended questions that help the writer explore their emotions or situation further. Be concise and supportive. Entry: ${content.replace(/<[^>]*>?/gm, '')}`;
      }
      
      const response = await fetch("/api/ai", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ prompt, feature: type }) });
      if (!response.ok) throw new Error(await response.text() || "AI failed to respond");

      const reader = response.body?.getReader();
      if (!reader) throw new Error("No response stream");

      const decoder = new TextDecoder();
      let fullResponse = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value);
        fullResponse += chunk;
        setStreamingText(prev => prev + chunk);
      }

      // 2. Encrypt and save to database in entry_ai_history
      const encryptedValue = await encrypt(fullResponse, encryptionKey!, user!.salt);
      const insertId = await createHistoryItem(currentEntryId, type, encryptedValue, type === "format" ? "pending" : undefined);

      // 3. Append to local history list state
      const newItem: AiHistoryItem = {
        id: String(insertId),
        feature: type,
        content: fullResponse,
        created_at: new Date().toISOString(),
        status: type === "format" ? "pending" : undefined
      };
      setEntryAiHistory(prev => [...prev, newItem]);

      // 4. Update legacy columns for backward compatibility
      const currentTitle = title || "Untitled " + format(selectedDate || new Date(), "MMM d, yyyy");
      const eTitle = await encrypt(currentTitle, encryptionKey!, user!.salt);
      const eContent = await encrypt(content, encryptionKey!, user!.salt);
      
      const updateData: any = {
        id: currentEntryId,
        title: eTitle,
        content: eContent,
        mood_id: moodId || undefined,
      };
      
      if (type === "summarize") {
        updateData.ai_summary = encryptedValue;
        setEntryAiSummary(fullResponse);
      } else if (type === "reflect") {
        updateData.ai_reflection = encryptedValue;
        setEntryAiReflection(fullResponse);
      } else if (type === "format") {
        updateData.ai_format = encryptedValue;
        setEntryAiFormat(fullResponse);
      }
      await saveEntry(updateData);
      loadEntries();
      
    } catch (err: any) {
      setAiError(err.message || "AI failed to respond");
      setTimeout(() => setAiError(null), 5000);
    } finally {
      setIsAiLoading(false);
      setStreamingFeature(null);
      setStreamingText("");
    }
  };

  const handleDiscardAi = () => {
    setStreamingFeature(null);
    setStreamingText("");
  };

  const handleQuickEntrySave = async () => {
    if (!quickEntryContent.trim() || !user || !encryptionKey || !user.salt) return;
    const encryptedTitle = await encrypt("Quick Entry " + format(new Date(), "HH:mm"), encryptionKey, user.salt);
    const encryptedContent = await encrypt(`<p>${quickEntryContent}</p>`, encryptionKey, user.salt);
    await saveEntry({ title: encryptedTitle, content: encryptedContent });
    setQuickEntryContent("");
    setIsQuickEntryOpen(false);
    loadEntries();
  };

  const handleApplyHistoryItem = async (id: string) => {
    const item = entryAiHistory.find(h => h.id === id);
    if (!item || item.feature !== "format") return;
    
    let formattedSuggestion = formatMarkdown(item.content);
    setContent(formattedSuggestion);
    setEntryAiFormat(item.content);
    
    // Mark as applied in state
    setEntryAiHistory(prev => prev.map(h => h.id === id ? { ...h, status: "applied" } : h));
    
    if (selectedId) {
      setEntries(prev => prev.map(e => e.id === selectedId ? { ...e, content: formattedSuggestion } : e));
    }
    
    await updateAiHistoryStatus(Number(id), "applied");
    
    const currentTitle = title || "Untitled " + format(selectedDate || new Date(), "MMM d, yyyy");
    const eTitle = await encrypt(currentTitle, encryptionKey!, user!.salt);
    const eContent = await encrypt(formattedSuggestion, encryptionKey!, user!.salt);
    const eFormat = await encrypt(item.content, encryptionKey!, user!.salt);
    
    await saveEntry({
      id: selectedId || undefined,
      title: eTitle,
      content: eContent,
      mood_id: moodId || undefined,
      ai_format: eFormat
    });
    
    loadEntries();
  };

  const handleDiscardHistoryItem = async (id: string) => {
    setEntryAiHistory(prev => prev.map(h => h.id === id ? { ...h, status: "discarded" } : h));
    await updateAiHistoryStatus(Number(id), "discarded");
  };

  const handleInsertInEditor = (text: string) => {
    const formatted = formatMarkdown(text);
    setContent(prev => {
      const cleaned = (prev || "").trim();
      if (!cleaned || cleaned === "<p></p>" || cleaned === "<p><br></p>") {
        return formatted;
      }
      return prev + "<br/>" + formatted;
    });
  };

  const [copiedId, setCopiedId] = useState<string | null>(null);
  const handleCopyToClipboard = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  if (!isAuth) return <LandingPage />;

  const selectedMood = moods.find(m => m.id === moodId);

  return (
    <div 
      className={cn("flex h-screen w-full overflow-hidden transition-colors duration-500", THEME_STYLES[appearance.theme] || THEME_STYLES.zinc)}
      style={{ fontFamily: `var(--${appearance.fontFamily})` }}
    >
      <Dialog open={isQuickEntryOpen} onOpenChange={setIsQuickEntryOpen}>
        <DialogContent className="sm:max-w-[500px] rounded-xl border-zinc-100 dark:border-zinc-900 shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold tracking-tight">Quick Reflection</DialogTitle>
            <DialogDescription className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">Capture this moment instantly</DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <textarea
              placeholder="What's on your mind right now?"
              value={quickEntryContent}
              onChange={(e) => setQuickEntryContent(e.target.value)}
              className={cn("w-full h-32 bg-zinc-50 dark:bg-zinc-900 border-none rounded-xl p-4 text-sm focus:ring-1 focus:ring-zinc-200 dark:focus:ring-zinc-800 outline-none resize-none", appearance.fontFamily)}
            />
            <Button className="w-full h-11 rounded-xl font-bold uppercase tracking-widest text-xs" onClick={handleQuickEntrySave}>Save Thought</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Sidebar open={sidebarOpen} onToggle={() => setSidebarOpen(!sidebarOpen)} />

      <main className="flex-1 flex flex-col relative bg-white dark:bg-black transition-colors duration-500 min-w-0">
        {!sidebarOpen && (
          <Button variant="ghost" size="icon" className="absolute left-4 top-4 lg:left-6 lg:top-6 z-10 h-10 w-10 text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-950 rounded-xl shadow-sm border border-zinc-100 dark:border-zinc-900" onClick={() => setSidebarOpen(true)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        )}

        <div className="absolute right-4 top-4 lg:right-6 lg:top-6 z-10 flex flex-col items-end gap-2">
          <div className="flex items-center gap-2">
            <Button onClick={handleNewEntry} variant="outline" size="sm" className="h-10 px-3 lg:px-4 text-xs font-medium text-zinc-900 dark:text-zinc-100 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white/50 dark:bg-black/50 backdrop-blur-sm hover:bg-zinc-100 dark:hover:bg-zinc-900">
              <Plus className="h-4 w-4 lg:mr-2" /> <span className="hidden lg:inline">New Entry</span>
            </Button>
            <Popover>
              <PopoverTrigger className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "h-10 px-3 lg:px-4 text-xs font-medium text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 rounded-xl border border-zinc-100 dark:border-zinc-900 bg-white/50 dark:bg-black/50 backdrop-blur-sm")}>
                <Sparkles className={`h-4 w-4 lg:mr-2 ${isAiLoading ? 'animate-pulse' : ''}`} /> <span className="hidden lg:inline">AI Assist</span>
              </PopoverTrigger>
              <PopoverContent className="w-52 p-2 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-black shadow-2xl" align="end">
                <div className="px-2 py-1.5 mb-1 text-[10px] font-bold uppercase tracking-widest text-zinc-400 flex justify-between">
                  <span>Credits</span>
                  <span className="text-zinc-900 dark:text-zinc-100">{user?.credits ?? 0}/10</span>
                </div>
                <Button variant="ghost" className="w-full justify-start text-xs h-9 rounded-lg" onClick={() => handleAiAssist("summarize")}>
                  <LayoutDashboard className="h-3.5 w-3.5 mr-2 text-blue-400" /> Summarize Entry
                </Button>
                <Button variant="ghost" className="w-full justify-start text-xs h-9 rounded-lg" onClick={() => handleAiAssist("format")}>
                  <Palette className="h-3.5 w-3.5 mr-2 text-amber-400" /> Polished Flow
                </Button>
                <Button variant="ghost" className="w-full justify-start text-xs h-9 rounded-lg" onClick={() => handleAiAssist("reflect")}>
                  <Bot className="h-3.5 w-3.5 mr-2 text-purple-400" /> Deep Reflection
                </Button>

                {entryAiHistory.length > 0 && (
                  <>
                    <Separator className="my-1.5 bg-zinc-100 dark:bg-zinc-900" />
                    <div className="px-2 py-1 text-[9px] font-bold uppercase tracking-widest text-zinc-400 dark:text-zinc-600">
                      AI History Log
                    </div>
                    <Button variant="ghost" className="w-full justify-start text-xs h-9 rounded-lg" onClick={() => { setShowAiHistoryPanel(true); setAiHistoryTab("summarize"); }}>
                      <LayoutDashboard className="h-3.5 w-3.5 mr-2 text-zinc-400 dark:text-zinc-600" /> View Summaries
                    </Button>
                    <Button variant="ghost" className="w-full justify-start text-xs h-9 rounded-lg" onClick={() => { setShowAiHistoryPanel(true); setAiHistoryTab("format"); }}>
                      <Palette className="h-3.5 w-3.5 mr-2 text-zinc-400 dark:text-zinc-600" /> View Polished Flows
                    </Button>
                    <Button variant="ghost" className="w-full justify-start text-xs h-9 rounded-lg" onClick={() => { setShowAiHistoryPanel(true); setAiHistoryTab("reflect"); }}>
                      <Bot className="h-3.5 w-3.5 mr-2 text-zinc-400 dark:text-zinc-600" /> View Reflections
                    </Button>
                  </>
                )}
              </PopoverContent>
            </Popover>
          </div>
          <AnimatePresence>{aiError && <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} className="bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-900/30 p-3 rounded-xl flex items-center gap-3 text-red-600 dark:text-red-400 max-w-xs shadow-lg"><AlertCircle className="h-4 w-4 shrink-0" /><p className="text-[10px] font-bold uppercase tracking-wider">{aiError}</p></motion.div>}</AnimatePresence>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar">
          <div className="max-w-3xl mx-auto px-4 py-20 lg:px-16 lg:py-24 min-h-full">
            <AnimatePresence mode="wait">
              {isAiLoading ? (
                <motion.div key="loading" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 1.05 }} className="flex h-[60vh] items-center justify-center">
                  <AiLoading />
                </motion.div>
              ) : (
                <motion.div layoutId="editor-container" key={selectedId || "new"} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, type: "spring", bounce: 0.2 }}>
                  <div className="flex items-center justify-between mb-8 lg:mb-12">
                    <div className="flex items-center gap-3 lg:gap-4 text-zinc-400 text-[10px] font-bold uppercase tracking-[0.2em]">
                      <span>{format(selectedDate || new Date(), "EEEE, MMMM d")}</span>
                      <Separator orientation="vertical" className="h-3 bg-zinc-200 dark:bg-zinc-800" />
                      <Popover>
                        <PopoverTrigger className="hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors flex items-center gap-2 group text-[10px] font-bold uppercase tracking-[0.2em]">
                          <Smile className="h-4 w-4 transition-transform group-hover:scale-110" />
                          <span className="max-w-[80px] truncate">{selectedMood ? `${selectedMood.emoji} ${selectedMood.name}` : "Set Mood"}</span>
                        </PopoverTrigger>
                        <PopoverContent className="w-64 p-3 rounded-xl border-zinc-100 dark:border-zinc-900 shadow-2xl" align="start">
                          <AnimatePresence mode="wait">
                            {isAddingMood ? (
                              <motion.div key="add-mood" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-4 p-1">
                                <div className="flex items-center gap-3">
                                  <div className="space-y-1">
                                    <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">Icon</p>
                                    <div className="h-10 w-10 rounded-xl bg-zinc-50 dark:bg-zinc-900 flex items-center justify-center text-xl border border-zinc-100 dark:border-zinc-800">
                                      <input 
                                        value={newMoodEmoji}
                                        onChange={(e) => setNewMoodEmoji(e.target.value)}
                                        className="w-full h-full bg-transparent border-none p-0 text-center focus:ring-0"
                                      />
                                    </div>
                                  </div>
                                  <div className="flex-1 space-y-1">
                                    <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">Mood Name</p>
                                    <input 
                                      autoFocus
                                      value={newMoodName}
                                      onChange={(e) => setNewMoodName(e.target.value)}
                                      placeholder="e.g. Melodic"
                                      className="w-full bg-transparent border-none p-0 h-10 text-sm focus:ring-0 placeholder:text-zinc-300 dark:placeholder:text-zinc-700"
                                    />
                                  </div>
                                </div>
                                
                                <div className="space-y-2">
                                  <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">Quick Emoji</p>
                                  <div className="flex flex-wrap gap-2">
                                    {["🌿", "✨", "🙏", "🚀", "😴", "🎨", "🌈", "🧘", "🎶"].map(e => (
                                      <button key={e} onClick={() => setNewMoodEmoji(e)} className={cn("h-8 w-8 rounded-lg flex items-center justify-center text-lg transition-all", newMoodEmoji === e ? "bg-zinc-100 dark:bg-zinc-800 scale-110" : "hover:bg-zinc-50 dark:hover:bg-zinc-900")}>
                                        {e}
                                      </button>
                                    ))}
                                  </div>
                                </div>

                                <div className="flex gap-2 pt-2">
                                  <Button variant="ghost" className="flex-1 h-9 rounded-lg text-[10px] font-bold uppercase tracking-wider" onClick={() => setIsAddingMood(false)}>Cancel</Button>
                                  <Button className="flex-1 h-9 rounded-lg text-[10px] font-bold uppercase tracking-wider" onClick={handleCreateMood} disabled={!newMoodName.trim()}>Save</Button>
                                </div>
                              </motion.div>
                            ) : (
                              <motion.div key="mood-list" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="space-y-3">
                                <div className="grid grid-cols-3 gap-2">
                                  {moods.map((m) => (
                                    <button key={m.id} onClick={() => { setMoodId(m.id); }} className={cn("flex flex-col items-center gap-1.5 p-3 rounded-xl transition-all", moodId === m.id ? "bg-zinc-100 dark:bg-zinc-900" : "hover:bg-zinc-50 dark:hover:bg-zinc-900/50")}>
                                      <span className="text-xl">{m.emoji}</span>
                                      <span className="text-[10px] font-medium text-zinc-500">{m.name}</span>
                                    </button>
                                  ))}
                                </div>
                                <Separator className="bg-zinc-100 dark:bg-zinc-900" />
                                <Button variant="ghost" className="w-full h-9 rounded-lg text-[10px] font-bold uppercase tracking-widest text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100" onClick={() => setIsAddingMood(true)}>
                                  <Plus className="h-3.5 w-3.5 mr-2" /> Add Custom Mood
                                </Button>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </PopoverContent>
                      </Popover>
                    </div>

                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-[8px] font-black uppercase tracking-[0.2em] text-emerald-600 dark:text-emerald-400">
                      <ShieldCheck className="h-3 w-3" /> E2E Encrypted
                    </div>
                  </div>
                  <input type="text" placeholder="Title your thought..." value={title} onChange={(e) => setTitle(e.target.value)} className={cn("w-full font-bold bg-transparent border-none focus:outline-none placeholder:text-zinc-100 dark:placeholder:text-zinc-900 mb-10 lg:mb-16 tracking-tight transition-all text-3xl lg:text-5xl", appearance.fontFamily)} />
                  <Editor content={content} onChange={setContent} />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>












        <div className="h-16 border-t border-zinc-100 dark:border-zinc-900 bg-white/80 dark:bg-black/80 backdrop-blur-md px-4 lg:px-8 flex items-center justify-between text-[10px] text-zinc-400 uppercase tracking-[0.2em] font-bold z-20">
          <div className="flex items-center gap-4 lg:gap-6">
            <span className="flex items-center gap-2"><Hash className="h-3 w-3" /> {(content || "").replace(/<[^>]*>?/gm, '').split(/\s+/).filter(Boolean).length} <span className="hidden lg:inline">Words</span></span>
            <span className="hidden sm:inline opacity-50">Saved at {format(new Date(), "HH:mm")}</span>
          </div>
          <div className="flex items-center gap-2 lg:gap-4">
             {view === "deleted" ? (
               <div className="flex gap-2">
                 <Button variant="ghost" size="sm" className="h-8 text-[10px] font-bold uppercase tracking-widest text-green-600" onClick={() => selectedId && handleRestore(selectedId)}>Restore</Button>
                 <Button variant="ghost" size="sm" className="h-8 text-[10px] font-bold uppercase tracking-widest text-red-600" onClick={() => selectedId && handleHardDelete(selectedId)}>Delete</Button>
               </div>
             ) : (
               <>
                 <Popover>
                   <PopoverTrigger className={cn(buttonVariants({ variant: "ghost", size: "icon" }), "h-10 w-10 text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 rounded-xl")}>
                     <Download className="h-4 w-4" />
                   </PopoverTrigger>
                   <PopoverContent className="w-32 p-2 rounded-xl border-zinc-100 dark:border-zinc-900 shadow-2xl" align="end" side="top">
                     <Button variant="ghost" className="w-full justify-start text-xs h-9 rounded-lg" onClick={() => handleExport("md")}>Export MD</Button>
                   </PopoverContent>
                 </Popover>
                 
                 <button 
                   className={cn("p-2 hover:bg-zinc-50 dark:hover:bg-zinc-950 rounded-lg transition-all", selectedId && entries.find(e => e.id === selectedId)?.is_archived ? "text-amber-500" : "text-zinc-300 hover:text-amber-500")}
                   onClick={() => {
                     if (selectedId) {
                       const isArchived = entries.find(e => e.id === selectedId)?.is_archived;
                       handleToggleArchive(selectedId, isArchived);
                     }
                   }}
                 >
                   {selectedId && entries.find(e => e.id === selectedId)?.is_archived ? <ArchiveRestore className="h-4 w-4" /> : <Archive className="h-4 w-4" />}
                 </button>
                 
                 <button className="p-2 hover:bg-zinc-50 dark:hover:bg-zinc-950 rounded-lg text-zinc-300 hover:text-red-500 transition-all" onClick={() => selectedId && handleDelete(selectedId)}><Trash2 className="h-4 w-4" /></button>
               </>
             )}
          </div>
        </div>

        <AnimatePresence>
          {(showAiHistoryPanel || streamingFeature !== null) && (
            <motion.div 
              initial={{ opacity: 0, y: 20, scale: 0.95 }} 
              animate={{ opacity: 1, y: 0, scale: 1 }} 
              exit={{ opacity: 0, y: 20, scale: 0.95 }} 
              className="fixed bottom-4 left-4 right-4 md:bottom-24 md:right-8 md:left-auto md:w-[420px] max-h-[80vh] md:max-h-[70vh] border border-zinc-200 dark:border-zinc-800 bg-white/95 dark:bg-zinc-950/95 backdrop-blur-md rounded-xl shadow-2xl flex flex-col z-50 overflow-hidden"
            >
              {/* Header */}
              <div className="p-4 flex items-center justify-between border-b border-zinc-100 dark:border-zinc-900 bg-zinc-50/50 dark:bg-zinc-900/50 shrink-0">
                <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500 dark:text-zinc-400">
                  <Sparkles className="h-3.5 w-3.5 text-indigo-500 animate-pulse" /> 
                  AI Journal Assistant
                </div>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-7 w-7 text-zinc-400 rounded-full hover:bg-zinc-200 dark:hover:bg-zinc-800" 
                  onClick={() => { setShowAiHistoryPanel(false); setStreamingFeature(null); setStreamingText(""); }}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>

              {/* Tabs */}
              <div className="flex border-b border-zinc-100 dark:border-zinc-900 bg-zinc-50/20 dark:bg-zinc-950/20 px-2 pt-1 pb-0 shrink-0">
                <button 
                  onClick={() => setAiHistoryTab("summarize")} 
                  className={cn("flex-1 text-center py-2.5 text-[9px] font-black uppercase tracking-widest border-b-2 transition-all", aiHistoryTab === "summarize" ? "border-zinc-800 dark:border-zinc-200 text-zinc-900 dark:text-zinc-100" : "border-transparent text-zinc-400 hover:text-zinc-600")}
                >
                  Summary
                </button>
                <button 
                  onClick={() => setAiHistoryTab("format")} 
                  className={cn("flex-1 text-center py-2.5 text-[9px] font-black uppercase tracking-widest border-b-2 transition-all", aiHistoryTab === "format" ? "border-zinc-800 dark:border-zinc-200 text-zinc-900 dark:text-zinc-100" : "border-transparent text-zinc-400 hover:text-zinc-600")}
                >
                  Polished
                </button>
                <button 
                  onClick={() => setAiHistoryTab("reflect")} 
                  className={cn("flex-1 text-center py-2.5 text-[9px] font-black uppercase tracking-widest border-b-2 transition-all", aiHistoryTab === "reflect" ? "border-zinc-800 dark:border-zinc-200 text-zinc-900 dark:text-zinc-100" : "border-transparent text-zinc-400 hover:text-zinc-600")}
                >
                  Reflection
                </button>
              </div>

              {/* Scrollable Log */}
              <div 
                ref={scrollContainerRef}
                className="flex-1 overflow-y-auto p-4 min-h-0 custom-scrollbar"
              >
                {entryAiHistory.filter(h => h.feature === aiHistoryTab).length === 0 && streamingFeature !== aiHistoryTab ? (
                  <div className="h-48 flex flex-col items-center justify-center text-center p-6">
                    <Sparkles className="h-8 w-8 text-zinc-300 dark:text-zinc-700 mb-3 stroke-[1.5]" />
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed font-medium">
                      No {aiHistoryTab === "summarize" ? "summaries" : aiHistoryTab === "format" ? "polished versions" : "reflections"} generated yet.
                    </p>
                    <p className="text-[10px] text-zinc-400 dark:text-zinc-600 mt-1 uppercase tracking-wider font-bold">
                      Click AI Assist to create one
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {entryAiHistory
                      .filter(h => h.feature === aiHistoryTab)
                      .map((item) => (
                        <div 
                          key={item.id} 
                          className="border border-zinc-100 dark:border-zinc-900 bg-zinc-50/30 dark:bg-zinc-900/30 rounded-xl p-4 text-left shadow-sm hover:border-zinc-200 dark:hover:border-zinc-800 transition-colors"
                        >
                          <div className="flex items-center justify-between mb-3 text-[9px] font-black uppercase tracking-widest text-zinc-400">
                            <span className="flex items-center gap-1.5">
                              {item.feature === "summarize" ? <LayoutDashboard className="h-3 w-3 text-blue-500" /> : item.feature === "format" ? <Palette className="h-3 w-3 text-amber-500" /> : <Bot className="h-3 w-3 text-purple-500" />}
                              {item.feature === "summarize" ? "Summary" : item.feature === "format" ? "Polished Flow" : "Deep Reflection"}
                            </span>
                            <span>
                              {item.created_at ? format(new Date(item.created_at), "MMM d, h:mm a") : ""}
                            </span>
                          </div>

                          <div className="prose prose-zinc dark:prose-invert prose-sm max-w-none text-zinc-700 dark:text-zinc-300 text-xs leading-relaxed">
                            <div dangerouslySetInnerHTML={{ __html: formatMarkdown(item.content) }} />
                          </div>

                          {/* Card Actions */}
                          {item.feature === "format" && (
                            <div className="mt-3 pt-3 border-t border-zinc-100 dark:border-zinc-900 flex items-center justify-between">
                              {item.status === "applied" ? (
                                <div className="flex items-center gap-1.5 text-[9px] text-emerald-600 dark:text-emerald-400 font-black uppercase tracking-wider">
                                  <Check className="h-3.5 w-3.5 stroke-[3]" /> Applied to Editor
                                </div>
                              ) : item.status === "discarded" ? (
                                <div className="text-[9px] text-zinc-400 dark:text-zinc-600 font-black uppercase tracking-wider">
                                  Discarded
                                </div>
                              ) : (
                                <div className="flex gap-2 w-full">
                                  <Button size="sm" className="h-8 text-[9px] font-bold uppercase tracking-wider flex-1 rounded-lg" onClick={() => handleApplyHistoryItem(item.id)}>Apply Change</Button>
                                  <Button size="sm" variant="outline" className="h-8 text-[9px] font-bold uppercase tracking-wider flex-1 rounded-lg bg-transparent" onClick={() => handleDiscardHistoryItem(item.id)}>Discard</Button>
                                </div>
                              )}
                            </div>
                          )}

                          {(item.feature === "summarize" || item.feature === "reflect") && (
                            <div className="mt-3 pt-3 border-t border-zinc-100 dark:border-zinc-900 flex gap-2 w-full">
                              <Button size="sm" variant="outline" className="h-8 text-[9px] font-bold uppercase tracking-wider flex-1 rounded-lg bg-transparent" onClick={() => handleCopyToClipboard(item.id, item.content)}>
                                {copiedId === item.id ? <span className="text-emerald-600 dark:text-emerald-400">Copied!</span> : "Copy"}
                              </Button>
                              <Button size="sm" variant="outline" className="h-8 text-[9px] font-bold uppercase tracking-wider flex-1 rounded-lg bg-transparent" onClick={() => handleInsertInEditor(item.content)}>Insert</Button>
                            </div>
                          )}
                        </div>
                      ))}
                  </div>
                )}

                {/* Streaming Item Card */}
                {streamingFeature === aiHistoryTab && (
                  <div className="border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50 rounded-xl p-4 text-left shadow-sm animate-pulse mt-4">
                    <div className="flex items-center gap-1.5 mb-3 text-[9px] font-black uppercase tracking-widest text-zinc-400">
                      <Sparkles className="h-3.5 w-3.5 text-indigo-500 animate-spin" />
                      Generating...
                    </div>
                    <div className="prose prose-zinc dark:prose-invert prose-sm max-w-none text-zinc-500 text-xs leading-relaxed">
                      {streamingText === "" ? (
                        <span>Dainiki is contemplating...</span>
                      ) : (
                        <div dangerouslySetInnerHTML={{ __html: formatMarkdown(streamingText) }} />
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="p-4 border-t border-zinc-100 dark:border-zinc-900 bg-zinc-50/50 dark:bg-zinc-900/50 shrink-0 flex items-center justify-between">
                <Button 
                  variant="outline" 
                  className="rounded-lg h-9 text-[9px] font-bold uppercase tracking-wider bg-transparent"
                  onClick={() => { setShowAiHistoryPanel(false); setStreamingFeature(null); setStreamingText(""); }}
                >
                  Close Panel
                </Button>
                <div className="text-[8px] text-zinc-400 font-bold uppercase tracking-widest flex items-center gap-1">
                  <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" /> E2E Encrypted
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
