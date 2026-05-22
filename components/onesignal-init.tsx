"use client";

import { useEffect, useRef } from "react";
import OneSignal from "react-onesignal";
import { useAuth } from "@/contexts/auth-context";

export function OneSignalInit() {
  const { user } = useAuth();
  const initialized = useRef(false);

  useEffect(() => {
    if (typeof window !== "undefined" && !initialized.current) {
      const initOneSignal = async () => {
        try {
          await OneSignal.init({
            appId: process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID || "",
            allowLocalhostAsSecureOrigin: true,
          });
          initialized.current = true;

          if (user) {
            await OneSignal.login(user.username);
          }
        } catch (e: any) {
          // Ignore "already initialized" errors
          if (e?.message?.includes("already initialized") || e === "OneSignal is already initialized.") {
            initialized.current = true;
          } else {
            console.error("OneSignal init error:", e);
          }
        }
      };
      initOneSignal();
    } else if (user && initialized.current) {
       OneSignal.login(user.username).catch(() => {});
    }
  }, [user]);

  return null;
}
