import { Routes, type Client } from 'discord.js';
import { readJson, writeJson } from './store.js';
import { cacheGuildRoles, getCachedGuildRoles } from './permissionRoles.js';
import { fetchGuildRolesApi, type RoleLike } from './userInstall.js';

const KEY = 'guild-roles-cache.json';

type Store = Record<string, RoleLike[]>;

function load(): Store {
  return readJson<Store>(KEY, {});
}

function save(store: Store): void {
  writeJson(KEY, store);
}

export function getPersistedGuildRoles(guildId: string): RoleLike[] {
  return load()[guildId] ?? [];
}

/** Save a full or merged role list for a guild (used when REST succeeds or roles are collected). */
export function persistGuildRoles(guildId: string, roles: RoleLike[]): void {
  if (!roles.length) return;
  const store = load();
  const byId = new Map((store[guildId] ?? []).map((r) => [r.id, r]));
  for (const role of roles) byId.set(role.id, role);
  store[guildId] = [...byId.values()].sort((a, b) => b.position - a.position);
  save(store);
}

/** Persist every guild role when the bot can see the server (startup / join). */
export async function warmGuildRolesCache(client: Client, guildId: string): Promise<void> {
  let roles: RoleLike[] | null = null;

  try {
    const raw = (await client.rest.get(Routes.guildRoles(guildId))) as import('discord.js').APIRole[];
    roles = raw
      .filter((r) => r.id !== guildId)
      .sort((a, b) => b.position - a.position)
      .map((r) => ({
        id: r.id,
        name: r.name,
        permissions: r.permissions,
        position: r.position,
        color: r.color,
        hoist: r.hoist,
        managed: r.managed,
        mentionable: r.mentionable,
      }));
  } catch {
    const guild = client.guilds.cache.get(guildId);
    if (guild) {
      if (guild.roles.cache.size <= 1) await guild.roles.fetch().catch(() => undefined);
      roles = [...guild.roles.cache.values()]
        .filter((r) => r.id !== guild.id)
        .sort((a, b) => b.position - a.position)
        .map((r) => ({
          id: r.id,
          name: r.name,
          permissions: r.permissions.bitfield.toString(),
          position: r.position,
          color: r.color,
          hoist: r.hoist,
          managed: r.managed,
          mentionable: r.mentionable,
          hexColor: r.hexColor,
        }));
    }
  }

  if (roles?.length) {
    persistGuildRoles(guildId, roles);
    cacheGuildRoles(guildId, roles);
  }
}

/** Load every role we can for /roles — interaction guild, REST, guild cache, persisted KV, or prior Role Select cache. */
export async function loadGuildRolesForBrowse(
  interaction: import('discord.js').ChatInputCommandInteraction | import('discord.js').MessageComponentInteraction,
): Promise<RoleLike[]> {
  const guildId = interaction.guildId;
  if (!guildId) return [];

  let roles = (await fetchGuildRolesApi(interaction)) ?? [];
  if (roles.length) {
    persistGuildRoles(guildId, roles);
    cacheGuildRoles(guildId, roles);
    return roles;
  }

  roles = getPersistedGuildRoles(guildId);
  if (roles.length) {
    cacheGuildRoles(guildId, roles);
    return roles;
  }

  return getCachedGuildRoles(guildId);
}
