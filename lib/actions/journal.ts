"use server";

import { createEntry, updateEntry, getEntries, getEntry, softDeleteEntry, hardDeleteEntry, archiveEntry, getMoods, createMood, searchEntries, createAiHistoryItem, getAiHistoryForEntry, updateAiHistoryItemStatus, clearAiHistoryForEntry } from "@/lib/journal";
import { revalidatePath } from "next/cache";
import { getSession } from "./auth";
import { getCache, setCache, deleteCachePattern, deleteCache } from "@/lib/redis";
import { db } from "@/lib/db";


export async function saveEntry(data: { 
  id?: number; 
  title: string; 
  content: string; 
  mood_id?: number; 
  tags?: string[];
  ai_summary?: string | null;
  ai_reflection?: string | null;
  ai_format?: string | null;
  ai_history?: string | null;
}) {
  const session = await getSession();
  if (!session) throw new Error("Unauthorized");

  if (data.id) {
    await updateEntry(data.id, session.userId, data);
    await deleteCachePattern(`user:${session.userId}:entries:*`);
    await deleteCache(`user:${session.userId}:entry:${data.id}`);
    return data.id;
  } else {
    const id = await createEntry({ ...data, user_id: session.userId });
    await deleteCachePattern(`user:${session.userId}:entries:*`);
    revalidatePath("/");
    return Number(id);
  }
}

export async function getAllEntries(options: { view?: "active" | "archived" | "deleted" } = { view: "active" }) {
  const session = await getSession();
  if (!session) return [];
  
  const view = options.view || "active";
  const cacheKey = `user:${session.userId}:entries:${view}`;
  
  const cached = await getCache<any[]>(cacheKey);
  if (cached) return cached;
  
  const entries = await getEntries(session.userId, options);
  await setCache(cacheKey, entries, 3600); // 1 hour TTL
  return entries;
}

export async function getSingleEntry(id: number) {
  const session = await getSession();
  if (!session) return null;
  
  const cacheKey = `user:${session.userId}:entry:${id}`;
  const cached = await getCache<any>(cacheKey);
  if (cached) return cached;
  
  const entry = await getEntry(id, session.userId);
  if (entry) {
    await setCache(cacheKey, entry, 3600);
  }
  return entry;
}

export async function deleteEntry(id: number, permanent = false) {
  const session = await getSession();
  if (!session) throw new Error("Unauthorized");

  if (permanent) {
    await hardDeleteEntry(id, session.userId);
  } else {
    await softDeleteEntry(id, session.userId);
  }
  
  await deleteCachePattern(`user:${session.userId}:entries:*`);
  await deleteCache(`user:${session.userId}:entry:${id}`);
  revalidatePath("/");
}

export async function toggleArchive(id: number, archived: boolean) {
  const session = await getSession();
  if (!session) throw new Error("Unauthorized");

  await archiveEntry(id, session.userId, archived);
  await deleteCachePattern(`user:${session.userId}:entries:*`);
  await deleteCache(`user:${session.userId}:entry:${id}`);
  revalidatePath("/");
}

export async function fetchMoods() {
  const session = await getSession();
  return getMoods(session?.userId);
}

export async function saveMood(name: string, emoji: string) {
  const session = await getSession();
  if (!session) throw new Error("Unauthorized");

  await createMood(name, emoji, session.userId);
  revalidatePath("/");
}

export async function restoreEntry(id: number) {
  const session = await getSession();
  if (!session) throw new Error("Unauthorized");

  await updateEntry(id, session.userId, { is_deleted: false });
  await deleteCachePattern(`user:${session.userId}:entries:*`);
  await deleteCache(`user:${session.userId}:entry:${id}`);
  revalidatePath("/");
}

export async function search(query: string, view: "active" | "archived" | "deleted" = "active") {
  const session = await getSession();
  if (!session) return [];
  return searchEntries(query, session.userId, { view });
}

export async function exportAllEntries() {
  const session = await getSession();
  if (!session) throw new Error("Unauthorized");
  return getEntries(session.userId, { view: "active" }); // This helper already handles basic fetching
}

export async function createHistoryItem(entryId: number, feature: string, content: string, status: string = "pending") {
  const session = await getSession();
  if (!session) throw new Error("Unauthorized");
  return createAiHistoryItem(entryId, feature, content, status);
}

export async function getAiHistory(entryId: number) {
  const session = await getSession();
  if (!session) return [];
  return getAiHistoryForEntry(entryId);
}

export async function updateAiHistoryStatus(id: number, status: string) {
  const session = await getSession();
  if (!session) throw new Error("Unauthorized");
  return updateAiHistoryItemStatus(id, status);
}

export async function clearAiHistory(entryId: number) {
  const session = await getSession();
  if (!session) throw new Error("Unauthorized");
  return clearAiHistoryForEntry(entryId);
}

export async function syncEntriesList() {
  const session = await getSession();
  if (!session) throw new Error("Unauthorized");

  const result = await db.execute({
    sql: "SELECT id, updated_at FROM entries WHERE user_id = ?",
    args: [session.userId]
  });

  return result.rows.map(row => ({
    id: Number(row.id),
    updated_at: String(row.updated_at)
  }));
}

export async function fetchEntriesByIds(ids: number[]) {
  const session = await getSession();
  if (!session) throw new Error("Unauthorized");
  if (ids.length === 0) return [];

  const placeholders = ids.map(() => "?").join(", ");
  const result = await db.execute({
    sql: `SELECT e.*, m.name as mood_name, m.emoji as mood_emoji
          FROM entries e
          LEFT JOIN moods m ON e.mood_id = m.id
          WHERE e.user_id = ? AND e.id IN (${placeholders})`,
    args: [session.userId, ...ids]
  });

  return result.rows.map(row => {
    const e = { ...row } as any;
    return {
      ...e,
      id: Number(e.id),
      user_id: Number(e.user_id),
      mood_id: e.mood_id ? Number(e.mood_id) : undefined,
      tags: JSON.parse(e.tags || "[]"),
      image_paths: JSON.parse(e.image_paths || "[]")
    };
  });
}


