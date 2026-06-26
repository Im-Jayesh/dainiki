"use server";

import { createEntry, updateEntry, getEntries, getEntry, softDeleteEntry, hardDeleteEntry, archiveEntry, getMoods, createMood, searchEntries, createAiHistoryItem, getAiHistoryForEntry, updateAiHistoryItemStatus, clearAiHistoryForEntry } from "@/lib/journal";
import { revalidatePath } from "next/cache";
import { getSession } from "./auth";

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
    return data.id;
  } else {
    const id = await createEntry({ ...data, user_id: session.userId });
    revalidatePath("/");
    return Number(id);
  }
}

export async function getAllEntries(options: { view?: "active" | "archived" | "deleted" } = { view: "active" }) {
  const session = await getSession();
  if (!session) return [];
  return getEntries(session.userId, options);
}

export async function getSingleEntry(id: number) {
  const session = await getSession();
  if (!session) return null;
  return getEntry(id, session.userId);
}

export async function deleteEntry(id: number, permanent = false) {
  const session = await getSession();
  if (!session) throw new Error("Unauthorized");

  if (permanent) {
    await hardDeleteEntry(id, session.userId);
  } else {
    await softDeleteEntry(id, session.userId);
  }
  revalidatePath("/");
}

export async function toggleArchive(id: number, archived: boolean) {
  const session = await getSession();
  if (!session) throw new Error("Unauthorized");

  await archiveEntry(id, session.userId, archived);
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

