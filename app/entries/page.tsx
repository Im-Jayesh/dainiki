"use client";

import { useAuth } from "@/contexts/auth-context";
import { useSettings } from "@/contexts/settings-context";
import { useState, useEffect, useMemo } from "react";
import { fetchMoods } from "@/lib/actions/journal";
import { useJournal } from "@/contexts/journal-context";

import { Search, ChevronRight, Database, Smile, Calendar as CalendarIcon, X, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { format, isSameDay } from "date-fns";
import { decrypt } from "@/lib/crypto";
import { useRouter, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";
import { Sidebar } from "@/components/sidebar";
import { motion, AnimatePresence } from "framer-motion";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";

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

export default function EntriesPage() {
  const { user, encryptionKey } = useAuth();
  const { appearance } = useSettings();
  const router = useRouter();
  const searchParams = useSearchParams();
  
  const { entries: allEntries, loading } = useJournal();
  const [moods, setMoods] = useState<Mood[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedMoodId, setSelectedMoodId] = useState<number | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [visibleCount, setVisibleCount] = useState(12);
  
  const [view, setView] = useState<"active" | "archived" | "deleted">("active");
  const [sidebarOpen, setSidebarOpen] = useState(true);

  useEffect(() => {
    const v = searchParams.get("view");
    if (v === "archived" || v === "deleted") setView(v);
    const dateParam = searchParams.get("date");
    if (dateParam) {
      try {
        const d = new Date(dateParam);
        if (!isNaN(d.getTime())) setSelectedDate(d);
      } catch (e) {}
    }
  }, [searchParams]);

  useEffect(() => {
    const loadMoods = async () => {
      const data = await fetchMoods();
      setMoods(data as unknown as Mood[]);
    };
    loadMoods();
  }, []);

  useEffect(() => {
    setVisibleCount(12);
  }, [searchQuery, selectedMoodId, selectedDate, view]);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const target = e.currentTarget;
    const isNearBottom = target.scrollHeight - target.scrollTop - target.clientHeight < 100;
    if (isNearBottom && visibleCount < filteredEntries.length) {
      setVisibleCount(prev => prev + 12);
    }
  };


  const filteredEntries = useMemo(() => {
    let result = allEntries;
    if (view === "deleted") {
      result = result.filter(e => e.is_deleted);
    } else if (view === "archived") {
      result = result.filter(e => e.is_archived && !e.is_deleted);
    } else {
      result = result.filter(e => !e.is_deleted && !e.is_archived);
    }

    const lowerQuery = searchQuery.toLowerCase();

    const parseUTCDate = (dateStr: string) => {
      if (!dateStr) return new Date();
      if (dateStr.includes('T')) return new Date(dateStr);
      // SQLite format: YYYY-MM-DD HH:MM:SS (UTC)
      return new Date(dateStr.replace(' ', 'T') + 'Z');
    };

    return result.filter(e => {
      // 1. Text Search Filter
      const entryDate = parseUTCDate(e.created_at);
      const dateFull = format(entryDate, 'yyyy-MM-dd');
      const datePretty = format(entryDate, 'PPP').toLowerCase();
      const moodStr = (e.mood_name || "").toLowerCase();
      const matchesSearch = (e.title || "").toLowerCase().includes(lowerQuery) || 
             (e.content || "").toLowerCase().includes(lowerQuery) ||
             datePretty.includes(lowerQuery) ||
             dateFull.includes(lowerQuery) ||
             moodStr.includes(lowerQuery);
      
      if (!matchesSearch) return false;

      // 2. Mood Filter
      if (selectedMoodId !== null && e.mood_id !== selectedMoodId) return false;

      // 3. Date Filter
      if (selectedDate && !isSameDay(entryDate, selectedDate)) return false;

      return true;
    });
  }, [allEntries, view, searchQuery, selectedMoodId, selectedDate]);


  const clearFilters = () => {
    setSearchQuery("");
    setSelectedMoodId(null);
    setSelectedDate(undefined);
  };

  const selectedMood = moods.find(m => m.id === selectedMoodId);

  return (
    <div 
      className={cn("flex h-screen w-full overflow-hidden transition-colors duration-500", THEME_STYLES[appearance.theme] || THEME_STYLES.zinc)}
      style={{ fontFamily: `var(--${appearance.fontFamily})` }}
    >
      <Sidebar open={sidebarOpen} onToggle={() => setSidebarOpen(!sidebarOpen)} />
      
      <main className="flex-1 flex flex-col relative overflow-hidden">
        {!sidebarOpen && (
          <Button variant="ghost" size="icon" className="absolute left-4 top-4 lg:left-6 lg:top-6 z-10 h-10 w-10 text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-950 rounded-xl shadow-sm border border-zinc-100 dark:border-zinc-900" onClick={() => setSidebarOpen(true)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        )}

        <div onScroll={handleScroll} className="flex-1 overflow-y-auto custom-scrollbar p-6 pt-20 lg:p-16 lg:pt-24">

          <div className="max-w-6xl mx-auto space-y-8 lg:space-y-12">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
              <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}>
                <h1 className="text-4xl lg:text-5xl font-bold tracking-tight mb-2">The Vault</h1>
                <p className="text-[10px] font-bold uppercase tracking-[0.4em] text-zinc-400 flex items-center gap-2">
                  <Database className="h-3 w-3" /> {view === 'active' ? 'Active Reflections' : view === 'archived' ? 'Deep Archive' : 'The Bin'}
                </p>
              </motion.div>

              <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="flex flex-col gap-4 w-full md:w-auto">
                <div className="flex items-center gap-2 lg:gap-3">
                  <div className="relative group flex-1 md:flex-none">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400 transition-colors" />
                    <Input
                      placeholder="Search..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-12 h-12 lg:h-14 w-full md:w-64 lg:w-80 rounded-xl bg-zinc-100/50 dark:bg-zinc-900/50 border-none shadow-inner text-sm"
                    />
                  </div>
                  
                  <div className="flex gap-2">
                    {/* Mood Filter */}
                    <DropdownMenu>
                      <DropdownMenuTrigger className={cn("inline-flex items-center justify-center whitespace-nowrap text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-zinc-950 disabled:pointer-events-none disabled:opacity-50 border border-zinc-200 bg-white shadow-sm hover:bg-zinc-100 hover:text-zinc-900 dark:border-zinc-800 dark:bg-zinc-950 dark:hover:bg-zinc-800 dark:hover:text-zinc-50 h-12 w-12 lg:h-14 lg:w-14 rounded-xl border-none bg-zinc-100/50 dark:bg-zinc-900/50 shadow-inner", selectedMoodId && "text-amber-500")}>
                        {selectedMood ? <span className="text-xl">{selectedMood.emoji}</span> : <Smile className="h-5 w-5" />}
                      </DropdownMenuTrigger>
                      <DropdownMenuContent className="w-56 p-2 rounded-xl border-zinc-100 dark:border-zinc-800 shadow-2xl">
                        <div className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 px-3 py-2">Filter by Mood</div>
                        <DropdownMenuSeparator className="bg-zinc-50 dark:bg-zinc-800/50" />
                        <DropdownMenuItem onClick={() => setSelectedMoodId(null)} className="rounded-lg h-10 px-3">
                          <Filter className="h-3.5 w-3.5 mr-2 opacity-50" /> All Moods
                        </DropdownMenuItem>
                        {moods.map((m) => (
                          <DropdownMenuItem key={m.id} onClick={() => setSelectedMoodId(m.id)} className="rounded-lg h-10 px-3">
                            <span className="mr-3 text-lg">{m.emoji}</span> {m.name}
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>

                    {/* Date Filter */}
                    <Popover>
                      <PopoverTrigger className={cn("inline-flex items-center justify-center whitespace-nowrap text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-zinc-950 disabled:pointer-events-none disabled:opacity-50 border border-zinc-200 bg-white shadow-sm hover:bg-zinc-100 hover:text-zinc-900 dark:border-zinc-800 dark:bg-zinc-950 dark:hover:bg-zinc-800 dark:hover:text-zinc-50 h-12 w-12 lg:h-14 lg:w-14 rounded-xl border-none bg-zinc-100/50 dark:bg-zinc-900/50 shadow-inner", selectedDate && "text-blue-500")}>
                        <CalendarIcon className="h-5 w-5" />
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0 rounded-2xl border-none shadow-2xl overflow-hidden" align="end">
                        <Calendar
                          mode="single"
                          selected={selectedDate}
                          onSelect={setSelectedDate}
                          className="bg-white dark:bg-zinc-950 p-4"
                        />
                        {selectedDate && (
                           <div className="p-3 bg-zinc-50 dark:bg-zinc-900 border-t border-zinc-100 dark:border-zinc-800">
                             <Button variant="ghost" className="w-full h-10 rounded-xl text-[10px] font-bold uppercase tracking-widest" onClick={() => setSelectedDate(undefined)}>
                               Clear Date
                             </Button>
                           </div>
                        )}
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>

                <AnimatePresence>
                  {(selectedMoodId || selectedDate || searchQuery) && (
                    <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="flex flex-wrap gap-2 items-center">
                      <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 mr-2">Filters:</span>
                      {searchQuery && (
                        <div className="flex items-center gap-2 px-3 py-1.5 bg-zinc-100 dark:bg-zinc-900 rounded-full text-[10px] font-bold uppercase tracking-wider text-zinc-600 dark:text-zinc-400">
                          {searchQuery}
                          <X className="h-3 w-3 cursor-pointer hover:text-red-500" onClick={() => setSearchQuery("")} />
                        </div>
                      )}
                      {selectedMoodId && (
                        <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-50 dark:bg-amber-950/30 rounded-full text-[10px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400 border border-amber-100 dark:border-amber-900/30">
                          {selectedMood?.emoji}
                          <X className="h-3 w-3 cursor-pointer hover:text-red-500" onClick={() => setSelectedMoodId(null)} />
                        </div>
                      )}
                      {selectedDate && (
                        <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 dark:bg-blue-950/30 rounded-full text-[10px] font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400 border border-blue-100 dark:border-blue-900/30">
                          {format(selectedDate, 'MMM d')}
                          <X className="h-3 w-3 cursor-pointer hover:text-red-500" onClick={() => setSelectedDate(undefined)} />
                        </div>
                      )}
                      <Button variant="link" onClick={clearFilters} className="h-auto p-0 text-[10px] font-bold uppercase tracking-widest text-zinc-400 hover:text-red-500 transition-colors ml-2">Clear All</Button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            </div>

            <div className="flex gap-1 p-1 bg-zinc-100/50 dark:bg-zinc-900/50 rounded-xl w-fit">
               <Button variant="ghost" size="sm" className={cn("text-[10px] uppercase font-bold tracking-widest rounded-xl h-9 lg:h-10 px-4 lg:px-6", view === 'active' && "bg-white dark:bg-zinc-800 shadow-lg")} onClick={() => { setView("active"); clearFilters(); }}>Journal</Button>
               <Button variant="ghost" size="sm" className={cn("text-[10px] uppercase font-bold tracking-widest rounded-xl h-9 lg:h-10 px-4 lg:px-6", view === 'archived' && "bg-white dark:bg-zinc-800 shadow-lg")} onClick={() => { setView("archived"); clearFilters(); }}>Archive</Button>
               <Button variant="ghost" size="sm" className={cn("text-[10px] uppercase font-bold tracking-widest rounded-xl h-9 lg:h-10 px-4 lg:px-6", view === 'deleted' && "bg-white dark:bg-zinc-800 shadow-lg")} onClick={() => { setView("deleted"); clearFilters(); }}>Bin</Button>
            </div>

            {loading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
                {[1, 2, 3, 4, 5, 6].map(i => (
                  <div key={i} className="h-64 rounded-xl bg-zinc-100 dark:bg-zinc-900 animate-pulse" />
                ))}
              </div>
            ) : filteredEntries.length === 0 ? (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="h-64 flex flex-col items-center justify-center border-2 border-dashed border-zinc-100 dark:border-zinc-900 rounded-xl text-zinc-400">
                <Database className="h-8 w-8 mb-4 opacity-20" />
                <p className="text-sm font-bold uppercase tracking-widest opacity-50 text-center px-4">No matching reflections found</p>
              </motion.div>
            ) : (
              <div className="space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
                  <AnimatePresence mode="popLayout">
                    {filteredEntries.slice(0, visibleCount).map((entry, index) => (
                      <motion.div 
                        layout
                        key={entry.id}
                        initial={{ opacity: 0, scale: 0.9, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.9 }}
                        transition={{ delay: (index % 12) * 0.05, type: "spring", bounce: 0.3 }}
                        onClick={() => router.push(`/?id=${entry.id}&view=${view}`)}
                        className="group cursor-pointer bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 p-6 lg:p-8 rounded-xl hover:shadow-xl transition-all duration-500 flex flex-col h-64 lg:h-72 relative overflow-hidden"
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
                {visibleCount < filteredEntries.length && (
                  <div className="flex justify-center py-6">
                    <motion.div
                      animate={{ opacity: [0.4, 1, 0.4] }}
                      transition={{ repeat: Infinity, duration: 1.5 }}
                      className="text-xs font-bold uppercase tracking-[0.2em] text-zinc-400 dark:text-zinc-600"
                    >
                      Scrolling reveals more reflections...
                    </motion.div>
                  </div>
                )}
              </div>
            )}

          </div>
        </div>
      </main>
    </div>
  );
}

