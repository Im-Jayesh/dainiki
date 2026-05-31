"use client";

import { useAuth } from "@/contexts/auth-context";
import { useSettings } from "@/contexts/settings-context";
import { useState, useEffect, useCallback, useRef } from "react";
import { Editor } from "@/components/editor";
import { saveEntry, getAllEntries, deleteEntry, fetchMoods } from "@/lib/actions/journal";
import { motion, AnimatePresence } from "framer-motion";
import { Search, Plus, Hash, Smile, Sparkles, AlertCircle, Zap, X, Trash2, Download, Archive, ArchiveRestore, ChevronRight } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { format } from "date-fns";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
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
  const [aiSummary, setAiSummary] = useState<string | null>(null);
  const [aiSuggestion, setAiSuggestion] = useState<string | null>(null);
  const [isQuickEntryOpen, setIsQuickEntryOpen] = useState(false);
  const [quickEntryContent, setQuickEntryContent] = useState("");
  
  const lastSavedRef = useRef({ title: "", content: "", moodId: undefined as number | undefined });

  const handleSelect = useCallback((entry: Entry) => {
    setSelectedId(entry.id);
    setTitle(entry.title || "");
    setContent(entry.content || "");
    setMoodId(entry.mood_id);
    setSelectedDate(new Date(entry.created_at));
    setAiSummary(null);
    setAiSuggestion(null);
    lastSavedRef.current = { title: entry.title || "", content: entry.content || "", moodId: entry.mood_id };
  }, []);

  const loadEntries = useCallback(async () => {
    if (!user || !encryptionKey || !user.salt) return;
    try {
      const data = await getAllEntries({ view });
      const decryptedEntries = await Promise.all(data.map(async (e) => {
        try {
          const dTitle = await decrypt(e.title, encryptionKey, user.salt);
          const dContent = await decrypt(e.content, encryptionKey, user.salt);
          return { ...e, title: dTitle, content: dContent } as Entry;
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
          handleSelect(found);
        } else {
          const { getSingleEntry } = await import("@/lib/actions/journal");
          const e = await getSingleEntry(idNum);
          if (e) {
            try {
              const dTitle = await decrypt(e.title, encryptionKey, user.salt);
              const dContent = await decrypt(e.content, encryptionKey, user.salt);
              handleSelect({ ...e, title: dTitle, content: dContent });
            } catch (err) {
              handleSelect({ ...e, title: "🔒 Decryption Failed", content: "" });
            }
          }
        }
      } else if (decryptedEntries.length > 0 && !selectedId) {
        const today = new Date().toDateString();
        const lastEntryDate = new Date(decryptedEntries[0].created_at).toDateString();
        if (today !== lastEntryDate) {
          handleNewEntry();
        } else {
          handleSelect(decryptedEntries[0]);
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

  const handleNewEntry = () => {
    setSelectedId(null);
    setTitle("");
    setContent("");
    setMoodId(undefined);
    setSelectedDate(new Date());
    setAiSummary(null);
    setAiSuggestion(null);
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
    const { restoreEntry } = await import("@/lib/actions/journal");
    await restoreEntry(id);
    loadEntries();
  };

  const handleToggleArchive = async (id: number, currentStatus?: boolean) => {
    const { toggleArchive } = await import("@/lib/actions/journal");
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

  const handleAiAssist = async (type: "summarize" | "format") => {
    if (!content) return;
    const { deductAiCredit } = await import("@/lib/actions/auth");
    const creditRes = await deductAiCredit();
    if (!creditRes.success) {
      setAiError(creditRes.error || "No credits remaining");
      setTimeout(() => setAiError(null), 5000);
      return;
    }
    if (setCredits) setCredits(creditRes.remaining ?? 0);

    setIsAiLoading(true);
    setAiError(null);
    if (type === "summarize") setAiSummary("");
    if (type === "format") setAiSuggestion("");
    
    try {
      const prompt = type === "summarize" 
        ? `Summarize this journal entry in 2-3 sentences. Be profound and reflective: ${content.replace(/<[^>]*>?/gm, '')}`
        : `Rewrite this journal entry to be more polished, well-formatted, and emotionally resonant. Use Markdown for structure (paragraphs, lists). Keep the personal tone: ${content.replace(/<[^>]*>?/gm, '')}`;
      
      const response = await fetch("/api/ai", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ prompt }) });
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
        if (type === "summarize") setAiSummary(prev => (prev || "") + chunk);
        else setAiSuggestion(prev => (prev || "") + chunk);
      }
      
      if (type === "format") {
        const html = fullResponse.split('\n\n').map(p => `<p>${p}</p>`).join('');
        setAiSuggestion(html);
      }
    } catch (err: any) {
      setAiError(err.message || "AI failed to respond");
      setTimeout(() => setAiError(null), 5000);
    } finally {
      setIsAiLoading(false);
    }
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

  const handleApplyAi = async () => {
    if (aiSuggestion) {
      // 1. Format the content properly
      let formattedSuggestion = aiSuggestion;
      if (!formattedSuggestion.includes('<p>') && formattedSuggestion.includes('\n')) {
        formattedSuggestion = formattedSuggestion.split('\n').map(p => `<p>${p}</p>`).join('');
      }
      
      // 2. Update local state immediately
      setContent(formattedSuggestion);
      setAiSuggestion(null);

      // 3. Immediately update the entry in the list to reflect changes in UI
      if (selectedId) {
        setEntries(prev => prev.map(e => e.id === selectedId ? { ...e, content: formattedSuggestion } : e));
      }

      // 4. Force an immediate save to database
      const { saveEntry: saveAction } = await import("@/lib/actions/journal");
      const { encrypt: encAction } = await import("@/lib/crypto");
      const eTitle = await encAction(title, encryptionKey!, user!.salt);
      const eContent = await encAction(formattedSuggestion, encryptionKey!, user!.salt);
      
      await saveAction({
        id: selectedId || undefined,
        title: eTitle,
        content: eContent,
        mood_id: moodId || undefined
      });
    }
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
          <Button variant="ghost" size="icon" className="absolute left-6 top-6 z-10 h-10 w-10 text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-950 rounded-xl shadow-sm border border-zinc-100 dark:border-zinc-900" onClick={() => setSidebarOpen(true)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        )}

        <div className="absolute right-6 top-6 z-10 flex flex-col items-end gap-2">
          <div className="flex items-center gap-2">
            <Button onClick={handleNewEntry} variant="outline" size="sm" className="h-10 px-4 text-xs font-medium text-zinc-900 dark:text-zinc-100 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white/50 dark:bg-black/50 backdrop-blur-sm hover:bg-zinc-100 dark:hover:bg-zinc-900">
              <Plus className="h-4 w-4 mr-2" /> New Entry
            </Button>
            <Popover>
              <PopoverTrigger className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "h-10 px-4 text-xs font-medium text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 rounded-xl border border-zinc-100 dark:border-zinc-900 bg-white/50 dark:bg-black/50 backdrop-blur-sm")}>
                <Sparkles className={`h-4 w-4 mr-2 ${isAiLoading ? 'animate-pulse' : ''}`} /> AI Assist
              </PopoverTrigger>
              <PopoverContent className="w-48 p-2 rounded-xl border-zinc-100 dark:border-zinc-900 shadow-2xl" align="end">
                <div className="px-2 py-1.5 mb-1 text-[10px] font-bold uppercase tracking-widest text-zinc-400 flex justify-between">
                  <span>Credits</span>
                  <span className="text-zinc-900 dark:text-zinc-100">{user?.credits ?? 0}/10</span>
                </div>
                <Button variant="ghost" className="w-full justify-start text-xs h-9 rounded-lg" onClick={() => handleAiAssist("summarize")}>Summarize Entry</Button>
                <Button variant="ghost" className="w-full justify-start text-xs h-9 rounded-lg" onClick={() => handleAiAssist("format")}>Polished Flow</Button>
              </PopoverContent>
            </Popover>
          </div>
          <AnimatePresence>{aiError && <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} className="bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-900/30 p-3 rounded-xl flex items-center gap-3 text-red-600 dark:text-red-400 max-w-xs shadow-lg"><AlertCircle className="h-4 w-4 shrink-0" /><p className="text-[10px] font-bold uppercase tracking-wider">{aiError}</p></motion.div>}</AnimatePresence>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar">
          <div className="max-w-3xl mx-auto px-8 py-24 lg:px-16 min-h-full">
            <AnimatePresence mode="wait">
              {isAiLoading ? (
                <motion.div key="loading" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 1.05 }} className="flex h-[60vh] items-center justify-center">
                  <AiLoading />
                </motion.div>
              ) : (
                <motion.div layoutId="editor-container" key={selectedId || "new"} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, type: "spring", bounce: 0.2 }}>
                  <div className="flex items-center gap-4 text-zinc-400 mb-12 text-[10px] font-bold uppercase tracking-[0.2em]">
                    <span>{format(selectedDate || new Date(), "EEEE, MMMM d")}</span>
                    <Separator orientation="vertical" className="h-3 bg-zinc-200 dark:bg-zinc-800" />
                    <Popover>
                      <PopoverTrigger className="hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors flex items-center gap-2 group text-[10px] font-bold uppercase tracking-[0.2em]">
                        <Smile className="h-4 w-4 transition-transform group-hover:scale-110" />
                        {selectedMood ? `${selectedMood.emoji} ${selectedMood.name}` : "Set Mood"}
                      </PopoverTrigger>
                      <PopoverContent className="w-64 p-3 rounded-xl border-zinc-100 dark:border-zinc-900 shadow-2xl" align="start">
                        <div className="grid grid-cols-3 gap-2">
                          {moods.map((m) => (
                            <button key={m.id} onClick={() => { setMoodId(m.id); }} className={cn("flex flex-col items-center gap-1.5 p-3 rounded-xl transition-all", moodId === m.id ? "bg-zinc-100 dark:bg-zinc-900" : "hover:bg-zinc-50 dark:hover:bg-zinc-900/50")}>
                              <span className="text-xl">{m.emoji}</span>
                              <span className="text-[10px] font-medium text-zinc-500">{m.name}</span>
                            </button>
                          ))}
                        </div>
                      </PopoverContent>
                    </Popover>
                  </div>
                  <input type="text" placeholder="Title your thought..." value={title} onChange={(e) => setTitle(e.target.value)} className={cn("w-full font-bold bg-transparent border-none focus:outline-none placeholder:text-zinc-100 dark:placeholder:text-zinc-900 mb-16 tracking-tight transition-all text-4xl lg:text-5xl", appearance.fontFamily)} />
                  <Editor content={content} onChange={setContent} />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        <div className="h-16 border-t border-zinc-100 dark:border-zinc-900 bg-white/80 dark:bg-black/80 backdrop-blur-md px-8 flex items-center justify-between text-[10px] text-zinc-400 uppercase tracking-[0.2em] font-bold z-20">
          <div className="flex items-center gap-6">
            <span className="flex items-center gap-2"><Hash className="h-3 w-3" /> {(content || "").replace(/<[^>]*>?/gm, '').split(/\s+/).filter(Boolean).length} Words</span>
            <span className="hidden sm:inline opacity-50">Auto-saved at {format(new Date(), "HH:mm")}</span>
          </div>
          <div className="flex items-center gap-4">
             {view === "deleted" ? (
               <div className="flex gap-2">
                 <Button variant="ghost" size="sm" className="h-8 text-[10px] font-bold uppercase tracking-widest text-green-600" onClick={() => selectedId && handleRestore(selectedId)}>Restore</Button>
                 <Button variant="ghost" size="sm" className="h-8 text-[10px] font-bold uppercase tracking-widest text-red-600" onClick={() => selectedId && handleHardDelete(selectedId)}>Delete Forever</Button>
               </div>
             ) : (
               <>
                 <Popover>
                   <PopoverTrigger className={cn(buttonVariants({ variant: "ghost", size: "icon" }), "h-10 w-10 text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 rounded-xl")}>
                     <Download className="h-4 w-4" />
                   </PopoverTrigger>
                   <PopoverContent className="w-32 p-2 rounded-xl border-zinc-100 dark:border-zinc-900 shadow-2xl" align="end" side="top">
                     <Button variant="ghost" className="w-full justify-start text-xs h-9 rounded-lg" onClick={() => handleExport("md")}>Export Markdown</Button>
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
          {(aiSummary !== null || aiSuggestion !== null) && (
            <motion.div initial={{ opacity: 0, y: 20, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 20, scale: 0.95 }} className="fixed bottom-24 right-8 w-[400px] border border-zinc-200 dark:border-zinc-800 bg-white/95 dark:bg-zinc-950/95 backdrop-blur-md rounded-xl shadow-2xl flex flex-col z-50 overflow-hidden">
              <div className="p-5 flex items-center justify-between border-b border-zinc-100 dark:border-zinc-900 bg-zinc-50/50 dark:bg-zinc-900/50">
                <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500 dark:text-zinc-400">
                  <Sparkles className="h-3.5 w-3.5" /> {aiSummary !== null ? "AI Reflection" : "Polished Flow"}
                </div>
                <Button variant="ghost" size="icon" className="h-7 w-7 text-zinc-400 rounded-full hover:bg-zinc-200 dark:hover:bg-zinc-800" onClick={() => { setAiSummary(null); setAiSuggestion(null); }}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <ScrollArea className="max-h-[60vh] p-6">
                <div className="prose prose-zinc dark:prose-invert prose-sm">
                  {aiSummary !== null ? (
                    <p className="text-base leading-relaxed italic text-zinc-600 dark:text-zinc-400 font-serif">
                      {aiSummary || "Dainiki is contemplating your entry..."}
                    </p>
                  ) : (
                    <div className="leading-relaxed text-zinc-700 dark:text-zinc-300" dangerouslySetInnerHTML={{ __html: aiSuggestion || "Dainiki is weaving your thoughts..." }} />
                  )}
                </div>
              </ScrollArea>
              <div className="p-5 border-t border-zinc-100 dark:border-zinc-900 bg-zinc-50/50 dark:bg-zinc-900/50 space-y-4">
                {aiSuggestion !== null && (
                  <div className="flex gap-2">
                    <Button className="flex-1 rounded-xl h-10 text-xs font-bold uppercase tracking-wider" onClick={handleApplyAi}>Apply Change</Button>
                    <Button variant="outline" className="flex-1 rounded-xl h-10 text-xs font-bold uppercase tracking-wider bg-transparent" onClick={() => setAiSuggestion(null)}>Discard</Button>
                  </div>
                )}
                <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest text-center">Generated by Gemini</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
