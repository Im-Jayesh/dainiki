import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { Client } from "@upstash/qstash";

export const dynamic = "force-dynamic";

/**
 * POST /api/reminders/schedule
 * Body: { userId, enabled, time, timezone }
 * Creates or deletes a QStash schedule for the user.
 * Called directly from the client with the session cookie for auth.
 */
export async function POST(req: NextRequest) {
  try {
    const { userId, enabled, time, timezone } = await req.json();

    if (!userId) {
      return NextResponse.json({ error: "userId required" }, { status: 400 });
    }

    const qstashToken = process.env.QSTASH_TOKEN;
    const appUrl = (
      process.env.APP_URL ||
      process.env.NEXT_PUBLIC_APP_URL ||
      (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null)
    );

    console.log(`[Reminders] userId=${userId}, enabled=${enabled}, time=${time}, tz=${timezone}`);
    console.log(`[Reminders] qstashToken=${!!qstashToken}, appUrl=${appUrl}`);

    if (!qstashToken || !appUrl) {
      return NextResponse.json({
        error: "Server misconfiguration: QSTASH_TOKEN or APP_URL missing",
        qstashToken: !!qstashToken,
        appUrl,
      }, { status: 500 });
    }

    // Fetch current user settings
    const result = await db.execute({
      sql: "SELECT id, settings FROM users WHERE id = ?",
      args: [userId],
    });
    const user = result.rows[0] as any;
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    const settings = JSON.parse((user.settings as string) || "{}");
    const client = new Client({ token: qstashToken });

    // Delete existing schedule if any
    if (settings.qstashScheduleId) {
      try {
        await client.schedules.delete(settings.qstashScheduleId);
        console.log(`[Reminders] Deleted old schedule: ${settings.qstashScheduleId}`);
      } catch (e) {
        console.warn(`[Reminders] Could not delete old schedule:`, e);
      }
      settings.qstashScheduleId = null;
    }

    // Create new schedule if enabled
    if (enabled && time) {
      const [h, m] = time.split(":");
      const tz = timezone || "UTC";
      const cron = `CRON_TZ=${tz} ${Number(m)} ${Number(h)} * * *`;
      const destination = `${appUrl.replace(/\/$/, "")}/api/cron/reminders`;

      console.log(`[Reminders] Creating schedule: ${cron} → ${destination}`);

      const res = await client.schedules.create({
        destination,
        cron,
        body: JSON.stringify({ userId }),
        headers: {
          "Authorization": `Bearer ${process.env.CRON_SECRET}`,
          "Content-Type": "application/json",
        },
      });

      settings.qstashScheduleId = res.scheduleId;
      console.log(`[Reminders] Schedule created: ${res.scheduleId}`);
    }

    // Persist updated settings
    settings.reminders = { ...(settings.reminders || {}), enabled, time };
    settings.timezone = timezone || settings.timezone;

    await db.execute({
      sql: "UPDATE users SET settings = ? WHERE id = ?",
      args: [JSON.stringify(settings), userId],
    });

    return NextResponse.json({
      success: true,
      scheduleId: settings.qstashScheduleId || null,
      enabled,
      time,
      timezone: settings.timezone,
    });
  } catch (e: any) {
    console.error("[Reminders] Error:", e);
    return NextResponse.json({ success: false, error: e?.message || String(e) }, { status: 500 });
  }
}
