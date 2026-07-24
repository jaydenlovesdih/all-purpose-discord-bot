import { readJson, writeJson } from './store.js';

const KEY = 'guild-whitelist.json';

interface GuildWhitelistStore {
  /** Guild IDs allowed to keep / invite the bot */
  guildIds: string[];
}

function load(): GuildWhitelistStore {
  const raw = readJson<GuildWhitelistStore>(KEY, { guildIds: [] });
  const ids = Array.isArray(raw.guildIds)
    ? [...new Set(raw.guildIds.map(String).filter((id) => /^\d{17,20}$/.test(id)))]
    : [];
  return { guildIds: ids };
}

function save(data: GuildWhitelistStore): void {
  writeJson(KEY, { guildIds: [...new Set(data.guildIds)] });
}

export function getWhitelistedGuildIds(): string[] {
  return load().guildIds;
}

export function isGuildWhitelisted(guildId: string): boolean {
  return load().guildIds.includes(guildId);
}

export function addGuildToWhitelist(guildId: string): boolean {
  const id = guildId.trim();
  if (!/^\d{17,20}$/.test(id)) return false;
  const data = load();
  if (data.guildIds.includes(id)) return false;
  data.guildIds.push(id);
  save(data);
  return true;
}

export function removeGuildFromWhitelist(guildId: string): boolean {
  const data = load();
  const before = data.guildIds.length;
  data.guildIds = data.guildIds.filter((id) => id !== guildId);
  if (data.guildIds.length === before) return false;
  save(data);
  return true;
}

/** Ensure every currently joined guild is on the whitelist (idempotent). */
export function syncWhitelistFromGuilds(guildIds: Iterable<string>): number {
  const data = load();
  const set = new Set(data.guildIds);
  let added = 0;
  for (const id of guildIds) {
    if (!/^\d{17,20}$/.test(id)) continue;
    if (!set.has(id)) {
      set.add(id);
      added++;
    }
  }
  data.guildIds = [...set];
  save(data);
  return added;
}
