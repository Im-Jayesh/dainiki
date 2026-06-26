import { db } from "./db";

export interface Entry {
  id?: number;
  user_id: number;
  title: string;
  content: string;
  mood_id?: number;
  tags?: string[];
  image_paths?: string[];
  is_archived?: boolean;
  is_deleted?: boolean;
  ai_summary?: string | null;
  ai_reflection?: string | null;
  ai_format?: string | null;
  ai_history?: string | null;
  created_at?: string;
  updated_at?: string;
}

export async function createEntry(entry: Entry) {
  const result = await db.execute({
    sql: `INSERT INTO entries (user_id, title, content, mood_id, tags, image_paths, ai_summary, ai_reflection, ai_format, ai_history)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      entry.user_id,
      entry.title,
      entry.content,
      entry.mood_id || null,
      JSON.stringify(entry.tags || []),
      JSON.stringify(entry.image_paths || []),
      entry.ai_summary || null,
      entry.ai_reflection || null,
      entry.ai_format || null,
      entry.ai_history || null
    ]
  });

  return result.lastInsertRowid;
}

export async function updateEntry(id: number, userId: number, entry: Partial<Entry>) {
  const fields: string[] = [];
  const values: any[] = [];

  if (entry.title !== undefined) {
    fields.push("title = ?");
    values.push(entry.title);
  }
  if (entry.content !== undefined) {
    fields.push("content = ?");
    values.push(entry.content);
  }
  if (entry.mood_id !== undefined) {
    fields.push("mood_id = ?");
    values.push(entry.mood_id);
  }
  if (entry.tags !== undefined) {
    fields.push("tags = ?");
    values.push(JSON.stringify(entry.tags));
  }
  if (entry.image_paths !== undefined) {
    fields.push("image_paths = ?");
    values.push(JSON.stringify(entry.image_paths));
  }
  if (entry.is_archived !== undefined) {
    fields.push("is_archived = ?");
    values.push(entry.is_archived ? 1 : 0);
  }
  if (entry.is_deleted !== undefined) {
    fields.push("is_deleted = ?");
    values.push(entry.is_deleted ? 1 : 0);
  }
  if (entry.ai_summary !== undefined) {
    fields.push("ai_summary = ?");
    values.push(entry.ai_summary);
  }
  if (entry.ai_reflection !== undefined) {
    fields.push("ai_reflection = ?");
    values.push(entry.ai_reflection);
  }
  if (entry.ai_format !== undefined) {
    fields.push("ai_format = ?");
    values.push(entry.ai_format);
  }
  if (entry.ai_history !== undefined) {
    fields.push("ai_history = ?");
    values.push(entry.ai_history);
  }

  fields.push("updated_at = CURRENT_TIMESTAMP");

  return await db.execute({
    sql: `UPDATE entries SET ${fields.join(", ")} WHERE id = ? AND user_id = ?`,
    args: [...values, id, userId]
  });
}

export async function getEntry(id: number, userId: number) {
  const result = await db.execute({
    sql: `SELECT e.*, m.name as mood_name, m.emoji as mood_emoji
          FROM entries e
          LEFT JOIN moods m ON e.mood_id = m.id
          WHERE e.id = ? AND e.user_id = ?`,
    args: [id, userId]
  });

  const row = result.rows[0];
  if (row) {
    const entry = { ...row } as any;
    entry.id = Number(entry.id);
    entry.user_id = Number(entry.user_id);
    entry.mood_id = entry.mood_id ? Number(entry.mood_id) : undefined;
    entry.tags = JSON.parse(entry.tags || "[]");
    entry.image_paths = JSON.parse(entry.image_paths || "[]");
    return entry;
  }
  return null;
}

export async function getEntries(userId: number, options: { view?: "active" | "archived" | "deleted" } = { view: "active" }) {
  let query = `
    SELECT e.*, m.name as mood_name, m.emoji as mood_emoji
    FROM entries e
    LEFT JOIN moods m ON e.mood_id = m.id
    WHERE e.user_id = ?
  `;

  if (options.view === "deleted") {
    query += " AND e.is_deleted = 1";
  } else if (options.view === "archived") {
    query += " AND e.is_archived = 1 AND e.is_deleted = 0";
  } else {
    query += " AND e.is_deleted = 0 AND e.is_archived = 0";
  }

  query += " ORDER BY e.created_at DESC";

  const result = await db.execute({
    sql: query,
    args: [userId]
  });

  return result.rows.map(row => {
    const e = { ...row } as any;
    return {
      ...e,
      id: Number(e.id),
      user_id: Number(e.user_id),
      mood_id: e.mood_id ? Number(e.mood_id) : undefined,
      tags: JSON.parse(e.tags || "[]"),
      image_paths: JSON.parse(e.image_paths || "[]")
    };
  });
}

export async function softDeleteEntry(id: number, userId: number) {
  return updateEntry(id, userId, { is_deleted: true });
}

export async function hardDeleteEntry(id: number, userId: number) {
  return await db.execute({
    sql: "DELETE FROM entries WHERE id = ? AND user_id = ?",
    args: [id, userId]
  });
}

export async function archiveEntry(id: number, userId: number, archived: boolean = true) {
  return updateEntry(id, userId, { is_archived: archived });
}

export async function getMoods(userId?: number) {
  const result = await db.execute({
    sql: "SELECT * FROM moods WHERE user_id IS NULL OR user_id = ? ORDER BY is_custom ASC, name ASC",
    args: [userId || null]
  });
  return result.rows.map(m => ({
    id: Number(m.id),
    name: String(m.name),
    emoji: String(m.emoji),
    is_custom: Boolean(m.is_custom),
    user_id: m.user_id ? Number(m.user_id) : null
  }));
}

export async function createMood(name: string, emoji: string, userId: number) {
  return await db.execute({
    sql: "INSERT INTO moods (name, emoji, is_custom, user_id) VALUES (?, ?, 1, ?)",
    args: [name, emoji, userId]
  });
}

export async function searchEntries(term: string, userId: number, options: { view?: "active" | "archived" | "deleted" } = { view: "active" }) {
  let query = `
    SELECT e.*, m.name as mood_name, m.emoji as mood_emoji
    FROM entries e
    LEFT JOIN moods m ON e.mood_id = m.id
    WHERE (e.title LIKE ? OR e.content LIKE ? OR e.tags LIKE ?)
    AND e.user_id = ?
  `;

  if (options.view === "deleted") {
    query += " AND e.is_deleted = 1";
  } else if (options.view === "archived") {
    query += " AND e.is_archived = 1 AND e.is_deleted = 0";
  } else {
    query += " AND e.is_deleted = 0 AND e.is_archived = 0";
  }

  query += " ORDER BY e.created_at DESC";

  const result = await db.execute({
    sql: query,
    args: [`%${term}%`, `%${term}%`, `%${term}%`, userId]
  });

  const entries = result.rows as any[];

  return entries.map(e => ({
    ...e,
    id: Number(e.id),
    user_id: Number(e.user_id),
    mood_id: e.mood_id ? Number(e.mood_id) : undefined,
    tags: JSON.parse(e.tags || "[]"),
  }));
}

export async function createAiHistoryItem(
  entryId: number,
  feature: string,
  content: string,
  status: string = "pending"
) {
  const result = await db.execute({
    sql: `INSERT INTO entry_ai_history (entry_id, feature, content, status)
          VALUES (?, ?, ?, ?)`,
    args: [entryId, feature, content, status]
  });
  return Number(result.lastInsertRowid);
}

export async function getAiHistoryForEntry(entryId: number) {
  const result = await db.execute({
    sql: `SELECT * FROM entry_ai_history
          WHERE entry_id = ?
          ORDER BY created_at ASC`,
    args: [entryId]
  });
  return result.rows.map(row => ({
    id: String(row.id),
    entry_id: Number(row.entry_id),
    feature: String(row.feature) as "summarize" | "format" | "reflect",
    content: String(row.content),
    status: row.status ? String(row.status) as "pending" | "applied" | "discarded" : undefined,
    created_at: String(row.created_at)
  }));
}

export async function updateAiHistoryItemStatus(id: number, status: string) {
  return await db.execute({
    sql: `UPDATE entry_ai_history SET status = ? WHERE id = ?`,
    args: [status, id]
  });
}

export async function clearAiHistoryForEntry(entryId: number) {
  return await db.execute({
    sql: `DELETE FROM entry_ai_history WHERE entry_id = ?`,
    args: [entryId]
  });
}

