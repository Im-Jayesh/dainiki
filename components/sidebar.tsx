"use client";

import { useAuth } from "@/contexts/auth-context";
import { useSettings } from "@/contexts/settings-context";
import { useTheme } from "next-themes";
import { Button, buttonVariants } from "@/components/ui/button";
import { 
  Calendar as CalendarIcon, 
  ChevronLeft, 
  Settings, 
  LogOut, 
  LayoutDashboard, 
  Database,
  Sun,
  Moon,
  Palette,
  Type,
  Trash2,
  Archive,
  Bell,
  Bot,
  Download,
  Lock,
  ShieldCheck,
  ShieldAlert,
  Sprout,
  Gamepad2
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { SecuritySettings } from "./auth/security-settings";
import { useState, useEffect } from "react";
import { getAllEntries, exportAllEntries } from "@/lib/actions/journal";
import { updateSettings } from "@/lib/actions/auth";
import { isSameDay, subDays } from "date-fns";

const NAV_ITEMS = [
  { label: "Dashboard", href: "/", icon: LayoutDashboard },
  { label: "Garden", href: "/garden", icon: Sprout },
  { label: "Vault", href: "/entries", icon: Database },
  { label: "Palace", href: "/calendar", icon: CalendarIcon },
  { label: "Companion", href: "/chat", icon: Bot },
];

const FONT_FAMILIES = {
  "font-sans": "Geist Sans",
  "font-inter": "Inter",
  "font-serif": "Playfair",
  "font-mono": "Geist Mono",
  "font-display": "Dancing"
};

export function Sidebar({ open, onToggle }: { open: boolean; onToggle: () => void }) {
  const { user, logout, encryptionKey, lock } = useAuth();
  const { theme: systemTheme, setTheme } = useTheme();
  const { appearance, setAppearance, reminders, setReminders } = useSettings();
  const pathname = usePathname();
  const router = useRouter();

  const [streak, setStreak] = useState(0);
  const [lastEntryDate, setLastEntryDate] = useState<string | undefined>(undefined);

  // Local reminder state — loaded from DB (source of truth), not localStorage
  const [reminderEnabled, setReminderEnabled] = useState(false);
  const [reminderTime, setReminderTime] = useState("20:00");
  const [reminderSaving, setReminderSaving] = useState(false);
  const [reminderSaved, setReminderSaved] = useState(false);
  const detectedTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  // Sync reminder state from DB settings whenever user loads
  useEffect(() => {
    if (!user?.settings) return;
    try {
      const s = JSON.parse(user.settings);
      if (s.reminders) {
        setReminderEnabled(s.reminders.enabled ?? false);
        setReminderTime(s.reminders.time ?? "20:00");
      }
    } catch {}
  }, [user]);

  useEffect(() => {
    const calculateStreak = async () => {
      if (!user) return;
      const entries = await getAllEntries();
      if (entries.length === 0) {
        setStreak(0);
        return;
      }

      setLastEntryDate(entries[0].created_at);

      let currentStreak = 0;
      let checkDate = new Date();
      
      // Check if there's an entry today or yesterday to continue streak
      const hasToday = entries.some(e => isSameDay(new Date(e.created_at), checkDate));
      const hasYesterday = entries.some(e => isSameDay(new Date(e.created_at), subDays(checkDate, 1)));

      if (!hasToday && !hasYesterday) {
        setStreak(0);
        return;
      }

      // Start from the most recent day that has an entry
      if (!hasToday) checkDate = subDays(checkDate, 1);

      while (true) {
        const hasEntry = entries.some(e => isSameDay(new Date(e.created_at), checkDate));
        if (hasEntry) {
          currentStreak++;
          checkDate = subDays(checkDate, 1);
        } else {
          break;
        }
      }
      setStreak(currentStreak);
    };

    calculateStreak();
  }, [user]);

  return (
    <>
      {/* Backdrop for mobile */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onToggle}
            className="fixed inset-0 bg-black/20 dark:bg-black/40 backdrop-blur-sm z-40 lg:hidden"
          />
        )}
      </AnimatePresence>

      <motion.aside
        initial={false}
        animate={{ 
          width: open ? 280 : 0, 
          x: open ? 0 : -280,
          opacity: open ? 1 : 0 
        }}
        transition={{ type: "spring", damping: 20, stiffness: 300 }}
        className={cn(
          "h-screen lg:h-full border-r border-zinc-100 dark:border-zinc-900 bg-white/80 dark:bg-black/80 backdrop-blur-2xl flex flex-col overflow-hidden shrink-0 z-50 fixed top-0 left-0 bottom-0 lg:relative group/sidebar shadow-2xl lg:shadow-none",
          !open && "pointer-events-none lg:pointer-events-auto"
        )}
      >
        <div className="p-6 flex items-center justify-between shrink-0">
          <motion.h1 
            animate={{ opacity: open ? 1 : 0 }}
            className="text-xs font-bold tracking-[0.3em] uppercase text-zinc-400"
          >
            Dainiki
          </motion.h1>
          <Button variant="ghost" size="icon" className="h-8 w-8 text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors" onClick={onToggle}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
        </div>

        <ScrollArea className="flex-1 px-4 min-h-0">
          <div className="space-y-6 pt-2 pb-8">
            <div>
              <p className="px-3 mb-3 text-[10px] font-bold uppercase tracking-widest text-zinc-400 opacity-50">Navigation</p>
              <div className="space-y-1">
                {NAV_ITEMS.map((item) => {
                  const active = pathname === item.href;
                  return (
                    <Link key={item.href} href={item.href}>
                      <Button 
                        variant="ghost" 
                        className={cn(
                          "w-full justify-start text-sm font-medium h-11 px-3 rounded-xl transition-all relative group",
                          active ? "bg-zinc-900 text-zinc-50 dark:bg-white dark:text-zinc-900 shadow-lg" : "text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-900"
                        )}
                      >
                        <item.icon className={cn("mr-3 h-4 w-4 transition-transform group-hover:scale-110", active ? "text-zinc-50 dark:text-zinc-900" : "text-zinc-400")} />
                        {item.label}
                        {active && (
                          <motion.div 
                            layoutId="nav-pill" 
                            className="absolute inset-0 rounded-xl bg-zinc-900 dark:bg-white -z-10" 
                          />
                        )}
                      </Button>
                    </Link>
                  );
                })}
              </div>
            </div>

            <Separator className="bg-zinc-100 dark:bg-zinc-900/50" />

            <div>
               <p className="px-3 mb-3 text-[10px] font-bold uppercase tracking-widest text-zinc-400 opacity-50">Filter View</p>
               <div className="space-y-1">
                  <Button 
                    variant="ghost" 
                    className="w-full justify-start text-sm font-medium h-11 px-3 rounded-xl text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-900"
                    onClick={() => router.push("/entries")}
                  >
                    <LayoutDashboard className="mr-3 h-4 w-4 text-zinc-400" />
                    Journal
                  </Button>
                  <Button 
                    variant="ghost" 
                    className="w-full justify-start text-sm font-medium h-11 px-3 rounded-xl text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-900"
                    onClick={() => router.push("/entries?view=archived")}
                  >
                    <Archive className="mr-3 h-4 w-4 text-zinc-400" />
                    Archive
                  </Button>
                  <Button 
                    variant="ghost" 
                    className="w-full justify-start text-sm font-medium h-11 px-3 rounded-xl text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-900"
                    onClick={() => router.push("/entries?view=deleted")}
                  >
                    <Trash2 className="mr-3 h-4 w-4 text-zinc-400" />
                    Bin
                  </Button>
               </div>
            </div>

            <Separator className="bg-zinc-100 dark:bg-zinc-900/50" />

            <div>
               <p className="px-3 mb-3 text-[10px] font-bold uppercase tracking-widest text-zinc-400 opacity-50">Settings</p>
               <div className="space-y-1">
                  <Dialog>
                    <DialogTrigger className={cn(buttonVariants({ variant: "ghost" }), "w-full justify-start text-sm font-medium h-11 px-3 rounded-xl text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-900")}>
                      <ShieldCheck className="mr-3 h-4 w-4 text-zinc-400" />
                      Vault Security
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-[425px] rounded-xl border-zinc-100 dark:border-zinc-900 shadow-2xl overflow-y-auto max-h-[90vh]">
                      <DialogHeader>
                        <DialogTitle className="text-xl font-bold tracking-tight">Vault Security</DialogTitle>
                        <DialogDescription className="text-xs uppercase tracking-widest font-bold text-zinc-400">Manage your credentials and encryption</DialogDescription>
                      </DialogHeader>
                      <SecuritySettings />
                    </DialogContent>
                  </Dialog>

                  <Dialog>
                    <DialogTrigger className={cn(buttonVariants({ variant: "ghost" }), "w-full justify-start text-sm font-medium h-11 px-3 rounded-xl text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-900")}>
                      <Settings className="mr-3 h-4 w-4 text-zinc-400" />
                      Appearance
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-[425px] rounded-xl border-zinc-100 dark:border-zinc-900 shadow-2xl overflow-y-auto max-h-[90vh]">
                      <DialogHeader>
                        <DialogTitle className="text-xl font-bold tracking-tight">Vault Appearance</DialogTitle>
                        <DialogDescription className="text-xs uppercase tracking-widest font-bold text-zinc-400">Personalize your majestic experience</DialogDescription>
                      </DialogHeader>
                      <div className="space-y-6 py-4">
                        <div className="space-y-4">
                          <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-zinc-400"><Sun className="h-3 w-3" /> Visual Mode</div>
                          <div className="grid grid-cols-2 gap-2">
                            <Button variant="outline" size="sm" className={cn("rounded-xl h-9 text-xs", systemTheme === "light" && "border-zinc-900 dark:border-zinc-100")} onClick={() => setTheme("light")}>
                              <Sun className="h-4 w-4 mr-2" /> Light
                            </Button>
                            <Button variant="outline" size="sm" className={cn("rounded-xl h-9 text-xs", systemTheme === "dark" && "border-zinc-900 dark:border-zinc-100")} onClick={() => setTheme("dark")}>
                              <Moon className="h-4 w-4 mr-2" /> Dark
                            </Button>
                          </div>
                        </div>

                        <Separator className="bg-zinc-100 dark:bg-zinc-800" />

                        <div className="space-y-4">
                          <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-zinc-400"><Palette className="h-3 w-3" /> Vault Theme</div>
                          <div className="flex gap-3 px-1">
                            {["zinc", "rose", "slate", "velvet"].map((t) => (
                              <button
                                key={t}
                                type="button"
                                onClick={() => setAppearance({ ...appearance, theme: t })}
                                className={cn(
                                  "h-10 w-10 rounded-full border-4 transition-all hover:scale-110",
                                  appearance.theme === t ? "border-white dark:border-zinc-800 ring-2 ring-zinc-900 dark:ring-white" : "border-transparent",
                                  t === 'zinc' ? 'bg-zinc-500' : t === 'rose' ? 'bg-[#fb7185]' : t === 'slate' ? 'bg-[#94a3b8]' : 'bg-[#a78bfa]'
                                )}
                              />
                            ))}
                          </div>
                        </div>

                        <Separator className="bg-zinc-100 dark:bg-zinc-800" />

                        <div className="space-y-4">
                          <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-zinc-400"><Type className="h-3 w-3" /> Typography</div>
                          <div className="grid grid-cols-2 gap-2">
                            {Object.entries(FONT_FAMILIES).map(([key, label]) => (
                              <Button 
                                key={key} 
                                variant="outline" 
                                size="sm" 
                                className={cn("rounded-xl h-9 text-xs", appearance.fontFamily === key ? "border-zinc-900 dark:border-zinc-100" : "border-zinc-100 dark:border-zinc-900")} 
                                onClick={() => setAppearance({ ...appearance, fontFamily: key })}
                              >
                                {label}
                              </Button>
                            ))}
                          </div>
                        </div>

                        <Separator className="bg-zinc-100 dark:bg-zinc-800" />

                        <div className="space-y-4">
                          <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-zinc-400"><Bell className="h-3 w-3" /> Email Reminders</div>
                          
                          {/* Timezone display */}
                          <div className="px-1 py-2 rounded-lg bg-zinc-50 dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800">
                            <p className="text-[9px] font-bold uppercase tracking-widest text-zinc-400 mb-0.5">Detected Timezone</p>
                            <p className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">{detectedTimezone}</p>
                          </div>

                          <div className="flex items-center justify-between px-1">
                            <span className="text-xs font-medium text-zinc-600 dark:text-zinc-400">Enable Reminders</span>
                            <input 
                              type="checkbox" 
                              checked={reminderEnabled} 
                              onChange={(e) => setReminderEnabled(e.target.checked)}
                              className="accent-zinc-900 dark:accent-zinc-100"
                            />
                          </div>
                          <div className="space-y-2">
                            <label className="text-xs font-medium px-1 text-zinc-500">Scheduled Time</label>
                            <div className="flex items-center gap-1.5">
                              <div className="relative flex-1">
                                <select 
                                  value={(() => {
                                    let h = parseInt(reminderTime.split(":")[0], 10);
                                    if (isNaN(h)) h = 20;
                                    if (h === 0) h = 12;
                                    else if (h > 12) h -= 12;
                                    return h.toString();
                                  })()}
                                  onChange={(e) => {
                                    const val = parseInt(e.target.value, 10);
                                    let h24 = parseInt(reminderTime.split(":")[0], 10);
                                    if (isNaN(h24)) h24 = 20;
                                    const isPM = h24 >= 12;
                                    let newH24 = val;
                                    if (isPM && val < 12) newH24 += 12;
                                    if (!isPM && val === 12) newH24 = 0;
                                    const mStr = reminderTime.split(":")[1] || "00";
                                    setReminderTime(`${newH24.toString().padStart(2, '0')}:${mStr}`);
                                  }}
                                  className="w-full bg-zinc-50 dark:bg-zinc-900 border-none rounded-xl h-11 px-3 text-sm font-medium focus:ring-2 focus:ring-zinc-900/10 dark:focus:ring-zinc-100/10 transition-shadow appearance-none cursor-pointer outline-none"
                                >
                                  {Array.from({ length: 12 }).map((_, i) => (
                                    <option key={i + 1} value={i + 1}>{i + 1}</option>
                                  ))}
                                </select>
                                <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none opacity-40">
                                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
                                </div>
                              </div>
                              <span className="text-zinc-400 font-bold opacity-50">:</span>
                              <div className="relative flex-1">
                                <select 
                                  value={reminderTime.split(":")[1] || "00"}
                                  onChange={(e) => {
                                    const hStr = reminderTime.split(":")[0] || "20";
                                    setReminderTime(`${hStr}:${e.target.value.padStart(2, '0')}`);
                                  }}
                                  className="w-full bg-zinc-50 dark:bg-zinc-900 border-none rounded-xl h-11 px-3 text-sm font-medium focus:ring-2 focus:ring-zinc-900/10 dark:focus:ring-zinc-100/10 transition-shadow appearance-none cursor-pointer outline-none"
                                >
                                  {Array.from({ length: 12 }).map((_, i) => {
                                    const m = (i * 5).toString().padStart(2, '0');
                                    return <option key={m} value={m}>{m}</option>;
                                  })}
                                </select>
                                <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none opacity-40">
                                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
                                </div>
                              </div>
                              <div className="relative flex-1">
                                <select 
                                  value={(() => {
                                    let h = parseInt(reminderTime.split(":")[0], 10);
                                    if (isNaN(h)) h = 20;
                                    return h >= 12 ? "PM" : "AM";
                                  })()}
                                  onChange={(e) => {
                                    const isPM = e.target.value === "PM";
                                    let h24 = parseInt(reminderTime.split(":")[0], 10);
                                    if (isNaN(h24)) h24 = 20;
                                    let newH24 = h24;
                                    if (isPM && h24 < 12) newH24 += 12;
                                    if (!isPM && h24 >= 12) newH24 -= 12;
                                    const mStr = reminderTime.split(":")[1] || "00";
                                    setReminderTime(`${newH24.toString().padStart(2, '0')}:${mStr}`);
                                  }}
                                  className="w-full bg-zinc-50 dark:bg-zinc-900 border-none rounded-xl h-11 px-3 text-xs font-bold tracking-wider uppercase focus:ring-2 focus:ring-zinc-900/10 dark:focus:ring-zinc-100/10 transition-shadow appearance-none cursor-pointer outline-none"
                                >
                                  <option value="AM">AM</option>
                                  <option value="PM">PM</option>
                                </select>
                                <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none opacity-40">
                                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
                                </div>
                              </div>
                            </div>
                          </div>
                          <Button
                            onClick={async () => {
                              setReminderSaving(true);
                              setReminderSaved(false);
                              try {
                                await updateSettings({ appearance, timezone: detectedTimezone });
                                const res = await fetch("/api/reminders/schedule", {
                                  method: "POST",
                                  headers: { "Content-Type": "application/json" },
                                  body: JSON.stringify({
                                    userId: user?.userId,
                                    enabled: reminderEnabled,
                                    time: reminderTime,
                                    timezone: detectedTimezone,
                                  }),
                                });
                                const data = await res.json();
                                console.log("[Reminder saved]", data);
                                // Also update local context/localStorage so it reflects immediately
                                setReminders({ ...reminders, enabled: reminderEnabled, time: reminderTime });
                                setReminderSaved(true);
                                setTimeout(() => setReminderSaved(false), 3000);
                              } catch (e) {
                                console.error("[Reminder save failed]", e);
                              } finally {
                                setReminderSaving(false);
                              }
                            }}
                            disabled={reminderSaving}
                            size="sm"
                            className="w-full h-10 rounded-xl text-xs font-bold uppercase tracking-wider"
                          >
                            {reminderSaving ? "Saving..." : reminderSaved ? "✓ Saved!" : "Save Reminder"}
                          </Button>
                        </div>
                      </div>
                    </DialogContent>
                  </Dialog>
                  
                  <Button 
                    variant="ghost" 
                    className="w-full justify-start text-sm font-medium h-11 px-3 rounded-xl text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-900"
                    onClick={async () => {
                      const { decrypt } = await import("@/lib/crypto");
                      const entries = await exportAllEntries();
                      const decrypted = await Promise.all(entries.map(async (e: any) => {
                        try {
                          const key = encryptionKey || sessionStorage.getItem("dainiki_vault_key");
                          if (!key) throw new Error("Key missing");
                          const title = await decrypt(e.title, key, user!.salt);
                          const content = await decrypt(e.content, key, user!.salt);
                          return { ...e, title, content };
                        } catch {
                          return { ...e, title: "[Decryption Failed]", content: "" };
                        }
                      }));
                      const blob = new Blob([JSON.stringify(decrypted, null, 2)], { type: "application/json" });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement("a");
                      a.href = url;
                      a.download = `dainiki-backup-${new Date().toISOString().split('T')[0]}.json`;
                      a.click();
                      URL.revokeObjectURL(url);
                    }}
                  >
                    <Download className="mr-3 h-4 w-4 text-zinc-400" />
                    Backup Vault
                  </Button>

                  <Button 
                    variant="ghost" 
                    className="w-full justify-start text-sm font-medium h-11 px-3 rounded-xl text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-900"
                    onClick={lock}
                  >
                    <Lock className="mr-3 h-4 w-4 text-zinc-400" />
                    Lock Vault
                  </Button>

                  <Button 
                    variant="ghost" 
                    className="w-full justify-start text-sm font-medium h-11 px-3 rounded-xl text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-900"
                    onClick={logout}
                  >
                    <LogOut className="mr-3 h-4 w-4 text-zinc-400" />
                    Logout
                  </Button>
               </div>
            </div>
          </div>
        </ScrollArea>
        
        {user && (
          <div className="p-4 mt-auto border-t border-zinc-100 dark:border-zinc-900 bg-white/50 dark:bg-black/50">
            <div className="bg-zinc-100 dark:bg-zinc-900 rounded-xl p-3 border border-zinc-200 dark:border-zinc-800 flex items-center gap-3">
               <div className="h-8 w-8 rounded-full bg-gradient-to-br from-amber-500 to-rose-500 flex items-center justify-center text-white font-bold text-xs shrink-0">
                 {user.username[0].toUpperCase()}
               </div>
               <div className="flex-1 overflow-hidden text-left">
                 <p className="text-[11px] font-bold truncate text-zinc-900 dark:text-zinc-100 leading-tight">{user.username}</p>
                 <p className="text-[9px] font-bold uppercase tracking-wider text-amber-500 leading-tight">{user.credits} AI Credits</p>
               </div>
            </div>
          </div>
        )}
      </motion.aside>
    </>
  );
}
