import { initDb } from "./lib/db";

async function main() {
  console.log("Initializing remote database tables...");
  try {
    await initDb();
    console.log("Database initialized successfully!");
  } catch (err) {
    console.error("Failed to initialize database:", err);
  }
}

main();
