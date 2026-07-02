import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env" });

import { db } from "../lib/db";
import { format } from "date-fns";
import { toZonedTime } from "date-fns-tz";
import { calculateUserStreak } from "../lib/reminders";
import { GoogleGenerativeAI } from "@google/generative-ai";

async function run() {
  const userId = 5;
  console.log(`[DEBUG] Fetching data for User ID: ${userId}...`);
  
  const result = await db.execute({
    sql: "SELECT id, username, email, settings FROM users WHERE id = ?",
    args: [userId]
  });
  
  const user = result.rows[0];
  if (!user) {
    console.log("[DEBUG] User not found!");
    return;
  }
  
  console.log(`[DEBUG] User found: ${user.username} (${user.email})`);

  const settings = JSON.parse((user.settings as string) || "{}");
  const userTimezone = settings.timezone || "UTC";
  console.log(`[DEBUG] User Timezone: ${userTimezone}`);

  const entriesResult = await db.execute({
    sql: "SELECT created_at FROM entries WHERE user_id = ? ORDER BY created_at DESC",
    args: [user.id]
  });

  const utcNow = new Date();
  const localNow = toZonedTime(utcNow, userTimezone);
  const localTodayStr = format(localNow, "yyyy-MM-dd");

  let alreadyWrittenToday = false;
  if (entriesResult.rows.length > 0) {
    const dbCreatedAt = entriesResult.rows[0].created_at as string;
    const utcDate = new Date(dbCreatedAt.includes("T") ? dbCreatedAt : dbCreatedAt.replace(" ", "T") + "Z");
    const zonedDate = toZonedTime(utcDate, userTimezone);
    const lastEntryLocalDateStr = format(zonedDate, "yyyy-MM-dd");
    
    console.log(`[DEBUG] Last Entry Local Date: ${lastEntryLocalDateStr}`);
    console.log(`[DEBUG] Local Today Date: ${localTodayStr}`);
    
    if (lastEntryLocalDateStr === localTodayStr) {
      alreadyWrittenToday = true;
    }
  } else {
    console.log("[DEBUG] No entries found for this user.");
  }

  console.log(`[DEBUG] alreadyWrittenToday evaluates to: ${alreadyWrittenToday}`);

  const streak = calculateUserStreak(entriesResult.rows, userTimezone);
  console.log(`[DEBUG] Streak: ${streak}`);

  console.log("\n[DEBUG] Testing Gemini 2.5 Flash-Lite API...");
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
       console.log("[DEBUG] GEMINI_API_KEY is completely missing in .env!");
       return;
    }
    console.log(`[DEBUG] Key starts with: ${apiKey.substring(0, 5)}...`);

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash-lite",
    });

    const prompt = `Write a daily reminder email for user "${user.username}". Current writing streak: ${streak} days. Respond in JSON.`;
    const aiResult = await model.generateContent(prompt);
    console.log("[DEBUG] Gemini Output Success!");
    console.log(aiResult.response.text());
  } catch (e) {
    console.error("[DEBUG] Gemini API Error:", e);
  }
}

run().catch(console.error);
