"use client";

import { useAuth } from "@/contexts/auth-context";
import { useSettings } from "@/contexts/settings-context";
import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { getAllEntries, fetchMoods } from "@/lib/actions/journal";
import { Sidebar } from "@/components/sidebar";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { 
  ChevronRight, 
  Droplets, 
  Info, 
  Volume2, 
  VolumeX, 
  Eye, 
  EyeOff,
  Coins,
  Sparkles
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle,
  DialogDescription
} from "@/components/ui/dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { isSameDay, subDays, format } from "date-fns";
import { decrypt } from "@/lib/crypto";
import { useTheme } from "next-themes";

const THEME_STYLES: Record<string, string> = {
  zinc: "text-zinc-900 dark:text-zinc-100",
  rose: "bg-[#fff1f2] dark:bg-[#4c0519] text-[#9f1239] dark:text-[#fff1f2]",
  slate: "bg-[#f8fafc] dark:bg-[#0f172a] text-[#1e293b] dark:text-[#f1f5f9]",
  velvet: "bg-[#faf5ff] dark:bg-[#3b0764] text-[#7e22ce] dark:text-[#faf5ff]"
};

interface Ripple {
  id: number;
  x: number;
  y: number;
}

interface Fish {
  id: number;
  type: 1 | 2;
  top: string;
  left: string;
  rotation: number;
  scale: number;
}

