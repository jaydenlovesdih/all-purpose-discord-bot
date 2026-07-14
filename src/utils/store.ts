import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import postgres, { Sql } from 'postgres';

const __dirname = dirname(fileURLToPath(import.meta.url));
export const DATA_DIR = join(__dirname, '../../data');

let sql: Sql | null = null;
let useDb = false;
const memory = new Map<string, unknown>();
const flushTimers = new Map<string, ReturnType<typeof setTimeout>>();

export function ensureDataDir(): void {
  if (!existsSync(DATA_DIR)) {
    mkdirSync(DATA_DIR, { recursive: true });
  }
}

function filePath(fileName: string): string {
  return join(DATA_DIR, fileName);
}

/**
 * Connects to Postgres when DATABASE_URL is set (Railway).
 * Loads all KV rows into memory so read/write stay sync for the rest of the bot.
 */
export async function initStore(): Promise<void> {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.log('Store: no DATABASE_URL — using local data/ JSON files');
    return;
  }

  sql = postgres(url, {
    max: 5,
    idle_timeout: 20,
    connect_timeout: 30,
  });

  await sql`
    CREATE TABLE IF NOT EXISTS bot_kv (
      key TEXT PRIMARY KEY,
      value JSONB NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  const rows = await sql<{ key: string; value: unknown }[]>`
    SELECT key, value FROM bot_kv
  `;
  for (const row of rows) {
    memory.set(row.key, row.value);
  }

  // Seed from local files if DB is empty (first migrate / local → Railway)
  if (rows.length === 0) {
    ensureDataDir();
    for (const name of ['guilds.json', 'levels.json', 'warnings.json']) {
      const path = filePath(name);
      if (!existsSync(path)) continue;
      try {
        const data = JSON.parse(readFileSync(path, 'utf-8')) as unknown;
        memory.set(name, data);
        await persistKey(name, data);
        console.log(`Store: seeded ${name} into Postgres`);
      } catch {
        /* ignore bad files */
      }
    }
  }

  useDb = true;
  console.log(`Store: Postgres ready (${memory.size} key(s) in memory)`);
}

async function persistKey(key: string, value: unknown): Promise<void> {
  if (!sql) return;
  await sql`
    INSERT INTO bot_kv (key, value, updated_at)
    VALUES (${key}, ${sql.json(value as postgres.JSONValue)}, NOW())
    ON CONFLICT (key) DO UPDATE
      SET value = EXCLUDED.value,
          updated_at = NOW()
  `;
}

function schedulePersist(key: string): void {
  if (!sql) return;
  const prev = flushTimers.get(key);
  if (prev) clearTimeout(prev);
  flushTimers.set(
    key,
    setTimeout(() => {
      flushTimers.delete(key);
      const value = memory.get(key);
      void persistKey(key, value).catch((err) => {
        console.error(`Store: failed to persist ${key}`, err);
      });
    }, 150),
  );
}

/** Flush pending writes (call before process exit if needed). */
export async function flushStore(): Promise<void> {
  if (!sql || !useDb) return;
  for (const [key, timer] of flushTimers) {
    clearTimeout(timer);
    flushTimers.delete(key);
    await persistKey(key, memory.get(key));
  }
}

export function readJson<T>(fileName: string, fallback: T): T {
  if (useDb) {
    if (!memory.has(fileName)) return fallback;
    return structuredClone(memory.get(fileName)) as T;
  }

  ensureDataDir();
  const path = filePath(fileName);
  if (!existsSync(path)) return fallback;
  try {
    return JSON.parse(readFileSync(path, 'utf-8')) as T;
  } catch {
    return fallback;
  }
}

export function writeJson(fileName: string, data: unknown): void {
  if (useDb) {
    memory.set(fileName, structuredClone(data));
    schedulePersist(fileName);
    return;
  }

  ensureDataDir();
  writeFileSync(filePath(fileName), JSON.stringify(data, null, 2), 'utf-8');
}
