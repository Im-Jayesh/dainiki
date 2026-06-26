import { createClient } from "@libsql/client";

const url = process.env.TURSO_DATABASE_URL || "file:data/journal.db";
const authToken = process.env.TURSO_AUTH_TOKEN;

export const db = createClient({
  url: url,
  authToken: authToken,
});

// Helper to initialize tables
export async function initDb() {
  await db.execute(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      pin_hash TEXT,
      recovery_key TEXT NOT NULL,
      secret_question TEXT,
      secret_answer_hash TEXT,
      settings TEXT DEFAULT '{}',
      ai_credits INTEGER DEFAULT 10,
      last_ai_usage_date TEXT,
      role TEXT DEFAULT 'user',
      encryption_salt TEXT NOT NULL,
      email TEXT UNIQUE,
      is_verified INTEGER DEFAULT 0,
      otp_code TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Simple migrations for users table
  const userColumns = [
    { name: 'ai_credits', type: 'INTEGER DEFAULT 10' },
    { name: 'last_ai_usage_date', type: 'TEXT' },
    { name: 'role', type: "TEXT DEFAULT 'user'" },
    { name: 'encryption_salt', type: 'TEXT' },
    { name: 'email', type: 'TEXT' },
    { name: 'is_verified', type: 'INTEGER DEFAULT 0' },
    { name: 'otp_code', type: 'TEXT' },
    { name: 'master_key_password', type: 'TEXT' },
    { name: 'master_key_pin', type: 'TEXT' },
    { name: 'is_banned', type: 'INTEGER DEFAULT 0' },
    { name: 'invite_token', type: 'TEXT' },
    { name: 'invite_expires', type: 'TEXT' }
  ];

  for (const col of userColumns) {
    try {
      await db.execute(`ALTER TABLE users ADD COLUMN ${col.name} ${col.type}`);
    } catch (e) {
      // Column probably already exists
    }
  }

  await db.execute(`
    CREATE TABLE IF NOT EXISTS echoes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sender_id INTEGER NOT NULL,
      receiver_id INTEGER,
      content TEXT NOT NULL,
      reaction_emoji TEXT,
      is_anonymized INTEGER DEFAULT 1,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (sender_id) REFERENCES users(id),
      FOREIGN KEY (receiver_id) REFERENCES users(id)
    );
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS ai_usage_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      prompt_tokens INTEGER DEFAULT 0,
      completion_tokens INTEGER DEFAULT 0,
      feature TEXT NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS moods (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      emoji TEXT,
      is_custom INTEGER DEFAULT 0,
      user_id INTEGER,
      FOREIGN KEY (user_id) REFERENCES users(id),
      UNIQUE(name, user_id)
    );
  `);

  try {
    await db.execute(`ALTER TABLE moods ADD COLUMN user_id INTEGER REFERENCES users(id)`);
  } catch (e) {}

  await db.execute(`
    CREATE TABLE IF NOT EXISTS entries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      title TEXT,
      content TEXT NOT NULL,
      mood_id INTEGER,
      tags TEXT DEFAULT '[]',
      image_paths TEXT DEFAULT '[]',
      is_archived INTEGER DEFAULT 0,
      is_deleted INTEGER DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (mood_id) REFERENCES moods(id)
    );
  `);

  try {
    await db.execute(`ALTER TABLE entries ADD COLUMN user_id INTEGER REFERENCES users(id)`);
  } catch (e) {}

  // Migrations for entries table (AI feature history)
  const entryColumns = [
    { name: 'ai_summary', type: 'TEXT' },
    { name: 'ai_reflection', type: 'TEXT' },
    { name: 'ai_format', type: 'TEXT' },
    { name: 'ai_history', type: 'TEXT' }
  ];

  for (const col of entryColumns) {
    try {
      await db.execute(`ALTER TABLE entries ADD COLUMN ${col.name} ${col.type}`);
    } catch (e) {
      // Column probably already exists
    }
  }

  // Create chat_messages table for persisted chat
  await db.execute(`
    CREATE TABLE IF NOT EXISTS chat_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      session_id TEXT,
      session_title TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );
  `);

  try {
    await db.execute(`ALTER TABLE chat_messages ADD COLUMN session_id TEXT`);
  } catch (e) {}
  try {
    await db.execute(`ALTER TABLE chat_messages ADD COLUMN session_title TEXT`);
  } catch (e) {}

  // Create entry_ai_history table for version log of AI generations per entry
  await db.execute(`
    CREATE TABLE IF NOT EXISTS entry_ai_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      entry_id INTEGER NOT NULL,
      feature TEXT NOT NULL,
      content TEXT NOT NULL,
      status TEXT DEFAULT 'pending',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (entry_id) REFERENCES entries(id) ON DELETE CASCADE
    );
  `);

  // Seed default moods
  const moods = [
    ['Happy', '😊', 0],
    ['Sad', '😢', 0],
    ['Anxious', '😰', 0],
    ['Excited', '🤩', 0],
    ['Calm', '😌', 0],
    ['Angry', '😡', 0]
  ];

  for (const [name, emoji, is_custom] of moods) {
    try {
      await db.execute({
        sql: "INSERT OR IGNORE INTO moods (name, emoji, is_custom) VALUES (?, ?, ?)",
        args: [name, emoji, is_custom]
      });
    } catch (e) {
      // Ignore unique constraint errors
    }
  }
}
