import { readJson, writeJson } from './store.js';

interface LevelUser {
  xp: number;
  level: number;
  messages: number;
}

type LevelStore = Record<string, Record<string, LevelUser>>;

function load(): LevelStore {
  return readJson<LevelStore>('levels.json', {});
}

function save(data: LevelStore): void {
  writeJson('levels.json', data);
}

export function xpForLevel(level: number): number {
  return 5 * level * level + 50 * level + 100;
}

export function getUserLevel(guildId: string, userId: string): LevelUser {
  const data = load();
  return data[guildId]?.[userId] ?? { xp: 0, level: 0, messages: 0 };
}

export function addMessageXp(guildId: string, userId: string, amount = 15): { leveled: boolean; level: number; xp: number } {
  const data = load();
  if (!data[guildId]) data[guildId] = {};
  const user = data[guildId][userId] ?? { xp: 0, level: 0, messages: 0 };
  user.xp += amount;
  user.messages += 1;

  let leveled = false;
  while (user.xp >= xpForLevel(user.level + 1)) {
    user.xp -= xpForLevel(user.level + 1);
    user.level += 1;
    leveled = true;
  }

  data[guildId][userId] = user;
  save(data);
  return { leveled, level: user.level, xp: user.xp };
}

export function getLeaderboard(guildId: string, limit = 10): Array<{ userId: string; level: number; xp: number; messages: number }> {
  const data = load();
  const entries = Object.entries(data[guildId] ?? {}).map(([userId, stats]) => ({
    userId,
    ...stats,
  }));
  entries.sort((a, b) => b.level - a.level || b.xp - a.xp);
  return entries.slice(0, limit);
}

const cooldown = new Map<string, number>();

export function canGainXp(guildId: string, userId: string, ms = 60_000): boolean {
  const key = `${guildId}:${userId}`;
  const last = cooldown.get(key) ?? 0;
  if (Date.now() - last < ms) return false;
  cooldown.set(key, Date.now());
  return true;
}
