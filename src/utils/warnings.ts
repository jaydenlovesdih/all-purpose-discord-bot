import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { GuildWarnings, WarningRecord } from '../types/index.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, '../../data');
const WARNINGS_FILE = join(DATA_DIR, 'warnings.json');

function ensureDataDir(): void {
  if (!existsSync(DATA_DIR)) {
    mkdirSync(DATA_DIR, { recursive: true });
  }
}

function loadAll(): Record<string, GuildWarnings> {
  ensureDataDir();
  if (!existsSync(WARNINGS_FILE)) return {};
  try {
    return JSON.parse(readFileSync(WARNINGS_FILE, 'utf-8')) as Record<string, GuildWarnings>;
  } catch {
    return {};
  }
}

function saveAll(data: Record<string, GuildWarnings>): void {
  ensureDataDir();
  writeFileSync(WARNINGS_FILE, JSON.stringify(data, null, 2), 'utf-8');
}

export function addWarning(
  guildId: string,
  userId: string,
  moderatorId: string,
  reason: string,
): WarningRecord {
  const all = loadAll();
  if (!all[guildId]) all[guildId] = {};

  const record: WarningRecord = {
    userId,
    moderatorId,
    reason,
    timestamp: Date.now(),
  };

  if (!all[guildId][userId]) all[guildId][userId] = [];
  all[guildId][userId].push(record);
  saveAll(all);
  return record;
}

export function getWarnings(guildId: string, userId: string): WarningRecord[] {
  const all = loadAll();
  return all[guildId]?.[userId] ?? [];
}

export function clearWarnings(guildId: string, userId: string): number {
  const all = loadAll();
  const count = all[guildId]?.[userId]?.length ?? 0;
  if (all[guildId]?.[userId]) {
    delete all[guildId][userId];
    saveAll(all);
  }
  return count;
}
