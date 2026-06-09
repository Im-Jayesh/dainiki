"use server";

import { db } from "@/lib/db";
import { cookies } from "next/headers";
import { sendBroadcastEmail, sendInviteEmail } from "@/lib/notifications";
import crypto from "crypto";

const SESSION_COOKIE = "dainiki_session";

async function verifyAdmin() {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get(SESSION_COOKIE)?.value;

  if (!sessionCookie) throw new Error("Unauthorized");
  
  let session;
  try {
    session = JSON.parse(sessionCookie);
  } catch (e) {
    throw new Error("Unauthorized");
  }

  if (!session?.userId) throw new Error("Unauthorized");

  const result = await db.execute({
    sql: "SELECT role FROM users WHERE id = ?",
    args: [session.userId]
  });

  const user = result.rows[0];
  if (!user || user.role !== "admin") {
    throw new Error("Unauthorized: Admin access required");
  }
}

export async function getAdminData() {
  await verifyAdmin();

  const usersResult = await db.execute("SELECT id, username, email, role, ai_credits, last_ai_usage_date, is_banned, created_at FROM users ORDER BY created_at DESC");
  
  // Aggregate total tokens (rough estimate from logs if available, otherwise just sum credits used)
  const tokenResult = await db.execute("SELECT SUM(prompt_tokens + completion_tokens) as total_tokens FROM ai_usage_logs");

  return {
    users: usersResult.rows.map(row => ({
      ...row,
      is_banned: Boolean(row.is_banned)
    })),
    stats: {
      total_users: usersResult.rows.length,
      total_tokens: Number(tokenResult.rows[0]?.total_tokens || 0)
    }
  };
}

export async function toggleUserBan(userId: number, banStatus: boolean) {
  await verifyAdmin();
  
  await db.execute({
    sql: "UPDATE users SET is_banned = ? WHERE id = ?",
    args: [banStatus ? 1 : 0, userId]
  });
  
  return { success: true };
}

export async function createInvite(email: string, name: string) {
  await verifyAdmin();

  // Create a 32-character random hex token
  const token = crypto.randomBytes(16).toString("hex");
  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + 48); // 48 hour expiry

  // First, check if a user with this email already exists
  const existingUser = await db.execute({
    sql: "SELECT id FROM users WHERE email = ?",
    args: [email]
  });

  if (existingUser.rows.length > 0) {
    throw new Error("User with this email already exists.");
  }

  // Pre-create the user record with the invite token.
  // We'll leave password_hash, recovery_key, and encryption_salt empty/dummy for now,
  // the user will overwrite these during the invite completion.
  await db.execute({
    sql: `INSERT INTO users (
      username, email, password_hash, recovery_key, encryption_salt, invite_token, invite_expires
    ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    args: [
      name.replace(/\\s+/g, '').toLowerCase() + Math.floor(Math.random()*1000), // temp username
      email,
      'INVITED_PENDING',
      'INVITED_PENDING',
      'INVITED_PENDING',
      token,
      expiresAt.toISOString()
    ]
  });

  // Send the email
  await sendInviteEmail(email, name, token);
  
  return { success: true };
}

export async function broadcastEmail(userIds: number[] | 'all', subject: string, content: string) {
  await verifyAdmin();

  let emails: string[] = [];

  if (userIds === 'all') {
    const result = await db.execute("SELECT email FROM users WHERE email IS NOT NULL AND is_banned = 0");
    emails = result.rows.map(r => r.email as string);
  } else {
    // Note: SQLite doesn't natively support array binding like IN (?) with an array, 
    // but we can map or use libSQL's syntax. We'll do it safely.
    const result = await db.execute("SELECT email FROM users WHERE id IN (" + userIds.join(',') + ") AND email IS NOT NULL");
    emails = result.rows.map(r => r.email as string);
  }

  if (emails.length === 0) {
    throw new Error("No valid emails found for the selected users.");
  }

  await sendBroadcastEmail(emails, subject, content);
  return { success: true, count: emails.length };
}
