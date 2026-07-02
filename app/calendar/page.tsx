"use client";

import { useAuth } from "@/contexts/auth-context";
import { useSettings } from "@/contexts/settings-context";
import { useJournal } from "@/contexts/journal-context";
import { useState, useEffect, useMemo } from "react";
import { Zap, Map, ChevronRight } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { format, isSameDay, differenceInDays } from "date-fns";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { Calendar, CalendarDayButton } from "@/components/ui/calendar";
import { motion } from "framer-motion";
import { Sidebar } from "@/components/sidebar";
import Link from "next/link";

interface Entry {
  id: number;
  title: string;
  mood_id?: number;
  mood_name?: string;
  mood_emoji?: string;
  created_at: string;
}

const THEME_STYLES: Record<string, string> = {
  zinc: "bg-white dark:bg-black text-zinc-900 dark:text-zinc-100",
  rose: "bg-[#fff1f2] dark:bg-[#4c0519] text-[#9f1239] dark:text-[#fff1f2]",
  slate: "bg-[#f8fafc] dark:bg-[#0f172a] text-[#1e293b] dark:text-[#f1f5f9]",
  velvet: "bg-[#faf5ff] dark:bg-[#3b0764] text-[#7e22ce] dark:text-[#faf5ff]"
};

export default function CalendarPage() {
  const { user, encryptionKey } = useAuth();
  const { appearance } = useSettings();
  const router = useRouter();
  
  const { entries: allEntries } = useJournal();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());

  const entries = useMemo(() => {
    return allEntries.filter(e => !e.is_deleted && !e.is_archived) as Entry[];
  }, [allEntries]);

  const streak = useMemo(() => {
    if (entries.length === 0) return 0;
    const sortedDates = entries
      .map(e => new Date(new Date(e.created_at).setHours(0,0,0,0)))
      .sort((a, b) => b.getTime() - a.getTime());
    
    let currentStreak = 0;
    const lastDate = new Date().setHours(0,0,0,0);
    if (differenceInDays(lastDate, sortedDates[0]) > 1) return 0;

    for (let i = 0; i < sortedDates.length; i++) {
      if (i === 0) currentStreak++;
      else {
        const diff = differenceInDays(sortedDates[i-1], sortedDates[i]);
        if (diff === 1) currentStreak++;
        else if (diff > 1) break;
      }
    }
    return currentStreak;
  }, [entries]);

  const handleDateSelect = (date: Date | undefined) => {
    setSelectedDate(date);
    if (!date) return;
    router.push(`/entries?date=${format(date, 'yyyy-MM-dd')}`);
  };

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

        <div className="flex-1 overflow-y-auto custom-scrollbar p-6 md:p-12 lg:p-24 pt-24 md:pt-24 lg:pt-32">
          <div className="max-w-4xl mx-auto space-y-12">
            <div className="flex items-center justify-between gap-4">
              <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}>
                <h1 className="text-4xl md:text-6xl font-black tracking-tight mb-2">The Palace</h1>
                <p className="text-[10px] font-bold uppercase tracking-[0.4em] text-zinc-400 flex items-center gap-2">
                  <Map className="h-3 w-3" /> Journey Overview
                </p>
              </motion.div>

              <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="flex items-center gap-2 bg-zinc-100 dark:bg-zinc-900 px-5 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
                <Zap className="h-4 w-4 text-amber-500 fill-amber-500" />
                <span className="text-xs font-black uppercase tracking-widest">{streak} Days</span>
              </motion.div>
            </div>

            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-col items-center justify-center py-12"
            >
              <Calendar 
                mode="single" 
                selected={selectedDate} 
                onSelect={handleDateSelect} 
                className="p-0 pointer-events-auto" 
                classNames={{
                  day: cn(
                    buttonVariants({ variant: "ghost" }),
                    "h-12 w-12 md:h-20 md:w-20 p-0 font-bold aria-selected:opacity-100 text-sm md:text-xl rounded-xl transition-all"
                  ),
                  selected: "bg-zinc-900 text-zinc-50 dark:bg-zinc-50 dark:text-zinc-900 hover:bg-zinc-900 hover:text-zinc-50 dark:hover:bg-zinc-50 dark:hover:text-zinc-900 focus:bg-zinc-900 focus:text-zinc-50 dark:focus:bg-zinc-50 dark:focus:text-zinc-900 shadow-xl scale-110",
                  today: "bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 border border-zinc-200 dark:border-zinc-700",
                  month_grid: "w-full border-separate border-spacing-1 md:border-spacing-3",
                  caption_label: "text-xl md:text-3xl font-black tracking-tighter text-zinc-900 dark:text-zinc-100"
                }}

                components={{
                  DayButton: (props) => {
                    const entry = entries.find(e => isSameDay(new Date(e.created_at), props.day.date));
                    return (
                      <div className="relative flex items-center justify-center h-full w-full group/day" title={entry?.mood_name || undefined}>
                        <CalendarDayButton {...props} />
                        {entry?.mood_emoji && (
                          <motion.span 
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            className="absolute bottom-1 right-1 text-base md:text-2xl pointer-events-none drop-shadow-md" 
                          >
                            {entry.mood_emoji}
                          </motion.span>
                        )}
                        {entry?.mood_name && (
                           <div className="absolute -top-8 left-1/2 -translate-x-1/2 opacity-0 group-hover/day:opacity-100 transition-opacity bg-zinc-900 dark:bg-zinc-100 text-zinc-50 dark:text-zinc-900 text-[10px] font-bold px-2 py-1 rounded-md pointer-events-none z-50 whitespace-nowrap shadow-xl">
                             {entry.mood_name}
                           </div>
                        )}
                      </div>
                    );
                  }
                }}
              />
            </motion.div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-20">
              <Link href="/">
                <motion.div whileHover={{ y: -3 }} className="p-8 rounded-xl bg-zinc-100/30 dark:bg-zinc-900/30 border border-zinc-100 dark:border-zinc-800 hover:bg-white dark:hover:bg-zinc-900 transition-all cursor-pointer">
                   <p className="text-[9px] font-black uppercase tracking-[0.4em] text-zinc-400 mb-1">Back to</p>
                   <p className="text-xl font-bold">Today's Reflection</p>
                </motion.div>
              </Link>
              <Link href="/entries">
                <motion.div whileHover={{ y: -3 }} className="p-8 rounded-xl bg-zinc-100/30 dark:bg-zinc-900/30 border border-zinc-100 dark:border-zinc-900 hover:bg-white dark:hover:bg-zinc-900 transition-all cursor-pointer text-right">
                   <p className="text-[9px] font-black uppercase tracking-[0.4em] text-zinc-400 mb-1">Explore the</p>
                   <p className="text-xl font-bold">Memory Vault</p>
                </motion.div>
              </Link>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
