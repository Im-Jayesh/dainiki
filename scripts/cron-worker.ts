import dotenv from "dotenv";
import cron from "node-cron";
import { db } from "../lib/db";
import { sendOneSignalNotification } from "../lib/notifications";
import { format } from "date-fns";
import { toZonedTime } from "date-fns-tz";

// Load .env variables for standalone execution
dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env" });

console.log("Dainiki Cron Worker Starting...");
console.log("Database URL:", process.env.TURSO_DATABASE_URL ? "Configured" : "MISSING");
console.log("OneSignal App ID:", process.env.ONESIGNAL_APP_ID ? "Configured" : "MISSING");

// Track notified users to prevent double-pings in the same minute
// Format: username-HH:mm
const notifiedThisMinute = new Set<string>();
let lastMinute = "";

cron.schedule("* * * * *", async () => {
  const utcNow = new Date();
  const minuteKey = format(utcNow, "HH:mm");
  
  // Clear the set every new minute
  if (minuteKey !== lastMinute) {
    notifiedThisMinute.clear();
    lastMinute = minuteKey;
  }
  
  console.log(`[Cron] ${format(new Date(), "PPpp")}: Checking reminders...`);

  try {
    // Fetch all users
    const result = await db.execute("SELECT id, username, settings FROM users");
    const users = result.rows;

    for (const user of users) {
      try {
        const settings = JSON.parse((user.settings as string) || "{}");
        const reminders = settings.reminders || {};
        const userTimezone = settings.timezone || "UTC";

        // Calculate local time for this user based on their stored timezone
        const localNow = toZonedTime(utcNow, userTimezone);
        const localTimeString = format(localNow, "HH:mm");

        if (reminders.enabled && reminders.time === localTimeString && !notifiedThisMinute.has(`${user.username}-${localTimeString}`)) {
          console.log(`[Cron] Sending notification to ${user.username} (Local Time: ${localTimeString}, TZ: ${userTimezone})...`);
          
          await sendOneSignalNotification(
            "Journaling Time",
            `Hi ${user.username}, it's time to capture your thoughts for today!`
          );
          
          notifiedThisMinute.add(`${user.username}-${localTimeString}`);
        }
      } catch (e) {
        console.error(`[Cron] Error processing user ${user.username}:`, e);
      }
    }
  } catch (err) {
    console.error("[Cron] Database error:", err);
  }
});

console.log("Dainiki Cron Worker is now active.");
