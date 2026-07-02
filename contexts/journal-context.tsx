"use client";

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import { useAuth } from "@/contexts/auth-context";
import { 
  getLocalEntries, 
  saveLocalEntries, 
  deleteLocalEntry, 
  clearLocalDb,
  getPendingOperations,
  addPendingOperation,
  deletePendingOperation
} from "@/lib/indexeddb";
import { 
  syncEntriesList, 
  fetchEntriesByIds, 
  saveEntry, 
  deleteEntry as serverDeleteEntry, 
  toggleArchive as serverToggleArchive,
  restoreEntry as serverRestoreEntry,
  fetchMoods,
  saveMood
} from "@/lib/actions/journal";
import { decrypt } from "@/lib/crypto";


export interface JournalEntry {
  id: number;
  user_id: number;
  title: string;
  content: string;
  mood_id?: number;
  mood_name?: string;
  mood_emoji?: string;
  tags?: string[];
  image_paths?: string[];
  is_archived: boolean;
  is_deleted: boolean;
  ai_summary?: string | null;
  ai_reflection?: string | null;
  ai_format?: string | null;
  created_at: string;
  updated_at: string;
}

interface JournalContextType {
  entries: JournalEntry[];
  moods: { id: number; name: string; emoji: string }[];
  loading: boolean;
  syncing: boolean;
  sync: () => Promise<void>;
  saveJournalEntry: (data: {
    id?: number;
    title: string;
    content: string;
    mood_id?: number;
    tags?: string[];
    ai_summary?: string | null;
    ai_reflection?: string | null;
    ai_format?: string | null;
    ai_history?: string | null;
  }) => Promise<number>;
  deleteJournalEntry: (id: number, permanent?: boolean) => Promise<void>;
  toggleJournalArchive: (id: number, archived: boolean) => Promise<void>;
  restoreJournalEntry: (id: number) => Promise<void>;
  saveCustomMood: (name: string, emoji: string) => Promise<void>;
}


const JournalContext = createContext<JournalContextType | undefined>(undefined);

