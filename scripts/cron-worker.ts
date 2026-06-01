import dotenv from "dotenv";
import cron from "node-cron";
import { db } from "../lib/db";
import { sendEmailReminder } from "../lib/notifications";
import { format } from "date-fns";
import { toZonedTime } from "date-fns-tz";

// Load .env variables for standalone execution
dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env" });

console.log("Dainiki Cron Worker Starting...");
console.log("Database URL:", process.env.TURSO_DATABASE_URL ? "Configured" : "MISSING");
console.log("Email User:", process.env.EMAIL_USER ? "Configured" : "MISSING");

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
    const result = await db.execute("SELECT id, username, email, settings FROM users");
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
          console.log(`[Cron] Sending email to ${user.username} (Local Time: ${localTimeString}, TZ: ${userTimezone})...`);
          
          await sendEmailReminder(
            user.email as string,
            user.username as string
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
