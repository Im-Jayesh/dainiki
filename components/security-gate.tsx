"use client";

import { useAuth } from "@/contexts/auth-context";
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { LoginForm } from "./auth/login-form";
import { SetupForm } from "./auth/setup-form";
import { RecoveryForm } from "./auth/recovery-form";
import { login, loginWithPin, getUserData } from "@/lib/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Lock } from "lucide-react";
import { decrypt } from "@/lib/crypto";

export function SecurityGate({ children }: { children: React.ReactNode }) {
  const { isAuth, isVerified, isLoading, user, setEncryptionKey, isLocked, lock } = useAuth();
  const [view, setView] = useState<"login" | "register" | "recovery" | "verify">("login");

  // Lock Screen States
  const [unlockPassword, setUnlockPassword] = useState("");
  const [unlockPin, setUnlockPin] = useState("");
  const [isUnlocking, setIsUnlocking] = useState(false);
  const [unlockError, setUnlockError] = useState("");

  useEffect(() => {
    let isReloading = false;

    const handleBeforeUnload = () => {
      isReloading = true;
    };

    const handleVisibilityChange = () => {
      if (isReloading) return;
      if (document.visibilityState === "hidden" && isAuth && isVerified) {
        lock();
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("blur", handleVisibilityChange); // Also lock on window blur (e.g. alt-tab)

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("blur", handleVisibilityChange);
    };
  }, [isAuth, isVerified, lock]);

  const handleUnlockWithPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setIsUnlocking(true);
    setUnlockError("");
    try {
      if (navigator.onLine) {
        const res = await login(user.username, unlockPassword);
        if (res.success) {
          let userData: any = null;
          try {
            userData = await getUserData(user.username);
          } catch (err) {
            console.warn("Could not fetch master key from server, falling back to local cache:", err);
            const rawCache = localStorage.getItem("dainiki_cached_user");
            if (rawCache) userData = JSON.parse(rawCache);
          }

          if (userData && userData.master_key_password && userData.salt) {
            const masterKey = await decrypt(userData.master_key_password, unlockPassword, userData.salt);
            if (masterKey && masterKey !== "🔒 Decryption Failed") {
              setEncryptionKey(masterKey);
              setUnlockPassword("");
            } else {
              throw new Error("Invalid password decryption");
            }
          } else {
            setEncryptionKey(unlockPassword);
            setUnlockPassword("");
          }
        } else {
          setUnlockError("Incorrect password");
        }
      } else {
        // OFFLINE: Verify using local cache
        const rawCache = localStorage.getItem("dainiki_cached_user");
        if (rawCache) {
          const userData = JSON.parse(rawCache);
          if (userData && userData.master_key_password && userData.salt) {
            const masterKey = await decrypt(userData.master_key_password, unlockPassword, userData.salt);
            if (masterKey && masterKey !== "🔒 Decryption Failed") {
              setEncryptionKey(masterKey);
              setUnlockPassword("");
              return;
            }
          }
        }
        setUnlockError("Decryption failed. Incorrect password?");
      }
    } catch (err) {
      setUnlockError("Decryption failed. Incorrect password?");
    } finally {
      setIsUnlocking(false);
    }
  };

  const handleUnlockWithPin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setIsUnlocking(true);
    setUnlockError("");
    try {
      if (navigator.onLine) {
        const res = await loginWithPin(user.username, unlockPin);
        if (res.success) {
          let userData: any = null;
          try {
            userData = await getUserData(user.username);
          } catch (err) {
            console.warn("Could not fetch master key from server, falling back to local cache:", err);
            const rawCache = localStorage.getItem("dainiki_cached_user");
            if (rawCache) userData = JSON.parse(rawCache);
          }

          if (userData && userData.master_key_pin && userData.salt) {
            const masterKey = await decrypt(userData.master_key_pin, unlockPin, userData.salt);
            if (masterKey && masterKey !== "🔒 Decryption Failed") {
              setEncryptionKey(masterKey);
              setUnlockPin("");
            } else {
              throw new Error("Invalid PIN decryption");
            }
          } else if (userData && !userData.master_key_pin) {
            setUnlockError("No PIN set for this vault.");
            setIsUnlocking(false);
            return;
          } else {
            setEncryptionKey(unlockPin);
            setUnlockPin("");
          }
        } else {
          setUnlockError("Incorrect PIN");
        }
      } else {
        // OFFLINE: Verify using local cache
        const rawCache = localStorage.getItem("dainiki_cached_user");
        if (rawCache) {
          const userData = JSON.parse(rawCache);
          if (userData && userData.master_key_pin && userData.salt) {
            const masterKey = await decrypt(userData.master_key_pin, unlockPin, userData.salt);
            if (masterKey && masterKey !== "🔒 Decryption Failed") {
              setEncryptionKey(masterKey);
              setUnlockPin("");
              return;
            }
          } else if (userData && !userData.master_key_pin) {
            setUnlockError("No PIN set for this vault.");
            setIsUnlocking(false);
            return;
          }
        }
        setUnlockError("Decryption failed. Incorrect PIN?");
      }
    } catch (err) {
      setUnlockError("Decryption failed. Incorrect PIN?");
    } finally {
      setIsUnlocking(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-white dark:bg-black">
        <motion.div
          animate={{ opacity: [0.4, 1, 0.4] }}
          transition={{ repeat: Infinity, duration: 2 }}
          className="text-sm font-medium tracking-widest text-zinc-400 uppercase"
        >
          Dainiki
        </motion.div>
      </div>
    );
  }

  if (isAuth && isVerified) {
    if (isLocked) {
      return (
        <div className="flex h-screen items-center justify-center bg-zinc-50/90 dark:bg-zinc-950/90 backdrop-blur-md p-6 fixed inset-0 z-50">
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="w-full max-w-md">
            <Card className="border-zinc-200 dark:border-zinc-800 shadow-2xl bg-white dark:bg-zinc-900/50 backdrop-blur-xl">
              <CardHeader className="space-y-1 text-center">
                <div className="mx-auto w-12 h-12 bg-zinc-100 dark:bg-zinc-800 rounded-full flex items-center justify-center mb-4">
                  <Lock className="h-5 w-5 text-zinc-600 dark:text-zinc-400" />
                </div>
                <CardTitle className="text-xl font-semibold tracking-tight">Vault Locked</CardTitle>
                <CardDescription>Welcome back, {user?.username}. Unlock to continue.</CardDescription>
              </CardHeader>
              <CardContent>
                <Tabs defaultValue="pin" className="w-full">
                  <TabsList className="grid w-full grid-cols-2 mb-6">
                    <TabsTrigger value="pin">PIN</TabsTrigger>
                    <TabsTrigger value="password">Password</TabsTrigger>
                  </TabsList>
                  <TabsContent value="pin">
                    <form onSubmit={handleUnlockWithPin} className="space-y-4">
                      <Input type="password" inputMode="numeric" pattern="[0-9]*" placeholder="Enter PIN" value={unlockPin} onChange={(e) => setUnlockPin(e.target.value)} className="bg-zinc-50 dark:bg-zinc-800/50 text-center text-2xl tracking-[1em] h-14" maxLength={6} required autoFocus />
                      {unlockError && <p className="text-xs text-red-500 text-center font-medium">{unlockError}</p>}
                      <Button type="submit" className="w-full h-11 rounded-xl font-bold uppercase tracking-widest text-xs" disabled={isUnlocking}>
                        {isUnlocking ? <Loader2 className="h-4 w-4 animate-spin" /> : "Unlock"}
                      </Button>
                    </form>
                  </TabsContent>
                  <TabsContent value="password">
                    <form onSubmit={handleUnlockWithPassword} className="space-y-4">
                      <Input type="password" placeholder="Enter Password" value={unlockPassword} onChange={(e) => setUnlockPassword(e.target.value)} className="bg-zinc-50 dark:bg-zinc-800/50" required autoFocus />
                      {unlockError && <p className="text-xs text-red-500 text-center font-medium">{unlockError}</p>}
                      <Button type="submit" className="w-full h-11 rounded-xl font-bold uppercase tracking-widest text-xs" disabled={isUnlocking}>
                        {isUnlocking ? <Loader2 className="h-4 w-4 animate-spin" /> : "Unlock"}
                      </Button>
                    </form>
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      );
    }

    return <>{children}</>;
  }

  // If logged in but unverified, force to verification screen
  const currentView = (isAuth && !isVerified) ? "verify" : view;

  return (
    <div className="flex h-screen items-center justify-center bg-zinc-50 dark:bg-zinc-950 p-6">
      <AnimatePresence mode="wait">
        {currentView === "register" ? (
          <motion.div
            key="register"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="w-full max-w-md"
          >
            <SetupForm onSwitchToLogin={() => setView("login")} />
          </motion.div>
        ) : currentView === "verify" ? (
          <motion.div
            key="verify"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="w-full max-w-md"
          >
            <SetupForm 
              initialStep={2} 
              initialUsername={user?.username || ""} 
              onSwitchToLogin={() => setView("login")} 
            />
          </motion.div>
        ) : currentView === "login" ? (
          <motion.div
            key="login"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="w-full max-w-md"
          >
            <LoginForm 
              onForgotPassword={() => setView("recovery")} 
              onRegister={() => setView("register")} 
            />
          </motion.div>
        ) : (
          <motion.div
            key="recovery"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="w-full max-w-md"
          >
            <RecoveryForm onBack={() => setView("login")} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
