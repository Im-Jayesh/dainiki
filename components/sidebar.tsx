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
  Bot
} from "lucide-react";
import { motion } from "framer-motion";
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

const NAV_ITEMS = [
  { label: "Dashboard", href: "/", icon: LayoutDashboard },
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
  const { user, logout } = useAuth();
  const { theme: systemTheme, setTheme } = useTheme();
  const { appearance, setAppearance, reminders, setReminders } = useSettings();
  const pathname = usePathname();
  const router = useRouter();

  return (
    <motion.aside
      initial={false}
      animate={{ width: open ? 280 : 0, opacity: open ? 1 : 0 }}
      className="border-r border-zinc-100 dark:border-zinc-900 bg-white/50 dark:bg-black/50 backdrop-blur-xl flex flex-col overflow-hidden shrink-0 z-40 relative group/sidebar"
    >
      <div className="p-6 flex items-center justify-between">
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

      <ScrollArea className="flex-1 px-4">
        <div className="space-y-6 pt-2">
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
                  onClick={() => router.push("/entries?view=active")}
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
                        <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-zinc-400"><Bell className="h-3 w-3" /> Reminders</div>
                        <div className="flex items-center justify-between px-1">
                          <span className="text-xs font-medium text-zinc-600 dark:text-zinc-400">Enable Notifications</span>
                          <input 
                            type="checkbox" 
                            checked={reminders.enabled} 
                            onChange={async (e) => {
                              const next = { ...reminders, enabled: e.target.checked };
                              setReminders(next);
                              const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
                              const { updateSettings } = await import("@/lib/actions/auth");
                              await updateSettings({ reminders: next, appearance, timezone });
                              if (e.target.checked) {
                                const OneSignal = (await import("react-onesignal")).default;
                                await OneSignal.Notifications.requestPermission();
                              }
                            }}
                            className="accent-zinc-900 dark:accent-zinc-100"
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-xs font-medium px-1 text-zinc-500">Scheduled Time</label>
                          <Input 
                            type="time" 
                            value={reminders.time} 
                            onChange={async (e) => {
                              const next = { ...reminders, time: e.target.value };
                              setReminders(next);
                              const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
                              const { updateSettings } = await import("@/lib/actions/auth");
                              await updateSettings({ reminders: next, appearance, timezone });
                            }} 
                            className="bg-zinc-50 dark:bg-zinc-900 border-none rounded-xl h-11 w-full" 
                          />
                        </div>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
                
                <Button 
                  variant="ghost" 
                  className="w-full justify-start text-sm font-medium h-11 px-3 rounded-xl text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-900"
                  onClick={logout}
                >
                  <LogOut className="mr-3 h-4 w-4 text-zinc-400" />
                  Lock Vault
                </Button>
             </div>
          </div>
        </div>
      </ScrollArea>
      
      {user && (
        <div className="p-4 mt-auto">
          <div className="bg-zinc-100 dark:bg-zinc-900 rounded-xl p-4 border border-zinc-200 dark:border-zinc-800 flex items-center gap-3">
             <div className="h-10 w-10 rounded-full bg-gradient-to-br from-amber-500 to-rose-500 flex items-center justify-center text-white font-bold text-sm">
               {user.username[0].toUpperCase()}
             </div>
             <div className="flex-1 overflow-hidden text-left">
               <p className="text-xs font-bold truncate text-zinc-900 dark:text-zinc-100">{user.username}</p>
               <p className="text-[9px] font-bold uppercase tracking-wider text-amber-500">{user.credits} AI Credits</p>
             </div>
          </div>
        </div>
      )}
    </motion.aside>
  );
}
