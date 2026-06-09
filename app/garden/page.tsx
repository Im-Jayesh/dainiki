"use client";

import { useAuth } from "@/contexts/auth-context";
import { useSettings } from "@/contexts/settings-context";
import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { getAllEntries, fetchMoods } from "@/lib/actions/journal";
import { getEcho, castEcho, reactToEcho, getMyEchoes } from "@/lib/actions/echoes";
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
  Sparkles,
  Send,
  Heart,
  MessageCircleHeart,
  ScrollText,
  MailOpen
} from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from "@/components/ui/dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import { isSameDay, subDays, format } from "date-fns";
import { decrypt } from "@/lib/crypto";
import { useTheme } from "next-themes";
import { toast } from "sonner";

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
  massive?: boolean;
}

interface Fish {
  id: number;
  type: 1 | 2;
  top: string;
  left: string;
  rotation: number;
  scale: number;
  direction: number;
  isJumping: boolean;
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

  // Fish state
  const [fish, setFish] = useState<Fish[]>([
    { id: 1, type: 1, top: "30%", left: "40%", rotation: 0, scale: 0.8 + Math.random() * 0.4, direction: 1, isJumping: false },
    { id: 2, type: 2, top: "60%", left: "70%", rotation: 0, scale: 0.8 + Math.random() * 0.4, direction: -1, isJumping: false },
    { id: 3, type: 2, top: "50%", left: "20%", rotation: 0, scale: 0.8 + Math.random() * 0.4, direction: 1, isJumping: false },
  ]);

  // Wishing Coin State
  const [coins, setCoins] = useState(2);
  const [isCoinTossing, setIsCoinTossing] = useState(false);
  const [memoryToShow, setMemoryToShow] = useState<any>(null);
  const [moods, setMoods] = useState<any[]>([]);
  const [isFallback, setIsFallback] = useState(false);
  const [allEntries, setAllEntries] = useState<any[]>([]);

  // Echoes State
  const [floatingEcho, setFloatingEcho] = useState<any>(null);
  const [echoToShow, setEchoToShow] = useState<any>(null);
  const [isCastingEcho, setIsCastingEcho] = useState(false);
  const [isAnimatingCast, setIsAnimatingCast] = useState(false);
  const [newEchoContent, setNewEchoContent] = useState("");
  const [myEchoes, setMyEchoes] = useState<any[]>([]);
  const [showMyEchoes, setShowMyEchoes] = useState(false);

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

  // Load a random echo
  useEffect(() => {
    const fetchEcho = async () => {
      try {
        const echo = await getEcho();
        if (echo) {
          // Give it a random starting position
          setFloatingEcho({
            ...echo,
            top: `${10 + Math.random() * 80}%`,
            left: `${10 + Math.random() * 80}%`
          });
        }
      } catch (e) {
        // ignore
      }
    };
    // Fetch an echo 5 seconds after load
    const timer = setTimeout(fetchEcho, 5000);
    return () => clearTimeout(timer);
  }, []);

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
        
        // Calculate angle towards next position for slight tilt
        const currentTopNum = parseFloat(f.top);
        const currentLeftNum = parseFloat(f.left);
        
        const isMovingLeft = nextLeft < currentLeftNum;
        const direction = isMovingLeft ? -1 : 1;
        
        // Gentle up/down tilt based on vertical movement
        const verticalDiff = nextTop - currentTopNum;
        const tilt = (verticalDiff * 0.5) * direction; // Tilt up/down

