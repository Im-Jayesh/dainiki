"use client";

import React, { createContext, useContext, useEffect, useState } from "react";

interface Appearance {
  fontFamily: string;
  theme: string;
}

interface Reminders {
  enabled: boolean;
  time: string;
  frequency: string;
}

interface SettingsContextType {
  appearance: Appearance;
  setAppearance: (val: Appearance) => void;
  reminders: Reminders;
  setReminders: (val: Reminders) => void;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [appearance, setAppearanceState] = useState<Appearance>({
    fontFamily: "font-sans",
    theme: "zinc",
  });

  const [reminders, setRemindersState] = useState<Reminders>({
    enabled: false,
    time: "20:00",
    frequency: "daily",
  });

  // Load from localStorage on mount
  useEffect(() => {
    const savedApp = localStorage.getItem("dainiki_appearance");
    if (savedApp) setAppearanceState(JSON.parse(savedApp));

    const savedRem = localStorage.getItem("dainiki_reminders");
    if (savedRem) setRemindersState(JSON.parse(savedRem));
  }, []);

  const setAppearance = (val: Appearance) => {
    setAppearanceState(val);
    localStorage.setItem("dainiki_appearance", JSON.stringify(val));
  };

  const setReminders = (val: Reminders) => {
    setRemindersState(val);
    localStorage.setItem("dainiki_reminders", JSON.stringify(val));
  };

  return (
    <SettingsContext.Provider value={{ appearance, setAppearance, reminders, setReminders }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const context = useContext(SettingsContext);
  if (context === undefined) {
    throw new Error("useSettings must be used within a SettingsProvider");
  }
  return context;
}
