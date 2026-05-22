"use client";

import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { isAuthenticated, logout as serverLogout, checkUserExists, getSession, getUserData } from "@/lib/actions/auth";

interface AuthContextType {
  isAuth: boolean;
  isVerified: boolean;
  setIsAuth: (val: boolean) => void;
  isLoading: boolean;
  hasUser: boolean | null;
  user: { userId: number; username: string; salt: string; credits: number; role: string } | null;
  encryptionKey: string | null;
  setEncryptionKey: (key: string | null) => void;
  setCredits: (val: number) => void;
  refreshStatus: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [isAuth, setIsAuth] = useState(false);
  const [isVerified, setIsVerified] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [hasUser, setHasUser] = useState<boolean | null>(null);
  const [user, setUser] = useState<{ userId: number; username: string; salt: string; credits: number; role: string } | null>(null);
  const [encryptionKey, setEncryptionKeyState] = useState<string | null>(null);

  // Initialize key from session storage on mount
  useEffect(() => {
    const savedKey = sessionStorage.getItem("dainiki_vault_key");
    if (savedKey) setEncryptionKeyState(savedKey);
  }, []);

  const setEncryptionKey = (key: string | null) => {
    setEncryptionKeyState(key);
    if (key) sessionStorage.setItem("dainiki_vault_key", key);
    else sessionStorage.removeItem("dainiki_vault_key");
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
          const data = await getUserData(session.username);
          setUser({ 
            userId: Number(session.userId), 
            username: session.username, 
            salt: data?.salt || "",
            credits: data?.credits ?? 10,
            role: data?.role || "user"
          });
          setIsVerified(session.isVerified || false);
        }
      } else {
        setUser(null);
        setIsVerified(false);
      }
    } catch (error) {
      console.error("Failed to check auth status:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshStatus();
  }, [refreshStatus]);

  const logout = async () => {
    await serverLogout();
    setIsAuth(false);
    setIsVerified(false);
    setUser(null);
    setEncryptionKey(null);
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
      logout 
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
