import { GuildWarnings, WarningRecord } from '../types/index.js';
import { readJson, writeJson } from './store.js';

const WARNINGS_KEY = 'warnings.json';

function loadAll(): Record<string, GuildWarnings> {
  return readJson<Record<string, GuildWarnings>>(WARNINGS_KEY, {});
}

function saveAll(data: Record<string, GuildWarnings>): void {
  writeJson(WARNINGS_KEY, data);
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
