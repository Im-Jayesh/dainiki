import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

// Simulates exactly what updateSettings does for reminders, bypassing session auth
// ONLY for debugging — protected by CRON_SECRET
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  try {
    // Read actual user settings from DB
    const result = await db.execute("SELECT id, username, settings FROM users LIMIT 5");
    const users = result.rows.map((u: any) => ({
      id: u.id,
      username: u.username,
      settings: JSON.parse((u.settings as string) || "{}"),
    }));

    const entriesResult = await db.execute("SELECT id, user_id, created_at FROM entries LIMIT 5");
    const entries = entriesResult.rows;

    return NextResponse.json({
      users: users.map(u => ({
        id: u.id,
        username: u.username,
        reminders: u.settings.reminders,
        timezone: u.settings.timezone,
        qstashScheduleId: u.settings.qstashScheduleId,
      })),
      entries
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// Force-create a QStash schedule for a given userId using the same logic as updateSettings
export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { userId } = await req.json();
  if (!userId) return NextResponse.json({ error: "userId required" }, { status: 400 });

  try {
    const result = await db.execute({
      sql: "SELECT id, username, settings FROM users WHERE id = ?",
      args: [userId]
    });
    
    const user = result.rows[0] as any;
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });
    
    const settings = JSON.parse((user.settings as string) || "{}");
    const reminders = settings.reminders;
    const timezone = settings.timezone || "UTC";
    
    if (!reminders?.enabled || !reminders?.time) {
      return NextResponse.json({ 
        error: "Reminders not enabled or time not set",
        currentSettings: { reminders, timezone }
      }, { status: 400 });
    }

    const qstashToken = process.env.QSTASH_TOKEN;
    const appUrl = process.env.APP_URL 
      || process.env.NEXT_PUBLIC_APP_URL 
      || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined);

    if (!qstashToken || !appUrl) {
      return NextResponse.json({ 
        error: "Missing env vars", 
        qstashToken: !!qstashToken, 
        appUrl 
      }, { status: 500 });
    }

    const { Client } = await import("@upstash/qstash");
    const client = new Client({ token: qstashToken });

    // Delete old schedule if exists
    if (settings.qstashScheduleId) {
      try {
        await client.schedules.delete(settings.qstashScheduleId);
      } catch {}
    }

    const [h, m] = reminders.time.split(":");
    const cron = `CRON_TZ=${timezone} ${Number(m)} ${Number(h)} * * *`;
    const destination = `${appUrl.replace(/\/$/, "")}/api/cron/reminders`;

    const res = await client.schedules.create({
      destination,
      cron,
      body: JSON.stringify({ userId }),
      headers: {
        "Authorization": `Bearer ${process.env.CRON_SECRET}`,
        "Content-Type": "application/json"
      }
    });

    // Save scheduleId back to user settings
    settings.qstashScheduleId = res.scheduleId;
    await db.execute({
      sql: "UPDATE users SET settings = ? WHERE id = ?",
      args: [JSON.stringify(settings), userId]
    });

    return NextResponse.json({ 
      success: true, 
      scheduleId: res.scheduleId, 
      cron, 
      destination,
      reminders,
      timezone
    });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}
