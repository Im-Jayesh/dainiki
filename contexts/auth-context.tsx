"use client";

import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { isAuthenticated, logout as serverLogout, checkUserExists, getSession, getUserData } from "@/lib/actions/auth";

interface AuthContextType {
  isAuth: boolean;
  isVerified: boolean;
  setIsAuth: (val: boolean) => void;
  isLoading: boolean;
  hasUser: boolean | null;
  user: { userId: number; username: string; salt: string; credits: number; role: string; settings?: string } | null;
  encryptionKey: string | null;
  setEncryptionKey: (key: string | null) => void;
  setCredits: (val: number) => void;
  refreshStatus: () => Promise<void>;
  logout: () => Promise<void>;
  isLocked: boolean;
  lock: () => void;
  unlock: (key: string) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [isAuth, setIsAuth] = useState(false);
  const [isVerified, setIsVerified] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [hasUser, setHasUser] = useState<boolean | null>(null);
  const [user, setUser] = useState<{ userId: number; username: string; salt: string; credits: number; role: string; settings?: string } | null>(null);
  const [encryptionKey, setEncryptionKeyState] = useState<string | null>(null);
  const [isLocked, setIsLocked] = useState(false);

  // Initialize key from session storage on mount
  useEffect(() => {
    const savedKey = sessionStorage.getItem("dainiki_vault_key");
    if (savedKey) {
      setEncryptionKeyState(savedKey);
      setIsLocked(false);
    } else if (isAuth && isVerified) {
      setIsLocked(true);
    }
  }, [isAuth, isVerified]);

  const lock = useCallback(() => {
    sessionStorage.removeItem("dainiki_vault_key");
    setEncryptionKeyState(null);
    setIsLocked(true);
  }, []);

  const unlock = useCallback((key: string) => {
    sessionStorage.setItem("dainiki_vault_key", key);
    setEncryptionKeyState(key);
    setIsLocked(false);
  }, []);

  const setEncryptionKey = (key: string | null) => {
    if (key) unlock(key);
    else lock();
  };
  
  const setCredits = (val: number) => {
    setUser(prev => prev ? { ...prev, credits: val } : null);
  };

  const refreshStatus = useCallback(async () => {
    setIsLoading(true);
    try {
      const [auth, exists] = await Promise.all([isAuthenticated(), checkUserExists()]);
      setIsAuth(auth);
      setHasUser(exists);
      
      if (auth) {
        const session = await getSession();
        if (session) {
          let data: any = null;
          try {
            data = await getUserData(session.username);
            // Cache user metadata in localStorage for offline session recovery
            if (data && typeof window !== "undefined") {
              const cachedUser = {
                userId: Number(session.userId),
                username: session.username,
                salt: data.salt || "",
                credits: data.credits ?? 10,
                role: data.role || "user",
                settings: data.settings || undefined,
                isVerified: session.isVerified || false,
                master_key_password: data.master_key_password || null,
                master_key_pin: data.master_key_pin || null
              };
              localStorage.setItem("dainiki_cached_user", JSON.stringify(cachedUser));
            }
          } catch (e) {
            console.warn("[Auth Offline Warning] Could not fetch user details from server. Loading local cache:", e);
            if (typeof window !== "undefined") {
              const rawCache = localStorage.getItem("dainiki_cached_user");
              if (rawCache) {
                try {
                  data = JSON.parse(rawCache);
                } catch {}
              }
            }
          }

          const finalUser = {
            userId: Number(session.userId),
            username: session.username,
            salt: data?.salt || "",
            credits: data?.credits ?? 10,
            role: data?.role || "user",
            settings: data?.settings || undefined,
            isVerified: session.isVerified || data?.isVerified || false
          };

          setUser({ 
            userId: finalUser.userId, 
            username: finalUser.username, 
            salt: finalUser.salt || "",
            credits: finalUser.credits ?? 10,
            role: finalUser.role || "user",
            settings: finalUser.settings || undefined
          });
          setIsVerified(finalUser.isVerified);
        }
      } else {
        setUser(null);
        setIsVerified(false);
      }
    } catch (error) {
      console.warn("Failed to check auth status from server. Attempting offline cache recovery:", error);
      if (typeof window !== "undefined") {
        const rawCache = localStorage.getItem("dainiki_cached_user");
        if (rawCache) {
          try {
            const cachedUser = JSON.parse(rawCache);
            setIsAuth(true);
            setIsVerified(cachedUser.isVerified);
            setUser({
              userId: cachedUser.userId,
              username: cachedUser.username,
              salt: cachedUser.salt,
              credits: cachedUser.credits,
              role: cachedUser.role,
              settings: cachedUser.settings
            });
            console.log("[Auth Offline Recovery] Restored user session from localStorage:", cachedUser.username);
            return;
          } catch {}
        }
      }
      setUser(null);
      setIsVerified(false);
    } finally {
      setIsLoading(false);
    }
  }, []);


  useEffect(() => {
    refreshStatus();
  }, [refreshStatus]);

  // Register PWA Service Worker at root scope
  useEffect(() => {
    if (typeof window !== "undefined" && "serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js")
        .then((reg) => console.log("[PWA] Service Worker registered at root scope:", reg.scope))
        .catch((err) => console.error("[PWA] Service Worker registration failed at root:", err));
    }
  }, []);

  const logout = async () => {
    await serverLogout();
    setIsAuth(false);
    setIsVerified(false);
    setUser(null);
    setEncryptionKey(null);
    if (typeof window !== "undefined") {
      localStorage.removeItem("dainiki_cached_user");
      try {
        const { clearLocalDb } = await import("@/lib/indexeddb");
        await clearLocalDb();
      } catch (e) {
        console.error("Failed to clear local db on logout:", e);
      }
    }
  };

  return (
    <AuthContext.Provider value={{ 
      isAuth, 
      isVerified,
      setIsAuth, 
      isLoading, 
      hasUser, 
      user, 
      encryptionKey, 
      setEncryptionKey, 
      setCredits,
      refreshStatus, 
      logout,
      isLocked,
      lock,
      unlock
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