export default function GardenPage() {
  const { user, encryptionKey } = useAuth();
  const { appearance } = useSettings();
  const { resolvedTheme } = useTheme();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [streak, setStreak] = useState(0);
  const [totalEntries, setTotalEntries] = useState(0);
  const [ripples, setRipples] = useState<Ripple[]>([]);
  
  // Music & UI state
  const [isPlaying, setIsPlaying] = useState(false);
  const [showStats, setShowStats] = useState(true);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const mainRef = useRef<HTMLElement | null>(null);

  // Fish state - 3 fish for better luck with randomized sizes
  const [fish, setFish] = useState<Fish[]>([
    { id: 1, type: 1, top: "30%", left: "40%", rotation: 45, scale: 0.8 + Math.random() * 0.4 },
    { id: 2, type: 2, top: "60%", left: "70%", rotation: -30, scale: 0.8 + Math.random() * 0.4 },
    { id: 3, type: 2, top: "50%", left: "20%", rotation: 120, scale: 0.8 + Math.random() * 0.4 },
  ]);

  // Wishing Coin State
  const [coins, setCoins] = useState(2);
  const [isCoinTossing, setIsCoinTossing] = useState(false);
  const [memoryToShow, setMemoryToShow] = useState<any>(null);
  const [moods, setMoods] = useState<any[]>([]);
  const [isFallback, setIsFallback] = useState(false);
  const [allEntries, setAllEntries] = useState<any[]>([]);

  // Lily State
  const [activeLilyId, setActiveLilyId] = useState<number | null>(null);

  useEffect(() => {
    const today = format(new Date(), "yyyy-MM-dd");
    const stored = localStorage.getItem("garden_coins");
    if (stored) {
      const { date, count } = JSON.parse(stored);
      if (date === today) {
        setCoins(count);
      } else {
        setCoins(2);
        localStorage.setItem("garden_coins", JSON.stringify({ date: today, count: 2 }));
      }
    } else {
      localStorage.setItem("garden_coins", JSON.stringify({ date: today, count: 2 }));
    }
  }, []);

  useEffect(() => {
    const loadData = async () => {
      if (!user || !encryptionKey || !user.salt) return;
      try {
        const [m, e] = await Promise.all([fetchMoods(), getAllEntries()]);
        setMoods(m);
        
        // Decrypt entries for the wishing coin
        const decryptedEntries = await Promise.all(e.map(async (entry) => {
          try {
            const dTitle = await decrypt(entry.title, encryptionKey, user.salt!);
            const dContent = await decrypt(entry.content, encryptionKey, user.salt!);
            return { ...entry, title: dTitle, content: dContent };
          } catch {
            return { ...entry, title: "🔒 Decryption Failed", content: "" };
          }
        }));
        
        setAllEntries(decryptedEntries);
      } catch (err) {
        console.error("Failed to load garden data", err);
      }
    };
    loadData();
  }, [user, encryptionKey]);

  useEffect(() => {
    const loadStats = async () => {
      if (!user) return;
      try {
        const entries = await getAllEntries();
        setTotalEntries(entries.length);
        
        if (entries.length === 0) {
          setStreak(0);
          return;
        }

        let currentStreak = 0;
        let checkDate = new Date();
        const hasToday = entries.some(e => isSameDay(new Date(e.created_at!), checkDate));
        const hasYesterday = entries.some(e => isSameDay(new Date(e.created_at!), subDays(checkDate, 1)));

        if (!hasToday && !hasYesterday) {
          setStreak(0);
        } else {
          if (!hasToday) checkDate = subDays(checkDate, 1);
          while (true) {
            const hasEntry = entries.some(e => isSameDay(new Date(e.created_at!), checkDate));
            if (hasEntry) {
              currentStreak++;
              checkDate = subDays(checkDate, 1);
            } else {
              break;
            }
          }
          setStreak(currentStreak);
        }
      } catch (e) {
        console.error(e);
      }
    };
    loadStats();
  }, [user]);

  // Automatic random ripples
  useEffect(() => {
    let timeoutId: NodeJS.Timeout;
    
    const triggerRandomRipple = () => {
      if (!mainRef.current) {
        timeoutId = setTimeout(triggerRandomRipple, 1000);
        return;
      }
      
      const { width, height } = mainRef.current.getBoundingClientRect();
      const x = Math.random() * width;
      const y = Math.random() * height;
      
      const id = Date.now() + Math.random();
      setRipples(prev => [...prev, { id, x, y }]);
      
      setTimeout(() => {
        setRipples(prev => prev.filter(r => r.id !== id));
      }, 2000);
      
      const nextDelay = 3000 + Math.random() * 4000;
      timeoutId = setTimeout(triggerRandomRipple, nextDelay);
    };

    timeoutId = setTimeout(triggerRandomRipple, 2000);
    return () => clearTimeout(timeoutId);
  }, []);

  // Fish Movement (Every 30 sec)
  useEffect(() => {
    const moveFish = () => {
      setFish(prevFish => prevFish.map(f => {
        const nextTop = 10 + Math.random() * 80;
        const nextLeft = 10 + Math.random() * 80;
        
        // Calculate angle towards next position
        const currentTopNum = parseFloat(f.top);
        const currentLeftNum = parseFloat(f.left);
        const angle = Math.atan2(nextTop - currentTopNum, nextLeft - currentLeftNum) * (180 / Math.PI);

        return {
          ...f,
          top: `${nextTop}%`,
          left: `${nextLeft}%`,
          rotation: angle + 90, // Adjust by 90deg if asset faces up/down
        };
      }));
    };

    const intervalId = setInterval(moveFish, 30000);
    return () => clearInterval(intervalId);
  }, []);

  // Fish Ripples (Every 15 sec)
  useEffect(() => {
    const triggerFishRipples = () => {
      if (!mainRef.current) return;
      const { width, height } = mainRef.current.getBoundingClientRect();
      
      const newRipples: Ripple[] = fish.map(f => {
        const x = (parseFloat(f.left) / 100) * width;
        const y = (parseFloat(f.top) / 100) * height;
        return { id: Date.now() + Math.random(), x, y };
      });

      setRipples(prev => [...prev, ...newRipples]);
      
      setTimeout(() => {
        const ids = newRipples.map(r => r.id);
        setRipples(prev => prev.filter(r => !ids.includes(r.id)));
      }, 2000);
    };

    const intervalId = setInterval(triggerFishRipples, 15000);
    return () => clearInterval(intervalId);
  }, [fish]);

  const toggleMusic = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const triggerSplash = useCallback((left: string, top: string) => {
    if (!mainRef.current) return;
    const { width, height } = mainRef.current.getBoundingClientRect();
    const x = (parseFloat(left) / 100) * width;
    const y = (parseFloat(top) / 100) * height;

    const splashRipples = [
      { id: Date.now() + Math.random(), x, y },
      { id: Date.now() + Math.random(), x: x + 10, y: y + 5 },
      { id: Date.now() + Math.random(), x: x - 5, y: y - 10 },
    ];

    setRipples(prev => [...prev, ...splashRipples]);
    
    setTimeout(() => {
      const ids = splashRipples.map(r => r.id);
      setRipples(prev => prev.filter(r => !ids.includes(r.id)));
    }, 1500); // Faster ripples
  }, []);

  // Wishing Coin Logic
  const throwCoin = useCallback(async (moodId: number) => {
    if (coins <= 0 || isCoinTossing) return;
    
    if (allEntries.length === 0) {
      alert("The pond is quiet. Write some entries first to recall memories!");
      return;
    }

    setIsCoinTossing(true);
    const newCount = coins - 1;
    setCoins(newCount);
    localStorage.setItem("garden_coins", JSON.stringify({ 
      date: format(new Date(), "yyyy-MM-dd"), 
      count: newCount 
    }));

    // Toss animation timing
    setTimeout(() => {
      triggerSplash("50%", "50%");
      
      const moodEntries = allEntries.filter(e => e.mood_id === moodId);
      let selected;
      if (moodEntries.length > 0) {
        selected = moodEntries[Math.floor(Math.random() * moodEntries.length)];
        setIsFallback(false);
      } else {
        selected = allEntries[Math.floor(Math.random() * allEntries.length)];
        setIsFallback(true);
      }
      
      setMemoryToShow(selected);
      setIsCoinTossing(false);
    }, 2000);
  }, [coins, isCoinTossing, allEntries, triggerSplash]);

  // Jump Reset
  useEffect(() => {
    const hasJumping = fish.some(f => f.isJumping);
    if (!hasJumping) return;

    const timer = setTimeout(() => {
      setFish(prev => prev.map(f => ({ ...f, isJumping: false })));
    }, 1000);
    return () => clearTimeout(timer);
  }, [fish]);

  const lilies = useMemo(() => {
    // Original logic: Show lilies based on streak, 1 every 8 days
    let count = 0;
    if (totalEntries > 0) {
      count = Math.max(1, Math.ceil(streak / 8));
    }
    
    if (count === 0) return [];
    
    const result = [];
    const seed = (s: number) => {
      let value = s;
      return () => {
        value = (value * 16807) % 2147483647;
        return (value - 1) / 2147483646;
      };
    };

    const random = seed(42);

    for (let i = 0; i < count; i++) {
      let stage = 8;
      if (i === count - 1) {
        stage = ((streak - 1) % 8) + 1;
      }
      
      result.push({
        id: i,
        stage,
        top: `${20 + random() * 60}%`,
        left: `${20 + random() * 60}%`,
        scale: 0.6 + random() * 0.4,
        delay: random() * 2,
        rotationDuration: 4 + random() * 2
      });
    }
    return result;
  }, [streak, totalEntries]);

  const handlePondClick = useCallback((e: React.MouseEvent) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    const newRipple = { id: Date.now(), x, y };
    setRipples(prev => [...prev, newRipple]);
    
    setTimeout(() => {
      setRipples(prev => prev.filter(r => r.id !== newRipple.id));
    }, 2000);
  }, []);

  const isDarkMode = resolvedTheme === "dark";
  const pondBackground = isDarkMode 
    ? "/pond-assets/ponds/rectpond-stage-1.png" 
    : "/pond-assets/ponds/day-time-pond.png";

  return (
    <div 
      className={cn("flex h-screen w-full overflow-hidden transition-colors duration-500", THEME_STYLES[appearance.theme] || THEME_STYLES.zinc)}
      style={{ fontFamily: `var(--${appearance.fontFamily})` }}
    >
      <Sidebar open={sidebarOpen} onToggle={() => setSidebarOpen(!sidebarOpen)} />
      
      <main 
        ref={mainRef}
        className="flex-1 flex flex-col relative overflow-hidden bg-white dark:bg-zinc-950"
        onClick={handlePondClick}
      >
        {/* Audio Element */}
        <audio 
          ref={audioRef}
          src="/natureseye-a-meditation-in-a-japanese-water-garden-11658.mp3"
          loop
        />

        {/* Full Screen Pond Background */}
        <div className="absolute inset-0 z-0">
          <AnimatePresence mode="wait">
            <motion.img
              key={pondBackground}
              src={pondBackground}
              alt="Pond Background"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 1 }}
              className="w-full h-full object-cover image-pixelated pointer-events-none"
            />
          </AnimatePresence>
          <div className="absolute inset-0 bg-black/5 dark:bg-black/20 pointer-events-none" />
        </div>

        {/* Floating Toggle Buttons (Top Left) */}
        <div className="absolute left-4 top-4 lg:left-6 lg:top-6 z-30 flex flex-col gap-3">
          {!sidebarOpen && (
            <Button variant="ghost" size="icon" className="h-10 w-10 bg-white/50 dark:bg-zinc-950/50 backdrop-blur-md text-zinc-400 hover:bg-white dark:hover:bg-zinc-950 rounded-xl shadow-sm border border-zinc-100/50 dark:border-zinc-900/50" onClick={() => setSidebarOpen(true)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          )}
          
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-10 w-10 bg-white/50 dark:bg-zinc-950/50 backdrop-blur-md text-zinc-400 hover:bg-white dark:hover:bg-zinc-950 rounded-xl shadow-sm border border-zinc-100/50 dark:border-zinc-900/50" 
            onClick={() => setShowStats(!showStats)}
            title={showStats ? "Hide Stats" : "Show Stats"}
          >
            {showStats ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </Button>

          <Button 
            variant="ghost" 
            size="icon" 
            className={cn(
              "h-10 w-10 backdrop-blur-md rounded-xl shadow-sm border transition-all",
              isPlaying 
                ? "bg-blue-500/20 border-blue-500/50 text-blue-500 hover:bg-blue-500/30" 
                : "bg-white/50 dark:bg-zinc-950/50 border-zinc-100/50 dark:border-zinc-900/50 text-zinc-400 hover:bg-white dark:hover:bg-zinc-950"
            )}
            onClick={toggleMusic}
            title={isPlaying ? "Mute Garden" : "Play Meditation Music"}
          >
            {isPlaying ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
          </Button>

          {/* Wishing Coin Button */}
          <Popover>
            <PopoverTrigger asChild>
              <Button 
                variant="ghost" 
                size="icon" 
                disabled={coins === 0 || isCoinTossing}
                className="h-10 w-10 bg-white/50 dark:bg-zinc-950/50 backdrop-blur-md text-amber-500 hover:bg-white dark:hover:bg-zinc-950 rounded-xl shadow-sm border border-zinc-100/50 dark:border-zinc-900/50 relative overflow-hidden"
              >
                <Coins className={cn("h-5 w-5", isCoinTossing && "animate-bounce")} />
                {coins > 0 && (
                  <span className="absolute bottom-0 right-0 bg-amber-500 text-white text-[10px] px-1 rounded-tl-md font-bold">
                    {coins}
                  </span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-64 p-3 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-xl border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-2xl" side="right" align="start">
              <div className="space-y-3">
                <div className="space-y-1">
                  <h4 className="font-medium leading-none flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-amber-500" />
                    Make a Wish
                  </h4>
                  <p className="text-sm text-zinc-500">
                    Throw a coin and choose a mood to recall a past memory.
                  </p>
                </div>
                <div className="grid grid-cols-4 gap-2">
                  {moods.map(mood => (
                    <button
                      key={mood.id}
                      onClick={() => throwCoin(mood.id)}
                      className="flex flex-col items-center gap-1 p-2 rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                    >
                      <span className="text-xl">{mood.emoji}</span>
                      <span className="text-[10px] opacity-60 truncate w-full text-center">{mood.name}</span>
                    </button>
                  ))}
                </div>
              </div>
            </PopoverContent>
          </Popover>
          </div>
        {/* Floating UI Elements */}
        <div className="relative z-10 flex flex-col h-full pointer-events-none">
          {/* Stats Bar (Top) */}
          <div className="p-6 lg:p-12 flex justify-end items-start w-full">
            <AnimatePresence>
              {showStats && (
                <motion.div 
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  className="space-y-1 bg-white/30 dark:bg-zinc-950/30 backdrop-blur-xl p-6 rounded-3xl border border-white/20 dark:border-zinc-900/20 shadow-2xl pointer-events-auto"
                >
                  <h1 className="text-2xl lg:text-3xl font-bold tracking-tight">Memory Garden</h1>
                  <p className="text-[9px] font-bold uppercase tracking-[0.4em] opacity-60">Consistency Breeds Beauty</p>
                  
                  <div className="flex gap-6 mt-4">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-widest opacity-50 mb-1">Streak</p>
                      <p className="text-2xl font-black">{streak} <span className="text-xs font-medium opacity-50">Days</span></p>
                    </div>
                    <div className="w-px h-10 bg-zinc-400/20 self-center" />
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-widest opacity-50 mb-1">Total</p>
                      <p className="text-2xl font-black">{totalEntries}</p>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <AnimatePresence>
              {showStats && (
                <motion.div 
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  className="bg-white/30 dark:bg-zinc-950/30 backdrop-blur-xl p-4 rounded-2xl border border-white/20 dark:border-zinc-900/20 shadow-xl pointer-events-auto hidden lg:block max-w-xs"
                >
                  <div className="flex items-center gap-2 mb-2 font-bold text-[10px] uppercase tracking-widest opacity-70">
                    <Info className="h-3.5 w-3.5 text-blue-500" /> Pond Logic
                  </div>
                  <p className="text-[10px] leading-relaxed opacity-60 font-medium">
                    Tap the water to see ripples. A new lily grows every 8 days. Fish move and create ripples naturally.
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Centered Status (Bottom) */}
          <div className="mt-auto p-8 flex flex-col items-center gap-4 w-full">
            <AnimatePresence>
              {showStats && (
                <motion.div 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 20 }}
                  className="bg-white/30 dark:bg-zinc-950/30 backdrop-blur-xl px-6 py-3 rounded-full border border-white/20 dark:border-zinc-900/20 shadow-lg pointer-events-auto"
                >
                  <p className="text-[10px] font-bold uppercase tracking-[0.2em] flex items-center gap-2">
                    <Droplets className="h-3.5 w-3.5 text-blue-400 animate-pulse" /> 
                    {streak === 0 ? "Begin your journey" : `Day ${streak} • ${lilies.length} Lily Bloom${lilies.length !== 1 ? 's' : ''}`}
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
            
            {/* Music Credit (Tiny) */}
            {isPlaying && (
              <motion.p 
                initial={{ opacity: 0 }}
                animate={{ opacity: 0.4 }}
                className="text-[8px] font-medium tracking-tighter uppercase pointer-events-auto hover:opacity-100 transition-opacity"
              >
                Music: Leigh Robinson via Pixabay
              </motion.p>
            )}
          </div>
        </div>

        {/* Ripples Layer */}
        <div className="absolute inset-0 z-[5] pointer-events-none overflow-hidden">
          <AnimatePresence>
            {ripples.map(ripple => (
              <motion.div
                key={ripple.id}
                initial={{ scale: 0, opacity: 0.5 }}
                animate={{ scale: 4, opacity: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 2, ease: "easeOut" }}
                className="absolute w-32 h-32 border-2 border-white/30 rounded-full"
                style={{ 
                  left: ripple.x - 64, 
                  top: ripple.y - 64,
                }}
              />
            ))}
          </AnimatePresence>
        </div>

        {/* Fish Layer */}
        <div className="absolute inset-0 z-[8] pointer-events-none">
          {fish.map((f) => (
            <motion.div
              key={`fish-${f.id}`}
              animate={{ 
                top: f.top, 
                left: f.left,
                rotate: f.rotation,
                scale: f.scale 
              }}
              whileHover={{
                x: [0, -2, 2, -2, 2, 0],
                y: [0, 1, -1, 1, -1, 0],
                transition: { duration: 0.2, repeat: Infinity }
              }}
              onMouseEnter={() => triggerSplash(f.left, f.top)}
              transition={{ 
                duration: 8, // Slower, more natural swim
                ease: "easeInOut"
              }}
              className="absolute w-12 h-12 lg:w-16 lg:h-16 pointer-events-auto cursor-pointer"
              style={{ transform: "translate(-50%, -50%)" }}
            >
              <motion.img 
                src={`/pond-assets/ponds/fish-${f.type}.png`}
                alt="Swimming Fish"
                animate={{ 
                  x: [0, 1, -1, 0],
                  y: [0, -0.5, 0.5, 0],
                  rotate: [0, 3, -3, 0] // Subtle swimming wiggle
                }}
                transition={{
                  duration: 2.5,
                  repeat: Infinity,
                  ease: "easeInOut"
                }}
                className="w-full h-full object-contain image-pixelated opacity-80"
              />
            </motion.div>
          ))}
        </div>

        {/* Wishing Coin Animation */}
        <AnimatePresence>
          {isCoinTossing && (
            <motion.div
              initial={{ top: "10%", left: "10%", scale: 1, rotate: 0 }}
              animate={{ 
                top: ["10%", "30%", "50%"], 
                left: ["10%", "30%", "50%"],
                scale: [1, 2, 0.8],
                rotate: [0, 720, 1440]
              }}
              exit={{ opacity: 0, scale: 0 }}
              transition={{ duration: 2, ease: "easeInOut" }}
              className="absolute z-50 w-10 h-10 bg-gradient-to-tr from-amber-600 to-amber-300 rounded-full border-2 border-amber-100 shadow-[0_0_20px_rgba(251,191,36,0.6)] flex items-center justify-center pointer-events-none"
              style={{ transform: "translate(-50%, -50%)" }}
            >
              <div className="w-6 h-6 border-2 border-amber-400/50 rounded-full flex items-center justify-center">
                <Sparkles className="h-3 w-3 text-white" />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Lilies Layer */}
        <div className="absolute inset-0 z-10 pointer-events-none">
          {lilies.map((lily) => (
            <motion.div
              key={`lily-${lily.id}`}
              initial={{ scale: 0, opacity: 0, rotate: 0 }}
              animate={{ 
                scale: lily.scale, 
                opacity: 1,
                rotate: [-2, 2, -2]
              }}
              whileHover={{ 
                scale: lily.scale * 1.15,
                rotate: [-5, 5, -5],
                transition: { duration: 1.2, repeat: Infinity, ease: "easeInOut" }
              }}
              transition={{ 
                opacity: { duration: 1 },
                scale: { type: "spring", damping: 15 },
                rotate: { 
                  duration: lily.rotationDuration, 
                  repeat: Infinity, 
                  ease: "easeInOut",
                  delay: lily.delay 
                }
              }}
              className="absolute w-16 h-16 lg:w-24 lg:h-24 pointer-events-auto cursor-pointer"
              style={{ 
                top: lily.top, 
                left: lily.left,
                transform: "translate(-50%, -50%)"
              }}
            >
              <img 
                src={`/pond-assets/lily/lily-stage-${lily.stage}.png`}
                alt={`Lily ${lily.id + 1}`}
                className="w-full h-full object-contain image-pixelated drop-shadow-2xl"
              />
            </motion.div>
          ))}
        </div>
      </main>

      {/* Memory Dialog */}
      <Dialog open={!!memoryToShow} onOpenChange={(open) => !open && setMemoryToShow(null)}>
        <DialogContent className="sm:max-w-[460px] bg-white/80 dark:bg-zinc-950/80 backdrop-blur-3xl border-none rounded-[2.5rem] overflow-hidden shadow-[0_32px_64px_-12px_rgba(0,0,0,0.2)] p-0">
          <div className="p-10">
            <div className="flex flex-col items-center text-center mb-8">
              <motion.div 
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="w-16 h-16 flex items-center justify-center bg-zinc-100 dark:bg-zinc-900 rounded-full mb-4 text-3xl shadow-inner"
              >
                {memoryToShow?.mood_emoji || "✨"}
              </motion.div>
              <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-zinc-400 mb-1">
                {memoryToShow?.created_at && format(new Date(memoryToShow.created_at), "MMMM d, yyyy")}
              </p>
              <h2 className="text-xl font-medium text-zinc-900 dark:text-zinc-100 italic">
                {isFallback ? "A Whispered Echo" : "Memory Found"}
              </h2>
            </div>

            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="space-y-4"
            >
              <h3 className="text-lg font-semibold text-zinc-800 dark:text-zinc-200">
                {memoryToShow?.title || "Untitled"}
              </h3>
              
              <div className="max-h-[220px] overflow-y-auto pr-2 custom-scrollbar text-left">
                <div 
                  className="text-zinc-500 dark:text-zinc-400 leading-relaxed font-light text-sm"
                  dangerouslySetInnerHTML={{ __html: memoryToShow?.content || "" }}
                />
              </div>

              <div className="flex justify-center pt-8">
                <Button 
                  onClick={() => setMemoryToShow(null)}
                  variant="ghost"
                  className="text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 font-bold uppercase tracking-widest text-[10px] hover:bg-transparent transition-all"
                >
                  Return to Pond
                </Button>
              </div>
            </motion.div>
          </div>
        </DialogContent>
      </Dialog>

      <style jsx global>{`
        .image-pixelated {
          image-rendering: pixelated;
          image-rendering: -moz-crisp-edges;
          image-rendering: crisp-edges;
        }
      `}</style>
    </div>
  );
}
