"use client";

import { useAuth } from "@/contexts/auth-context";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { LoginForm } from "./auth/login-form";
import { SetupForm } from "./auth/setup-form";
import { RecoveryForm } from "./auth/recovery-form";

export function SecurityGate({ children }: { children: React.ReactNode }) {
  const { isAuth, isVerified, isLoading, user } = useAuth();
  const [view, setView] = useState<"login" | "register" | "recovery" | "verify">("login");

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
