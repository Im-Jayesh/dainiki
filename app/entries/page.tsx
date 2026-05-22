"use client";

import { useAuth } from "@/contexts/auth-context";
import { useSettings } from "@/contexts/settings-context";
import { useState, useEffect, useMemo } from "react";
import { getAllEntries } from "@/lib/actions/journal";
import { Search, ChevronRight, Hash, Database } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { format } from "date-fns";
import { decrypt } from "@/lib/crypto";
import { useRouter, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";
import { Sidebar } from "@/components/sidebar";
import { motion, AnimatePresence } from "framer-motion";

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

const THEME_STYLES: Record<string, string> = {
  zinc: "text-zinc-900 dark:text-zinc-100",
  rose: "bg-[#fff1f2] dark:bg-[#4c0519] text-[#9f1239] dark:text-[#fff1f2]",
  slate: "bg-[#f8fafc] dark:bg-[#0f172a] text-[#1e293b] dark:text-[#f1f5f9]",
  velvet: "bg-[#faf5ff] dark:bg-[#3b0764] text-[#7e22ce] dark:text-[#faf5ff]"
};

export default function EntriesPage() {
  const { user, encryptionKey } = useAuth();
  const { appearance } = useSettings();
  const router = useRouter();
  const searchParams = useSearchParams();
  
  const [entries, setEntries] = useState<Entry[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<"active" | "archived" | "deleted">("active");
  const [sidebarOpen, setSidebarOpen] = useState(true);

  useEffect(() => {
    const v = searchParams.get("view");
    if (v === "archived" || v === "deleted") setView(v);
    const dateParam = searchParams.get("date");
    if (dateParam) setSearchQuery(dateParam);
  }, [searchParams]);

  useEffect(() => {
    const loadEntries = async () => {
      if (!user || !encryptionKey || !user.salt) return;
      setLoading(true);
      try {
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
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    loadEntries();
  }, [user, encryptionKey, view]);

  const filteredEntries = useMemo(() => {
    const lowerQuery = searchQuery.toLowerCase();
    return entries.filter(e => {
      const dateFull = format(new Date(e.created_at), 'yyyy-MM-dd');
      const datePretty = format(new Date(e.created_at), 'PPP').toLowerCase();
      const moodStr = (e.mood_name || "").toLowerCase();
      return (e.title || "").toLowerCase().includes(lowerQuery) || 
             (e.content || "").toLowerCase().includes(lowerQuery) ||
             datePretty.includes(lowerQuery) ||
             dateFull.includes(lowerQuery) ||
             moodStr.includes(lowerQuery);
    });
  }, [entries, searchQuery]);

  return (
    <div 
      className={cn("flex h-screen w-full overflow-hidden transition-colors duration-500", THEME_STYLES[appearance.theme] || THEME_STYLES.zinc)}
      style={{ fontFamily: `var(--${appearance.fontFamily})` }}
    >
      <Sidebar open={sidebarOpen} onToggle={() => setSidebarOpen(!sidebarOpen)} />
      
      <main className="flex-1 flex flex-col relative overflow-hidden">
        {!sidebarOpen && (
          <Button variant="ghost" size="icon" className="absolute left-6 top-6 z-10 h-10 w-10 text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-950 rounded-xl shadow-sm border border-zinc-100 dark:border-zinc-900" onClick={() => setSidebarOpen(true)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        )}

        <div className="flex-1 overflow-y-auto custom-scrollbar p-8 pt-24 lg:p-16 lg:pt-24">
          <div className="max-w-6xl mx-auto space-y-12">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
              <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}>
                <h1 className="text-5xl font-bold tracking-tight mb-2">The Vault</h1>
                <p className="text-xs font-bold uppercase tracking-[0.4em] text-zinc-400 flex items-center gap-2">
                  <Database className="h-3 w-3" /> {view === 'active' ? 'Active Reflections' : view === 'archived' ? 'Deep Archive' : 'The Bin'}
                </p>
              </motion.div>

              <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="flex items-center gap-3">
                <div className="relative group">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400 transition-colors" />
                  <Input
                    placeholder="Search anything..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-12 h-14 w-80 rounded-[1.25rem] bg-zinc-100/50 dark:bg-zinc-900/50 border-none shadow-inner text-sm"
                  />
                </div>
              </motion.div>
            </div>

            <div className="flex gap-2 p-1 bg-zinc-100/50 dark:bg-zinc-900/50 rounded-2xl w-fit">
               <Button variant="ghost" size="sm" className={cn("text-[10px] uppercase font-bold tracking-widest rounded-xl h-10 px-6", view === 'active' && "bg-white dark:bg-zinc-800 shadow-lg")} onClick={() => setView("active")}>Journal</Button>
               <Button variant="ghost" size="sm" className={cn("text-[10px] uppercase font-bold tracking-widest rounded-xl h-10 px-6", view === 'archived' && "bg-white dark:bg-zinc-800 shadow-lg")} onClick={() => setView("archived")}>Archive</Button>
               <Button variant="ghost" size="sm" className={cn("text-[10px] uppercase font-bold tracking-widest rounded-xl h-10 px-6", view === 'deleted' && "bg-white dark:bg-zinc-800 shadow-lg")} onClick={() => setView("deleted")}>Bin</Button>
            </div>

            {loading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {[1, 2, 3, 4, 5, 6].map(i => (
                  <div key={i} className="h-64 rounded-[2.5rem] bg-zinc-100 dark:bg-zinc-900 animate-pulse" />
                ))}
              </div>
            ) : filteredEntries.length === 0 ? (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="h-64 flex flex-col items-center justify-center border-2 border-dashed border-zinc-100 dark:border-zinc-900 rounded-[2.5rem] text-zinc-400">
                <Database className="h-8 w-8 mb-4 opacity-20" />
                <p className="text-sm font-bold uppercase tracking-widest opacity-50">No matching reflections found</p>
              </motion.div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                <AnimatePresence mode="popLayout">
                  {filteredEntries.map((entry, index) => (
                    <motion.div 
                      layout
                      key={entry.id}
                      initial={{ opacity: 0, scale: 0.9, y: 20 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.9 }}
                      transition={{ delay: index * 0.05, type: "spring", bounce: 0.3 }}
                      onClick={() => router.push(`/?id=${entry.id}&view=${view}`)}
                      className="group cursor-pointer bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 p-8 rounded-[2.5rem] hover:shadow-xl transition-all duration-500 flex flex-col h-72 relative overflow-hidden"
                    >
                      <div className="flex items-center justify-between mb-6">
                        <span className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-400">
                          {format(new Date(entry.created_at), "MMM d, yyyy")}
                        </span>
                        {entry.mood_emoji && <div className="text-2xl">{entry.mood_emoji}</div>}
                      </div>
                      <h3 className="text-xl font-bold mb-4 line-clamp-1 group-hover:text-amber-500 transition-colors">
                        {entry.title || "Untitled"}
                      </h3>
                      <div className="text-sm text-zinc-500 dark:text-zinc-400 line-clamp-4 flex-1 leading-relaxed" dangerouslySetInnerHTML={{ __html: entry.content || "..." }} />
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
