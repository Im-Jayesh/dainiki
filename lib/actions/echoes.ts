"use server";

import { db } from "@/lib/db";
import { cookies } from "next/headers";

const SESSION_COOKIE = "dainiki_session";

async function getSession() {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get(SESSION_COOKIE)?.value;

  if (!sessionCookie) return null;
  
  try {
    return JSON.parse(sessionCookie);
  } catch (e) {
    return null;
  }
}

export async function castEcho(content: string) {
  const session = await getSession();
  if (!session) throw new Error("Unauthorized");

  if (!content || content.trim().length === 0) {
    throw new Error("Content cannot be empty");
  }

  if (content.length > 500) {
    throw new Error("Echo is too long (max 500 characters)");
  }

  await db.execute({
    sql: "INSERT INTO echoes (sender_id, content, is_anonymized) VALUES (?, ?, 1)",
    args: [session.userId, content]
  });

  return { success: true };
}

export async function getEcho() {
  const session = await getSession();
  if (!session) return null;

  // Get a random echo not sent by this user, and ideally not reacted to yet.
  const result = await db.execute({
    sql: "SELECT id, content FROM echoes WHERE sender_id != ? AND receiver_id IS NULL ORDER BY RANDOM() LIMIT 1",
    args: [session.userId]
  });

  if (result.rows.length === 0) return null;
  return result.rows[0];
}

export async function reactToEcho(echoId: number, emoji: string) {
  const session = await getSession();
  if (!session) throw new Error("Unauthorized");

  // Record the reaction and set the receiver_id to the current user
  await db.execute({
    sql: "UPDATE echoes SET reaction_emoji = ?, receiver_id = ? WHERE id = ?",
    args: [emoji, session.userId, echoId]
  });

  return { success: true };
}

export async function getMyEchoes() {
  const session = await getSession();
  if (!session) throw new Error("Unauthorized");

  // Fetch echoes sent by this user to see if they got reactions
  const result = await db.execute({
    sql: "SELECT id, content, reaction_emoji, created_at FROM echoes WHERE sender_id = ? ORDER BY created_at DESC",
    args: [session.userId]
  });

  return result.rows;
}
