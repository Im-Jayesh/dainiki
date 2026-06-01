import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sendEmailReminder } from "@/lib/notifications";
import { format } from "date-fns";
import { toZonedTime } from "date-fns-tz";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  // Security check: Only allow Vercel's Cron or a secret key to trigger this
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    console.warn(`[Vercel Cron] Unauthorized attempt at ${new Date().toISOString()}`);
    return new Response("Unauthorized", { status: 401 });
  }

  const utcNow = new Date();
  const results = [];

  console.log(`[Vercel Cron] Start processing at ${utcNow.toISOString()}`);

  try {
    // Fetch all users with reminders enabled
    const result = await db.execute("SELECT id, username, email, settings FROM users");
    const users = result.rows;
    
    console.log(`[Vercel Cron] Found ${users.length} total users.`);

    for (const user of users) {
      try {
        const settings = JSON.parse((user.settings as string) || "{}");
        const reminders = settings.reminders || {};
        const userTimezone = settings.timezone || "UTC";

        if (!reminders.enabled) {
          console.log(`[Vercel Cron] User ${user.username} has reminders disabled.`);
          continue;
        }

        // Calculate local time for this user
        const localNow = toZonedTime(utcNow, userTimezone);
        const localTimeString = format(localNow, "HH:mm");
        
        console.log(`[Vercel Cron] Checking user ${user.username}. Scheduled: ${reminders.time}, Local now: ${localTimeString} (${userTimezone})`);

        if (reminders.time === localTimeString) {
          console.log(`[Vercel Cron] TIME MATCH! Sending email to ${user.username}...`);
          await sendEmailReminder(
            user.email as string,
            user.username as string
          );
          results.push({ user: user.username, status: "sent", time: localTimeString });
        }
      } catch (e) {
        console.error(`[Vercel Cron] Error for user ${user.username}:`, e);
      }
    }

    console.log(`[Vercel Cron] Finished. Sent ${results.length} email notifications.`);
    return NextResponse.json({ success: true, processed: results.length, details: results });
  } catch (err: any) {
    console.error("[Vercel Cron] Database error:", err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
