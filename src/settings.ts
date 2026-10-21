// The lists you edit in the app live in D1; src/config.ts holds the defaults until the first edit.
import { config, type Source } from "./config.ts";

export type Lists = { sources: Source[]; topics: string[]; muted: string[] };

export async function lists(db: D1Database): Promise<Lists> {
  const rows = (await db.prepare(`SELECT key, value FROM settings`).all<{ key: string; value: string }>()).results;
  const get = <T>(k: string, d: T): T => { const r = rows.find((x) => x.key === k); return r ? JSON.parse(r.value) : d; };
  return { sources: get("sources", config.sources), topics: get("topics", config.topics), muted: get("muted", config.muted) };
}

export const saveList = (db: D1Database, key: keyof Lists, value: unknown) =>
  db.prepare(`INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value`).bind(key, JSON.stringify(value)).run();