export function JournalProvider({ children }: { children: React.ReactNode }) {
  const { user, encryptionKey } = useAuth();
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [moods, setMoods] = useState<{ id: number; name: string; emoji: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  // Load and cache moods for offline fallback
  useEffect(() => {
    const DEFAULT_MOODS = [
      { id: 1, name: "Excited", emoji: "🤩" },
      { id: 2, name: "Happy", emoji: "😊" },
      { id: 3, name: "Calm", emoji: "😌" },
      { id: 4, name: "Neutral", emoji: "😐" },
      { id: 5, name: "Sad", emoji: "😢" },
      { id: 6, name: "Angry", emoji: "😠" },
      { id: 7, name: "Tired", emoji: "😴" },
      { id: 8, name: "Anxious", emoji: "😰" }
    ];

    if (!user) {
      setMoods(DEFAULT_MOODS);
      return;
    }

    const loadMoods = async () => {
      try {
        const data = await fetchMoods();
        if (data && data.length > 0) {
          setMoods(data);
          localStorage.setItem("dainiki_cached_moods", JSON.stringify(data));
          return;
        }
      } catch (e) {
        console.warn("Failed to fetch moods from server. Using local cache:", e);
      }

      const cached = localStorage.getItem("dainiki_cached_moods");
      if (cached) {
        try {
          setMoods(JSON.parse(cached));
          return;
        } catch {}
      }
      setMoods(DEFAULT_MOODS);
    };

    loadMoods();
  }, [user]);
  
  // Track credentials to avoid redundant decryptions
  const prevCredsRef = useRef<{ username: string; key: string } | null>(null);

  // Helper to decrypt a single encrypted entry record
  const decryptEntry = useCallback(async (e: any, key: string, salt: string): Promise<JournalEntry> => {
    try {
      const dTitle = await decrypt(e.title, key, salt);
      const dContent = await decrypt(e.content, key, salt);
      
      let dSummary: string | null = null;
      let dReflection: string | null = null;
      let dFormat: string | null = null;

      if (e.ai_summary) dSummary = await decrypt(e.ai_summary, key, salt);
      if (e.ai_reflection) dReflection = await decrypt(e.ai_reflection, key, salt);
      if (e.ai_format) dFormat = await decrypt(e.ai_format, key, salt);

      return {
        ...e,
        title: dTitle,
        content: dContent,
        ai_summary: dSummary,
        ai_reflection: dReflection,
        ai_format: dFormat,
        is_archived: Boolean(e.is_archived),
        is_deleted: Boolean(e.is_deleted)
      } as JournalEntry;
    } catch (err) {
      console.error(`Failed to decrypt entry ${e.id}:`, err);
      return {
        ...e,
        title: "🔒 Decryption Failed",
        content: "<p>Could not decrypt entry. Verify your password/PIN.</p>",
        is_archived: Boolean(e.is_archived),
        is_deleted: Boolean(e.is_deleted)
      } as JournalEntry;
    }
  }, []);

  // Main sync function
  const sync = useCallback(async () => {
    if (!user || !encryptionKey || !user.salt) return;
    setSyncing(true);
    try {
      // 1. Fetch lightweight entry metadata manifest from server
      const serverList = await syncEntriesList();
      const serverMap = new Map<number, string>(
        serverList.map((item: any) => [Number(item.id), String(item.updated_at)])
      );

      // 2. Read local entries from IndexedDB
      const localEntries = await getLocalEntries();
      const localMap = new Map<number, any>(
        localEntries.map((item: any) => [Number(item.id), item])
      );



      // 3. Garbage collect: remove local entries no longer on the server
      const idsToDelete: number[] = [];
      localMap.forEach((_, id) => {
        if (!serverMap.has(id)) {
          idsToDelete.push(id);
        }
      });
      for (const id of idsToDelete) {
        await deleteLocalEntry(id);
        localMap.delete(id);
      }

      // 4. Identify delta (missing locally or outdated locally)
      const deltaIds: number[] = [];
      serverMap.forEach((updated_at, id) => {
        const local = localMap.get(id);
        if (!local || local.updated_at !== updated_at) {
          deltaIds.push(id);
        }
      });

      // 5. Fetch delta payloads from the server
      if (deltaIds.length > 0) {
        const deltaPayloads = await fetchEntriesByIds(deltaIds);
        await saveLocalEntries(deltaPayloads);
        deltaPayloads.forEach((payload: any) => {
          localMap.set(payload.id, payload);
        });

      }

      // 6. Decrypt all entries and update state
      const finalLocalEntries = Array.from(localMap.values());
      const decrypted = await Promise.all(
        finalLocalEntries.map(e => decryptEntry(e, encryptionKey, user.salt))
      );

      // Sort descending by created_at
      decrypted.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      setEntries(decrypted);
    } catch (err) {
      console.error("[Journal sync error]:", err);
    } finally {
      setSyncing(false);
      setLoading(false);
    }
  }, [user, encryptionKey, decryptEntry]);

  // Initial load and sync on credentials unlock
  useEffect(() => {
    if (!user || !encryptionKey) {
      // Reset state if logged out
      setEntries([]);
      setLoading(true);
      prevCredsRef.current = null;
      return;
    }

    const currentCreds = { username: user.username, key: encryptionKey };
    const prevCreds = prevCredsRef.current;

    // Trigger sync and loading only on login/unlock or credentials change
    if (!prevCreds || prevCreds.username !== currentCreds.username || prevCreds.key !== currentCreds.key) {
      prevCredsRef.current = currentCreds;
      
      const loadFromLocalAndSync = async () => {
        setLoading(true);
        try {
          // Load local immediately for speed
          const local = await getLocalEntries();
          if (local.length > 0 && user.salt) {
            const decrypted = await Promise.all(
              local.map(e => decryptEntry(e, encryptionKey, user.salt))
            );
            decrypted.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
            setEntries(decrypted);
            setLoading(false); // fast load complete
          }
        } catch (e) {
          console.error("Local initial load error:", e);
        }
        
        // Background sync to update the UI
        await sync();
      };

      loadFromLocalAndSync();
    }
  }, [user, encryptionKey, decryptEntry, sync]);

  // Offline pending queue sync playback
  const syncOfflineQueue = useCallback(async () => {
    if (!navigator.onLine || !user || !encryptionKey) return;

    try {
      const pendingOps = await getPendingOperations();
      if (pendingOps.length === 0) return;

      console.log(`[Offline Sync] Found ${pendingOps.length} pending operations. Starting playback...`);

      for (const op of pendingOps) {
        try {
          if (op.action === "save") {
            await saveEntry(op.data);
          } else if (op.action === "delete") {
            await serverDeleteEntry(op.entryId, op.data?.permanent);
          } else if (op.action === "archive") {
            await serverToggleArchive(op.entryId, op.data?.archived);
          }
          await deletePendingOperation(op.id);
        } catch (err) {
          console.error(`[Offline Sync] Failed to replay operation ${op.id}:`, err);
          break; // Stop execution on error to preserve order
        }
      }

      await sync();
    } catch (err) {
      console.error("[Offline Sync Error]:", err);
    }
  }, [user, encryptionKey, sync]);

  // Sync offline queue when coming back online
  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleOnline = () => {
      syncOfflineQueue();
    };

    window.addEventListener("online", handleOnline);

    if (navigator.onLine) {
      syncOfflineQueue();
    }

    return () => {
      window.removeEventListener("online", handleOnline);
    };
  }, [syncOfflineQueue]);


  // Save/Create entry action
  const saveJournalEntry = useCallback(async (data: {
    id?: number;
    title: string;
    content: string;
    mood_id?: number;
    tags?: string[];
    ai_summary?: string | null;
    ai_reflection?: string | null;
    ai_format?: string | null;
    ai_history?: string | null;
  }) => {
    if (!user || !encryptionKey) throw new Error("Unauthorized");

    const isNew = !data.id;
    const targetId = isNew ? Math.floor(Date.now() + Math.random() * 1000) : Number(data.id);

    const record = {
      id: targetId,
      user_id: user.userId,
      title: data.title,
      content: data.content,
      mood_id: data.mood_id || null,
      tags: JSON.stringify(data.tags || []),
      image_paths: "[]",
      is_archived: 0,
      is_deleted: 0,
      ai_summary: data.ai_summary || null,
      ai_reflection: data.ai_reflection || null,
      ai_format: data.ai_format || null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    if (navigator.onLine) {
      const savedId = await saveEntry(data);
      const finalId = Number(data.id || savedId);
      record.id = finalId;

      await saveLocalEntries([record]);

      const decrypted = await decryptEntry(record, encryptionKey, user.salt);
      setEntries(prev => {
        const filtered = prev.filter(e => e.id !== finalId);
        const merged = [decrypted, ...filtered];
        return merged.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      });
      return finalId;
    } else {
      console.log(`[Offline Save] Saving entry ${targetId} locally`);
      
      await saveLocalEntries([record]);

      await addPendingOperation({
        action: "save",
        entryId: targetId,
        data: {
          id: isNew ? undefined : targetId,
          title: data.title,
          content: data.content,
          mood_id: data.mood_id,
          tags: data.tags,
          ai_summary: data.ai_summary,
          ai_reflection: data.ai_reflection,
          ai_format: data.ai_format,
          ai_history: data.ai_history
        }
      });

      const decrypted = await decryptEntry(record, encryptionKey, user.salt);
      setEntries(prev => {
        const filtered = prev.filter(e => e.id !== targetId);
        const merged = [decrypted, ...filtered];
        return merged.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      });
      return targetId;
    }
  }, [user, encryptionKey, decryptEntry]);

  // Delete entry action
  const deleteJournalEntry = useCallback(async (id: number, permanent = false) => {
    if (navigator.onLine) {
      await serverDeleteEntry(id, permanent);
      if (permanent) {
        await deleteLocalEntry(id);
      } else {
        const local = await getLocalEntries();
        const match = local.find(e => Number(e.id) === id);
        if (match) {
          match.is_deleted = 1;
          await saveLocalEntries([match]);
        }
      }
    } else {
      console.log(`[Offline Delete] Queuing delete for entry ${id}`);
      await addPendingOperation({
        action: "delete",
        entryId: id,
        data: { permanent }
      });

      if (permanent) {
        await deleteLocalEntry(id);
      } else {
        const local = await getLocalEntries();
        const match = local.find(e => Number(e.id) === id);
        if (match) {
          match.is_deleted = 1;
          await saveLocalEntries([match]);
        }
      }
    }

    setEntries(prev => {
      if (permanent) {
        return prev.filter(e => e.id !== id);
      } else {
        return prev.map(e => e.id === id ? { ...e, is_deleted: true } : e);
      }
    });
  }, []);

  // Toggle archive entry action
  const toggleJournalArchive = useCallback(async (id: number, archived: boolean) => {
    if (navigator.onLine) {
      await serverToggleArchive(id, archived);
      const local = await getLocalEntries();
      const match = local.find(e => Number(e.id) === id);
      if (match) {
        match.is_archived = archived ? 1 : 0;
        await saveLocalEntries([match]);
      }
    } else {
      console.log(`[Offline Archive] Queuing archive for entry ${id}`);
      await addPendingOperation({
        action: "archive",
        entryId: id,
        data: { archived }
      });

      const local = await getLocalEntries();
      const match = local.find(e => Number(e.id) === id);
      if (match) {
        match.is_archived = archived ? 1 : 0;
        await saveLocalEntries([match]);
      }
    }

    setEntries(prev => prev.map(e => e.id === id ? { ...e, is_archived: archived } : e));
  }, []);

  // Restore entry action
  const restoreJournalEntry = useCallback(async (id: number) => {
    if (navigator.onLine) {
      await serverRestoreEntry(id);
      const local = await getLocalEntries();
      const match = local.find(e => Number(e.id) === id);
      if (match) {
        match.is_deleted = 0;
        await saveLocalEntries([match]);
      }
    } else {
      console.log(`[Offline Restore] Queuing restore for entry ${id}`);
      await addPendingOperation({
        action: "save",
        entryId: id,
        data: { id, is_deleted: 0 }
      });

      const local = await getLocalEntries();
      const match = local.find(e => Number(e.id) === id);
      if (match) {
        match.is_deleted = 0;
        await saveLocalEntries([match]);
      }
    }

    setEntries(prev => prev.map(e => e.id === id ? { ...e, is_deleted: false } : e));
  }, []);

  const saveCustomMood = useCallback(async (name: string, emoji: string) => {
    await saveMood(name, emoji);
    try {
      const data = await fetchMoods();
      if (data && data.length > 0) {
        setMoods(data);
        localStorage.setItem("dainiki_cached_moods", JSON.stringify(data));
      }
    } catch (e) {
      console.error("Failed to refresh moods after custom save:", e);
    }
  }, []);



  return (
    <JournalContext.Provider value={{
      entries,
      moods,
      loading,
      syncing,
      sync,
      saveJournalEntry,
      deleteJournalEntry,
      toggleJournalArchive,
      restoreJournalEntry,
      saveCustomMood
    }}>
      {children}
    </JournalContext.Provider>

  );
}

export function useJournal() {
  const context = useContext(JournalContext);
  if (context === undefined) {
    throw new Error("useJournal must be used within a JournalProvider");
  }
  return context;
}