        return {
          ...f,
          top: `${nextTop}%`,
          left: `${nextLeft}%`,
          rotation: tilt, 
          direction: direction
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

  const triggerSplash = useCallback((left: string, top: string, isMassive = false) => {
    if (!mainRef.current) return;
    const { width, height } = mainRef.current.getBoundingClientRect();
    const x = (parseFloat(left) / 100) * width;
    const y = (parseFloat(top) / 100) * height;

    let splashRipples: Ripple[] = [];

    if (isMassive) {
      splashRipples = [
        { id: Date.now() + Math.random(), x, y, massive: true },
        { id: Date.now() + Math.random(), x: x + 25, y: y + 15, massive: true },
        { id: Date.now() + Math.random(), x: x - 25, y: y - 15, massive: true },
        { id: Date.now() + Math.random(), x: x + 5, y: y + 35, massive: true },
        { id: Date.now() + Math.random(), x: x - 10, y: y - 25, massive: true },
      ];
    } else {
      splashRipples = [
        { id: Date.now() + Math.random(), x, y },
        { id: Date.now() + Math.random(), x: x + 10, y: y + 5 },
        { id: Date.now() + Math.random(), x: x - 5, y: y - 10 },
      ];
    }

    setRipples(prev => [...prev, ...splashRipples]);
    
    setTimeout(() => {
      const ids = splashRipples.map(r => r.id);
      setRipples(prev => prev.filter(r => !ids.includes(r.id)));
    }, isMassive ? 3500 : 1500); // Massive ripples last longer
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

  // Echoes Logic
  const handleCastEcho = async () => {
    if (!newEchoContent.trim()) return toast.error("Echo cannot be empty.");
    try {
      await castEcho(newEchoContent);
      setIsCastingEcho(false);
      setNewEchoContent("");
      setIsAnimatingCast(true);
      
      // Bottle hits water
      setTimeout(() => {
        triggerSplash("50%", "50%", true);
      }, 900); // 900ms matches the drop phase in the CSS animation

      // Animation finishes, bottle sinks
      setTimeout(() => {
        setIsAnimatingCast(false);
        toast.success("Echo cast into the void. ✨");
      }, 3000); // 3000ms matches total animation duration
    } catch (e: any) {
      toast.error(e.message || "Failed to cast echo");
    }
  };

  const handleReactToEcho = async (emoji: string) => {
    if (!echoToShow) return;
    try {
      await reactToEcho(echoToShow.id, emoji);
      toast.success(`Reacted with ${emoji}`);
      setEchoToShow(null);
      setFloatingEcho(null); // remove it from the pond
    } catch (e: any) {
      toast.error("Failed to send reaction.");
    }
  };

  const handleOpenMyEchoes = async () => {
    try {
      const data = await getMyEchoes();
      setMyEchoes(data);
      setShowMyEchoes(true);
    } catch (e) {
      toast.error("Failed to load your echoes.");
    }
  };

  const lilies = useMemo(() => {
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

          <Button 
            variant="ghost" 
            size="icon" 
            className="h-10 w-10 bg-white/50 dark:bg-zinc-950/50 backdrop-blur-md text-pink-500 hover:bg-white dark:hover:bg-zinc-950 rounded-xl shadow-sm border border-zinc-100/50 dark:border-zinc-900/50 relative overflow-hidden"
            onClick={() => setIsCastingEcho(true)}
            title="Cast an Echo"
          >
            <Send className="h-4 w-4" />
          </Button>

          <Button 
            variant="ghost" 
            size="icon" 
            className="h-10 w-10 bg-white/50 dark:bg-zinc-950/50 backdrop-blur-md text-purple-500 hover:bg-white dark:hover:bg-zinc-950 rounded-xl shadow-sm border border-zinc-100/50 dark:border-zinc-900/50 relative overflow-hidden"
            onClick={handleOpenMyEchoes}
            title="My Echoes"
          >
            <ScrollText className="h-4 w-4" />
          </Button>

          {/* Wishing Coin Button */}
          <Popover>
            <PopoverTrigger
              disabled={coins === 0 || isCoinTossing}
              className={cn(
                buttonVariants({ variant: "ghost", size: "icon" }),
                "h-10 w-10 bg-white/50 dark:bg-zinc-950/50 backdrop-blur-md text-amber-500 hover:bg-white dark:hover:bg-zinc-950 rounded-xl shadow-sm border border-zinc-100/50 dark:border-zinc-900/50 relative overflow-hidden"
              )}
            >
              <Coins className={cn("h-5 w-5", isCoinTossing && "animate-bounce")} />
              {coins > 0 && (
                <span className="absolute bottom-0 right-0 bg-amber-500 text-white text-[10px] px-1 rounded-tl-md font-bold">
                  {coins}
                </span>
              )}
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
                animate={{ scale: ripple.massive ? 12 : 4, opacity: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: ripple.massive ? 3.5 : 2, ease: "easeOut" }}
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
              initial={{ top: f.top, left: f.left, scale: 0, opacity: 0 }}
              animate={{ 
                top: f.top, 
                left: f.left,
                scale: f.scale,
                opacity: 1
              }}
              whileHover={{
                x: [0, -2, 2, -2, 2, 0],
                y: [0, 1, -1, 1, -1, 0],
                transition: { duration: 0.2, repeat: Infinity }
              }}
              onMouseEnter={() => triggerSplash(f.left, f.top)}
              transition={{ 
                duration: 8, // Slower, more natural swim
                ease: "easeInOut",
                scale: { duration: 2, ease: "easeOut" },
                opacity: { duration: 2, ease: "easeOut" }
              }}
              className="absolute w-12 h-12 lg:w-16 lg:h-16 pointer-events-auto cursor-pointer"
              style={{ transform: "translate(-50%, -50%)" }}
            >
              {/* Fish Sprite */}
              <motion.img 
                src={`/pond-assets/ponds/fish-${f.type}.png`}
                alt="Swimming Fish"
                animate={{ 
                  x: [0, 1, -1, 0],
                  y: [0, -0.5, 0.5, 0],
                  rotate: [f.rotation, f.rotation + 3, f.rotation - 3, f.rotation], // Subtle swimming wiggle
                  scaleX: f.direction
                }}
                transition={{
                  duration: 2.5,
                  repeat: Infinity,
                  ease: "easeInOut"
                }}
                className="w-full h-full object-contain image-pixelated opacity-80"
              />
              {/* Bubbles behind fish */}
              <motion.div
                animate={{ opacity: [0, 0.8, 0], scale: [0.5, 1.2, 1.5], y: [0, -20, -30] }}
                transition={{ duration: 3, repeat: Infinity, ease: "easeOut", delay: f.id * 0.5 }}
                className="absolute top-1/2 left-1/2 w-1.5 h-1.5 rounded-full border border-white/40 bg-white/10"
                style={{ transform: `translate(-50%, -50%) translateX(${f.direction * -20}px)` }}
              />
              <motion.div
                animate={{ opacity: [0, 0.6, 0], scale: [0.3, 1, 1.2], y: [0, -15, -25], x: [0, 5, -5] }}
                transition={{ duration: 2.5, repeat: Infinity, ease: "easeOut", delay: (f.id * 0.5) + 1 }}
                className="absolute top-1/2 left-1/2 w-1 h-1 rounded-full border border-white/30 bg-white/10"
                style={{ transform: `translate(-50%, -50%) translateX(${f.direction * -15}px)` }}
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

        {/* Floating Echo (Bottle - Receiver) */}
        <AnimatePresence>
          {floatingEcho && (
            <motion.div
              initial={{ scale: 0, opacity: 0, y: 20 }}
              animate={{ 
                scale: 1, 
                opacity: 1, 
                y: [0, -10, 0],
                rotate: [-5, 5, -5]
              }}
              exit={{ scale: 0, opacity: 0 }}
              transition={{
                y: { duration: 3, repeat: Infinity, ease: "easeInOut" },
                rotate: { duration: 4, repeat: Infinity, ease: "easeInOut" },
                opacity: { duration: 1 },
                scale: { duration: 1, type: "spring" }
              }}
              className="absolute z-20 pointer-events-auto cursor-pointer flex flex-col items-center gap-2 group"
              style={{ top: floatingEcho.top, left: floatingEcho.left }}
              onClick={() => setEchoToShow(floatingEcho)}
            >
              <div className="relative w-16 h-16 group-hover:scale-110 transition-transform flex items-center justify-center">
                <div className="absolute inset-0 bg-blue-400/20 rounded-full blur-xl animate-pulse" />
                <img src="/bottle.png" alt="Message in a bottle" className="w-12 h-12 object-contain drop-shadow-lg relative z-10" />
              </div>
              <span className="text-[9px] font-bold uppercase tracking-widest text-zinc-800 dark:text-white bg-white/50 dark:bg-black/50 px-2 py-0.5 rounded-full backdrop-blur-md opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                An Echo
              </span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Cast Echo Animation (Sender) */}
        <AnimatePresence>
          {isAnimatingCast && (
            <motion.div
              className="absolute z-[25] pointer-events-none"
              style={{ top: "-10%", left: "50%", transform: "translate(-50%, -50%)" }}
              animate={{ 
                top: ["-10%", "50%", "50%", "55%"], 
                rotate: [-20, 10, -5, 0],
                scale: [1, 1, 0.8, 0],
                opacity: [1, 1, 0.8, 0]
              }}
              transition={{ 
                duration: 3, 
                times: [0, 0.3, 0.4, 1], // 0-0.3: fall, 0.3: hit (splash), 0.3-1: sink
                ease: "easeInOut" 
              }}
            >
              <img src="/bottle.png" alt="Casting Echo" className="w-16 h-16 object-contain drop-shadow-2xl" />
              {/* Bubbles going up as bottle goes down */}
              <motion.div
                initial={{ opacity: 0, y: 0 }}
                animate={{ opacity: [0, 1, 0], y: -50 }}
                transition={{ duration: 1.5, delay: 1 }}
                className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex gap-2"
              >
                <div className="w-2 h-2 rounded-full border border-white/50" />
                <div className="w-3 h-3 rounded-full border border-white/50 -translate-y-2" />
                <div className="w-1.5 h-1.5 rounded-full border border-white/50 translate-y-1" />
              </motion.div>
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

      {/* View Echo Dialog */}
      <Dialog open={!!echoToShow} onOpenChange={(open) => !open && setEchoToShow(null)}>
        <DialogContent className="sm:max-w-[425px] bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-[2rem] shadow-2xl p-0 overflow-hidden">
          <div className="p-8">
            <DialogHeader className="mb-6">
              <DialogTitle className="flex items-center justify-center gap-2 text-2xl font-serif italic text-zinc-900 dark:text-zinc-100">
                <MessageCircleHeart className="h-6 w-6 text-pink-500" />
                An Echo from the Void
              </DialogTitle>
            </DialogHeader>
            <div className="py-6 px-4 text-center bg-zinc-50 dark:bg-zinc-900/50 rounded-2xl border border-zinc-100 dark:border-zinc-800 mb-8">
              <p className="text-lg font-medium text-zinc-800 dark:text-zinc-200 leading-relaxed italic">
                "{echoToShow?.content}"
              </p>
            </div>
            <div>
              <p className="text-center text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-4">React to this echo</p>
              <div className="flex flex-wrap justify-center gap-3">
                {["❤️", "🙏", "✨", "🫂", "🌟"].map((emoji) => (
                  <button
                    key={emoji}
                    onClick={() => handleReactToEcho(emoji)}
                    className="h-14 w-14 flex items-center justify-center bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-900 dark:hover:bg-zinc-800 rounded-2xl transition-all border border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 shadow-sm"
                  >
                    <span className="text-2xl drop-shadow-sm">{emoji}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Cast Echo Dialog */}
      <Dialog open={isCastingEcho} onOpenChange={setIsCastingEcho}>
        <DialogContent className="sm:max-w-[425px] bg-white/90 dark:bg-zinc-950/90 backdrop-blur-2xl border border-white/20 dark:border-zinc-800/50 rounded-[2rem] shadow-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl font-serif italic text-zinc-800 dark:text-zinc-200">
              <Send className="h-5 w-5 text-pink-500" />
              Cast an Echo
            </DialogTitle>
            <DialogDescription className="text-zinc-500">
              Write a short, anonymous thought. It will float in the pond for others to find. It is not encrypted with your personal key.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Textarea 
              placeholder="What's on your mind right now?"
              value={newEchoContent}
              onChange={e => setNewEchoContent(e.target.value)}
              className="resize-none h-32 bg-white/50 dark:bg-zinc-900/50 border-zinc-200/50 dark:border-zinc-800/50 rounded-xl placeholder:text-zinc-400 focus-visible:ring-pink-500/50"
              maxLength={500}
            />
            <p className="text-right text-[10px] text-zinc-400 mt-2 font-medium">{newEchoContent.length}/500</p>
          </div>
          <DialogFooter>
            <Button className="w-full h-12 rounded-xl bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-600 hover:to-rose-600 text-white font-bold tracking-widest uppercase text-xs shadow-lg shadow-pink-500/20" onClick={handleCastEcho}>
              Cast into the Void
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* My Echoes Dialog */}
      <Dialog open={showMyEchoes} onOpenChange={setShowMyEchoes}>
        <DialogContent className="sm:max-w-[500px] bg-white/90 dark:bg-zinc-950/90 backdrop-blur-2xl border border-white/20 dark:border-zinc-800/50 rounded-[2rem] shadow-2xl overflow-hidden flex flex-col max-h-[80vh]">
          <DialogHeader className="px-6 pt-6 pb-2 shrink-0">
            <DialogTitle className="flex items-center gap-2 text-xl font-serif italic text-zinc-800 dark:text-zinc-200">
              <ScrollText className="h-5 w-5 text-purple-500" />
              Your Echoes
            </DialogTitle>
            <DialogDescription className="text-zinc-500">
              Thoughts you have cast into the void and the reactions they received.
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto px-6 py-2 space-y-4 custom-scrollbar">
            {myEchoes.length === 0 ? (
              <div className="text-center py-12 text-zinc-400">
                <p className="font-serif italic text-lg mb-2">The water is still.</p>
                <p className="text-xs uppercase tracking-widest">You haven't cast any echoes yet.</p>
              </div>
            ) : (
              myEchoes.map(echo => (
                <div key={echo.id} className="p-4 bg-white/50 dark:bg-zinc-900/50 rounded-2xl border border-zinc-100 dark:border-zinc-800 shadow-sm relative overflow-hidden group">
                  <p className="text-sm text-zinc-700 dark:text-zinc-300 leading-relaxed pr-8">
                    "{echo.content}"
                  </p>
                  <p className="text-[9px] font-bold uppercase tracking-widest text-zinc-400 mt-3">
                    {format(new Date(echo.created_at), "MMM d, yyyy")}
                  </p>
                  {echo.reaction_emoji && (
                    <div className="absolute top-4 right-4 text-2xl drop-shadow-md animate-bounce">
                      {echo.reaction_emoji}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
          <div className="px-6 py-4 bg-zinc-50/50 dark:bg-zinc-950/50 border-t border-zinc-100 dark:border-zinc-800 shrink-0">
             <Button variant="ghost" className="w-full text-zinc-500" onClick={() => setShowMyEchoes(false)}>
               Close
             </Button>
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

function HandsPrayingIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
      <path d="m14 18-4-4v-4" />
      <path d="m10 18 4-4v-4" />
      <path d="m16 12 3 3v4a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-4l3-3" />
      <path d="M12 6a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z" />
    </svg>
  );
}
