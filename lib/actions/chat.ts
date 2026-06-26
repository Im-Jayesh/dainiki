"use server";

import { db } from "@/lib/db";
import { getSession } from "./auth";
import { revalidatePath } from "next/cache";

export interface ChatMessage {
  id: number;
  role: "user" | "ai";
  content: string;
  session_id?: string;
  session_title?: string;
  created_at: string;
}

export interface ChatSession {
  session_id: string;
  session_title: string; // Client-side Encrypted
  last_activity: string;
}

export async function getChatHistory(sessionId?: string): Promise<ChatMessage[]> {
  const session = await getSession();
  if (!session) return [];

  try {
    let query = `SELECT id, role, content, session_id, session_title, created_at 
                 FROM chat_messages 
                 WHERE user_id = ?`;
    const args: any[] = [session.userId];

    if (sessionId) {
      query += ` AND session_id = ?`;
      args.push(sessionId);
    } else {
      query += ` AND session_id IS NULL`;
    }

    query += ` ORDER BY id ASC LIMIT 100`;

    const result = await db.execute({
      sql: query,
      args
    });

    return result.rows.map(row => ({
      id: Number(row.id),
      role: row.role as "user" | "ai",
      content: String(row.content),
      session_id: row.session_id ? String(row.session_id) : undefined,
      session_title: row.session_title ? String(row.session_title) : undefined,
      created_at: String(row.created_at)
    }));
  } catch (error) {
    console.error("Failed to fetch chat history:", error);
    return [];
  }
}

export async function saveChatMessage(
  role: "user" | "ai", 
  encryptedContent: string, 
  sessionId?: string, 
  encryptedSessionTitle?: string
): Promise<boolean> {
  const session = await getSession();
  if (!session) return false;

  try {
    await db.execute({
      sql: `INSERT INTO chat_messages (user_id, role, content, session_id, session_title) 
            VALUES (?, ?, ?, ?, ?)`,
      args: [
        session.userId, 
        role, 
        encryptedContent, 
        sessionId || null, 
        encryptedSessionTitle || null
      ]
    });
    return true;
  } catch (error) {
    console.error("Failed to save chat message:", error);
    return false;
  }
}

export async function getChatSessions(): Promise<ChatSession[]> {
  const session = await getSession();
  if (!session) return [];

  try {
    const result = await db.execute({
      sql: `SELECT session_id, MAX(session_title) as session_title, MAX(created_at) as last_activity
            FROM chat_messages
            WHERE user_id = ? AND session_id IS NOT NULL
            GROUP BY session_id
            ORDER BY last_activity DESC`,
      args: [session.userId]
    });

    return result.rows.map(row => ({
      session_id: String(row.session_id),
      session_title: String(row.session_title || ""),
      last_activity: String(row.last_activity)
    }));
  } catch (error) {
    console.error("Failed to fetch chat sessions:", error);
    return [];
  }
}

export async function deleteChatSession(sessionId: string): Promise<boolean> {
  const session = await getSession();
  if (!session) return false;

  try {
    await db.execute({
      sql: `DELETE FROM chat_messages WHERE user_id = ? AND session_id = ?`,
      args: [session.userId, sessionId]
    });
    return true;
  } catch (error) {
    console.error("Failed to delete chat session:", error);
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
