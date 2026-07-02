"use client";

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import { useAuth } from "@/contexts/auth-context";
import { getLocalEntries, saveLocalEntries, deleteLocalEntry, clearLocalDb } from "@/lib/indexeddb";
import { 
  syncEntriesList, 
  fetchEntriesByIds, 
  saveEntry, 
  deleteEntry as serverDeleteEntry, 
  toggleArchive as serverToggleArchive,
  restoreEntry as serverRestoreEntry
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
}


const JournalContext = createContext<JournalContextType | undefined>(undefined);

export function JournalProvider({ children }: { children: React.ReactNode }) {
  const { user, encryptionKey } = useAuth();
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  
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
      clearLocalDb().catch(console.error);
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
    // 1. Save to server database
    const savedId = await saveEntry(data);
    const targetId = Number(data.id || savedId);

    // 2. Fetch the newly saved record from server to ensure accurate synced payload
    const updatedRows = await fetchEntriesByIds([targetId]);
    if (updatedRows.length > 0 && user && encryptionKey) {
      const serverRecord = updatedRows[0];
      
      // 3. Save to local IndexedDB
      await saveLocalEntries([serverRecord]);

      // 4. Decrypt and merge into context state
      const decrypted = await decryptEntry(serverRecord, encryptionKey, user.salt);
      
      setEntries(prev => {
        const filtered = prev.filter(e => e.id !== targetId);
        const merged = [decrypted, ...filtered];
        // Keep sorted
        return merged.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      });
    }

    return targetId;
  }, [user, encryptionKey, decryptEntry]);

  // Delete entry action
  const deleteJournalEntry = useCallback(async (id: number, permanent = false) => {
    // 1. Delete on server
    await serverDeleteEntry(id, permanent);

    // 2. Delete locally in IndexedDB
    if (permanent) {
      await deleteLocalEntry(id);
    } else {
      // For soft delete, update the local DB record is_deleted = 1
      const local = await getLocalEntries();
      const match = local.find(e => Number(e.id) === id);
      if (match) {
        match.is_deleted = 1;
        await saveLocalEntries([match]);
      }
    }

    // 3. Update context state
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
    // 1. Update on server
    await serverToggleArchive(id, archived);

    // 2. Update locally in IndexedDB
    const local = await getLocalEntries();
    const match = local.find(e => Number(e.id) === id);
    if (match) {
      match.is_archived = archived ? 1 : 0;
      await saveLocalEntries([match]);
    }

    // 3. Update context state
    setEntries(prev => prev.map(e => e.id === id ? { ...e, is_archived: archived } : e));
  }, []);

  // Restore entry action
  const restoreJournalEntry = useCallback(async (id: number) => {
    // 1. Restore on server
    await serverRestoreEntry(id);

    // 2. Update locally in IndexedDB
    const local = await getLocalEntries();
    const match = local.find(e => Number(e.id) === id);
    if (match) {
      match.is_deleted = 0;
      await saveLocalEntries([match]);
    }

    // 3. Update context state
    setEntries(prev => prev.map(e => e.id === id ? { ...e, is_deleted: false } : e));
  }, []);


  return (
    <JournalContext.Provider value={{
      entries,
      loading,
      syncing,
      sync,
      saveJournalEntry,
      deleteJournalEntry,
      toggleJournalArchive,
      restoreJournalEntry
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
