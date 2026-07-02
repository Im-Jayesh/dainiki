import { Client } from "@upstash/qstash";
import { format, subDays, isSameDay } from "date-fns";
import { toZonedTime } from "date-fns-tz";

/**
 * Calculates a user's current consecutive daily writing streak.
 * Timezone-aware: converts DB UTC times to the user's local timezone.
 */
export function calculateUserStreak(entries: any[], userTimezone: string = "UTC"): number {
  if (!entries || entries.length === 0) return 0;

  // Convert all entry dates to user's local timezone dates (YYYY-MM-DD)
  const entryLocalDates = new Set(
    entries.map(e => {
      const dbCreatedAt = e.created_at as string;
      const utcDate = new Date(dbCreatedAt.includes("T") ? dbCreatedAt : dbCreatedAt.replace(" ", "T") + "Z");
      const zonedDate = toZonedTime(utcDate, userTimezone);
      return format(zonedDate, "yyyy-MM-dd");
    })
  );

  const localNow = toZonedTime(new Date(), userTimezone);
  let checkDate = localNow;
  
  const hasToday = entryLocalDates.has(format(checkDate, "yyyy-MM-dd"));
  const hasYesterday = entryLocalDates.has(format(subDays(checkDate, 1), "yyyy-MM-dd"));

  if (!hasToday && !hasYesterday) {
    return 0; // Streak broken
  }

  let streak = 0;
  if (!hasToday) {
    checkDate = subDays(checkDate, 1);
  }

  while (true) {
    const dateStr = format(checkDate, "yyyy-MM-dd");
    if (entryLocalDates.has(dateStr)) {
      streak++;
      checkDate = subDays(checkDate, 1);
    } else {
      break;
    }
  }

  return streak;
}

/**
 * Replaces any existing QStash schedule for the user and creates a new one if enabled.
 * Returns the new schedule ID (or null if disabled/errored).
 */
export async function scheduleReminder(
  userId: number | string,
  enabled: boolean,
  time24h: string,
  timezone: string,
  currentScheduleId?: string | null
): Promise<string | null> {
  const qstashToken = process.env.QSTASH_TOKEN;
  const appUrl = (
    process.env.APP_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined)
  );

  if (!qstashToken || !appUrl) {
    console.warn(`[Reminders] QSTASH_TOKEN or APP_URL missing. Skipping QStash scheduling.`);
    return null;
  }

  // Do not schedule if local dev environment (localhost cannot receive webhooks)
  if (appUrl.includes("localhost") || appUrl.includes("127.0.0.1")) {
    console.log(`[Reminders] Detected localhost APP_URL (${appUrl}). Skipping QStash scheduling. Run local cron worker instead.`);
    return null;
  }

  const client = new Client({ token: qstashToken });

  // 1. Delete existing schedule if any
  if (currentScheduleId) {
    try {
      await client.schedules.delete(currentScheduleId);
      console.log(`[Reminders] Deleted old schedule: ${currentScheduleId}`);
    } catch (e) {
      console.warn(`[Reminders] Could not delete old schedule ${currentScheduleId}:`, e);
    }
  }

  // Normalize tz formats
  let tz = timezone || "UTC";
  if (tz === "Asia/Calcutta") tz = "Asia/Kolkata";
  if (tz === "Asia/Katmandu") tz = "Asia/Kathmandu";
  if (tz === "Asia/Saigon") tz = "Asia/Ho_Chi_Minh";

  // 2. Create new schedule if enabled
  if (enabled && time24h) {
    const [h, m] = time24h.split(":");
    const cron = `CRON_TZ=${tz} ${Number(m)} ${Number(h)} * * *`;
    const destination = `${appUrl.replace(/\/$/, "")}/api/cron/reminders`;

    console.log(`[Reminders] Creating QStash schedule: ${cron} → ${destination} for User ${userId}`);

    try {
      const res = await client.schedules.create({
        destination,
        cron,
        body: JSON.stringify({ userId }),
        headers: {
          "Authorization": `Bearer ${process.env.CRON_SECRET}`,
          "Content-Type": "application/json",
        },
      });
      console.log(`[Reminders] Schedule created successfully: ${res.scheduleId}`);
      return res.scheduleId;
    } catch (e) {
      console.error("[Reminders] Failed to create QStash schedule:", e);
      return null;
    }
  }

  return null;
}
