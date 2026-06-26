"use server";

import { db } from "@/lib/db";
import { getSession } from "./auth";
import { revalidatePath } from "next/cache";

export interface ChatMessage {
  id: number;
  role: "user" | "ai";
  content: string;
  created_at: string;
}

export async function getChatHistory(): Promise<ChatMessage[]> {
  const session = await getSession();
  if (!session) return [];

  try {
    const result = await db.execute({
      sql: `SELECT * FROM (
              SELECT id, role, content, created_at 
              FROM chat_messages 
              WHERE user_id = ? 
              ORDER BY id DESC 
              LIMIT 100
            ) ORDER BY id ASC`,
      args: [session.userId]
    });

    return result.rows.map(row => ({
      id: Number(row.id),
      role: row.role as "user" | "ai",
      content: String(row.content),
      created_at: String(row.created_at)
    }));
  } catch (error) {
    console.error("Failed to fetch chat history:", error);
    return [];
  }
}

export async function saveChatMessage(role: "user" | "ai", encryptedContent: string): Promise<boolean> {
  const session = await getSession();
  if (!session) return false;

  try {
    await db.execute({
      sql: `INSERT INTO chat_messages (user_id, role, content) VALUES (?, ?, ?)`,
      args: [session.userId, role, encryptedContent]
    });
    return true;
  } catch (error) {
    console.error("Failed to save chat message:", error);
    return false;
  }
}

export async function clearChatHistory(): Promise<boolean> {
  const session = await getSession();
  if (!session) return false;

  try {
    await db.execute({
      sql: `DELETE FROM chat_messages WHERE user_id = ?`,
      args: [session.userId]
    });
    return true;
  } catch (error) {
    console.error("Failed to clear chat history:", error);
    return false;
  }
}
