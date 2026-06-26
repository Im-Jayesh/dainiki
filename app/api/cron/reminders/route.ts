import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sendEmailReminder } from "@/lib/notifications";
import { format } from "date-fns";
import { toZonedTime } from "date-fns-tz";

export const dynamic = "force-dynamic";

// Original bulk-check endpoint (e.g. for Vercel Cron running every minute)
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    console.warn(`[Cron] Unauthorized attempt at ${new Date().toISOString()}`);
    return new Response("Unauthorized", { status: 401 });
  }

  const utcNow = new Date();
  const results = [];

  try {
    const result = await db.execute("SELECT id, username, email, settings FROM users");
    const users = result.rows;

    for (const user of users) {
      try {
        const settings = JSON.parse((user.settings as string) || "{}");
        const reminders = settings.reminders || {};
        const userTimezone = settings.timezone || "UTC";

        if (!reminders.enabled || !reminders.time) continue;

        const localNow = toZonedTime(utcNow, userTimezone);
        const localTimeString = format(localNow, "HH:mm");
        
        if (reminders.time === localTimeString) {
          // Verify they haven't written today
          const entries = await db.execute({
            sql: "SELECT id FROM entries WHERE user_id = ? AND date(created_at) = date('now')",
            args: [user.id]
          });

          if (entries.rows.length === 0) {
            await sendEmailReminder(user.email as string, user.username as string);
            results.push({ user: user.username, status: "sent" });
          }
        }
      } catch (e) {
        console.error(`[Cron] Error for user ${user.username}:`, e);
      }
    }
    return NextResponse.json({ success: true, processed: results.length, details: results });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

// Targeted check endpoint for exact schedulers like Upstash QStash
export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  console.log(`[Cron] Received POST request. Auth header present: ${!!authHeader}`);
  
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    console.warn(`[Cron] Unauthorized POST attempt. Expected Bearer ${process.env.CRON_SECRET?.substring(0, 4)}...`);
    return new Response("Unauthorized", { status: 401 });
  }

  try {
    const { userId } = await req.json();
    console.log(`[Cron] Triggering reminder check for userId: ${userId}`);
    
    if (!userId) return new Response("Missing userId", { status: 400 });

    const result = await db.execute({
      sql: "SELECT id, username, email, settings FROM users WHERE id = ?",
      args: [userId]
    });

    const user = result.rows[0];
    if (!user) {
      console.warn(`[Cron] User ${userId} not found`);
      return new Response("User not found", { status: 404 });
    }

    const settings = JSON.parse((user.settings as string) || "{}");
    const reminders = settings.reminders || {};

    if (!reminders.enabled) {
      console.log(`[Cron] Reminders disabled for user ${user.username}`);
      return NextResponse.json({ success: true, status: "skipped (disabled)" });
    }

    // Verify they haven't written today
    const entries = await db.execute({
      sql: "SELECT id FROM entries WHERE user_id = ? AND date(created_at) = date('now')",
      args: [user.id]
    });

    if (entries.rows.length > 0) {
      console.log(`[Cron] User ${user.username} already wrote today. Skipping reminder.`);
      return NextResponse.json({ success: true, status: "skipped (already written today)" });
    }

    console.log(`[Cron] Sending reminder email to ${user.username} (${user.email})`);
    await sendEmailReminder(user.email as string, user.username as string);
    return NextResponse.json({ success: true, status: "sent" });
  } catch (err: any) {
    console.error(`[Cron] Error in POST handler:`, err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
