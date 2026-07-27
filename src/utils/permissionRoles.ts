import {
  ActionRowBuilder,
  PermissionFlagsBits,
  PermissionsBitField,
  RoleSelectMenuBuilder,
  StringSelectMenuBuilder,
  type AutocompleteInteraction,
  type ChatInputCommandInteraction,
} from 'discord.js';
import { Colors } from './embeds.js';
import { EmbedBuilder } from 'discord.js';
import {
  fetchGuildRolesApi,
  type RoleLike,
  wantsPlainRoleReply,
} from './userInstall.js';

export interface PermissionChoice {
  key: string;
  label: string;
  bit: bigint;
}

export interface PendingPermissionRolesView {
  ownerId: string;
  permissionKey: string;
  permPage: number;
  plain: boolean;
  guildName?: string | null;
  roles: RoleLike[];
}

export const pendingPermissionRolesViews = new Map<string, PendingPermissionRolesView>();

/** Cross-command role cache so Role Select picks feed permissionroles without the bot in the guild. */
const guildRoleCache = new Map<string, Map<string, RoleLike>>();

export function cacheGuildRoles(guildId: string | null | undefined, roles: RoleLike[]): void {
  if (!guildId || !roles.length) return;
  let map = guildRoleCache.get(guildId);
  if (!map) {
    map = new Map();
    guildRoleCache.set(guildId, map);
  }
  for (const role of roles) {
    map.set(role.id, role);
  }
}

export function getCachedGuildRoles(guildId: string | null | undefined): RoleLike[] {
  if (!guildId) return [];
  const map = guildRoleCache.get(guildId);
  if (!map?.size) return [];
  return [...map.values()].sort((a, b) => b.position - a.position);
}

let cachedPermissions: PermissionChoice[] | null = null;

export function listAllPermissions(): PermissionChoice[] {
  if (cachedPermissions) return cachedPermissions;
  cachedPermissions = Object.entries(PermissionFlagsBits)
    .filter((entry): entry is [string, bigint] => typeof entry[1] === 'bigint')
    .map(([key, bit]) => ({
      key,
      label: key.replace(/([a-z])([A-Z])/g, '$1 $2'),
      bit,
    }))
    .sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: 'base' }));
  return cachedPermissions;
}

export function findPermission(input: string): PermissionChoice | null {
  const q = input.trim().toLowerCase().replace(/[_\s]+/g, '');
  if (!q) return null;
  const all = listAllPermissions();

  const exactKey = all.find((p) => p.key.toLowerCase() === input.trim() || p.key.toLowerCase() === q);
  if (exactKey) return exactKey;

  const exactLabel = all.find(
    (p) =>
      p.label.toLowerCase() === input.trim().toLowerCase() ||
      p.label.toLowerCase().replace(/\s+/g, '') === q,
  );
  if (exactLabel) return exactLabel;

  const starts = all.filter(
    (p) =>
      p.label.toLowerCase().startsWith(input.trim().toLowerCase()) ||
      p.key.toLowerCase().startsWith(q) ||
      p.label.toLowerCase().replace(/\s+/g, '').startsWith(q),
  );
  if (starts.length === 1) return starts[0];
  if (starts.length > 1) {
    return starts.sort((a, b) => a.label.length - b.label.length)[0];
  }

  const includes = all.filter(
    (p) =>
      p.label.toLowerCase().includes(input.trim().toLowerCase()) ||
      p.key.toLowerCase().includes(q) ||
      p.label.toLowerCase().replace(/\s+/g, '').includes(q),
  );
  if (includes.length) return includes.sort((a, b) => a.label.length - b.label.length)[0];

  return null;
}

export function roleHasPermission(role: RoleLike, perm: PermissionChoice): boolean {
  const bits = new PermissionsBitField(
    typeof role.permissions === 'string' ? BigInt(role.permissions) : role.permissions,
  );
  if (bits.has(PermissionFlagsBits.Administrator)) return true;
  return bits.has(perm.bit);
}

export async function respondPermissionAutocomplete(
  interaction: AutocompleteInteraction,
): Promise<void> {
  const focused = interaction.options.getFocused(true);
  const q = focused.value.toLowerCase().trim();
  const all = listAllPermissions();
  const filtered = q
    ? all.filter(
        (p) =>
          p.label.toLowerCase().includes(q) ||
          p.key.toLowerCase().includes(q.replace(/\s+/g, '')),
      )
    : all;
  await interaction.respond(
    filtered.slice(0, 25).map((p) => ({
      name: p.label.slice(0, 100),
      value: p.key,
    })),
  );
}

export function buildPermissionSelectRow(
  ownerId: string,
  page: number,
  selectedKey?: string,
): ActionRowBuilder<StringSelectMenuBuilder> {
  const all = listAllPermissions();
  const PAGE_SIZE = 23;
  const totalPages = Math.max(1, Math.ceil(all.length / PAGE_SIZE));
  const p = Math.min(Math.max(0, page), totalPages - 1);
  const slice = all.slice(p * PAGE_SIZE, p * PAGE_SIZE + PAGE_SIZE);

  const options: { label: string; value: string; description?: string; default?: boolean }[] = [];
  if (p > 0) {
    options.push({
      label: '← Previous permissions',
      value: 'nav:prev',
      description: `Page ${p} of ${totalPages}`,
    });
  }
  for (const perm of slice) {
    const isSelected = selectedKey === perm.key;
    options.push({
      label: perm.label.slice(0, 100),
      value: `perm:${perm.key}`,
      description: isSelected ? 'Currently selected' : undefined,
      ...(isSelected ? { default: true } : {}),
    });
  }
  if (p < totalPages - 1) {
    options.push({
      label: 'Next permissions →',
      value: 'nav:next',
      description: `Page ${p + 2} of ${totalPages}`,
    });
  }

  return new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId(`permroles:pick:${ownerId}`)
      .setPlaceholder(
        selectedKey
          ? `Permission: ${all.find((x) => x.key === selectedKey)?.label ?? selectedKey}`
          : 'Select a permission…',
      )
      .addOptions(options.slice(0, 25)),
  );
}

/**
 * Discord fills Role Select with every role on the client — no bot membership needed.
 * Four menus × 25 = up to 100 roles submitted in one update.
 */
export function buildPermissionRoleScanRows(
  ownerId: string,
): ActionRowBuilder<RoleSelectMenuBuilder>[] {
  return [0, 1, 2, 3].map((i) =>
    new ActionRowBuilder<RoleSelectMenuBuilder>().addComponents(
      new RoleSelectMenuBuilder()
        .setCustomId(`permroles:roles:${ownerId}:${i}`)
        .setPlaceholder(
          i === 0
            ? 'Roles in this server (pick any / all shown)'
            : `More roles (batch ${i + 1})`,
        )
        .setMinValues(1)
        .setMaxValues(25),
    ),
  );
}

export function buildPermissionRolesComponents(
  ownerId: string,
  permPage: number,
  selectedKey: string | undefined,
  needsRoleMenus: boolean,
): ActionRowBuilder<StringSelectMenuBuilder | RoleSelectMenuBuilder>[] {
  const rows: ActionRowBuilder<StringSelectMenuBuilder | RoleSelectMenuBuilder>[] = [
    buildPermissionSelectRow(ownerId, permPage, selectedKey),
  ];
  if (needsRoleMenus) {
    // Permission select is row 1; Discord allows 5 rows → 4 role menus
    rows.push(...buildPermissionRoleScanRows(ownerId));
  }
  return rows;
}

export function buildPermissionRolesEmbed(
  perm: PermissionChoice,
  roles: RoleLike[],
  guildName: string,
): EmbedBuilder {
  const matching = roles.filter((r) => roleHasPermission(r, perm));
  const list = matching.length
    ? matching
        .sort((a, b) => b.position - a.position)
        .map((r, i) => `**${i + 1}.** <@&${r.id}> — \`${r.id}\``)
        .join('\n')
    : '_No roles have this permission._';

  const desc = list.length > 3900 ? `${list.slice(0, 3900)}\n… _(truncated)_` : list;

  return new EmbedBuilder()
    .setColor(Colors.success)
    .setTitle(`Roles with ${perm.label}`)
    .setDescription(desc)
    .setFooter({
      text: `${guildName} · ${matching.length}/${roles.length} roles · switch permission below`,
    })
    .setTimestamp();
}

export function buildPermissionRolesText(
  perm: PermissionChoice,
  roles: RoleLike[],
  guildName: string,
): string {
  const matching = roles
    .filter((r) => roleHasPermission(r, perm))
    .sort((a, b) => b.position - a.position);

  const body = matching.length
    ? matching.map((r, i) => `${i + 1}. <@&${r.id}> — \`${r.id}\``).join('\n')
    : '(no roles have this permission)';

  let text = [
    `**Roles with ${perm.label}**`,
    `Server: ${guildName}`,
    `${matching.length} of ${roles.length} roles`,
    '',
    body,
    '',
    '_Use the dropdowns to switch permission or include more roles._',
  ].join('\n');

  if (text.length > 1900) {
    text = `${text.slice(0, 1900)}\n… _(truncated)_`;
  }
  return text;
}

export function buildPermissionPromptText(guildName: string, roleCount: number): string {
  if (roleCount > 0) {
    return [
      `**Permission → roles**`,
      `Server: ${guildName}`,
      `${roleCount} roles loaded`,
      '',
      'Pick a permission — every loaded role is checked automatically.',
    ].join('\n');
  }
  return [
    `**Permission → roles**`,
    `Server: ${guildName}`,
    '',
    'Pick a permission, then use the role menus below.',
    'Discord lists **every role** in those menus — select them (up to 100 at once across the menus) and they all get checked.',
  ].join('\n');
}

export function rememberPermissionRolesView(
  messageId: string,
  view: PendingPermissionRolesView,
): void {
  pendingPermissionRolesViews.set(messageId, view);
  setTimeout(() => pendingPermissionRolesViews.delete(messageId), 15 * 60_000);
}

export function mergeRoleLikes(existing: RoleLike[], incoming: RoleLike[]): RoleLike[] {
  const byId = new Map(existing.map((r) => [r.id, r]));
  for (const role of incoming) {
    byId.set(role.id, role);
  }
  return [...byId.values()].sort((a, b) => b.position - a.position);
}

/**
 * Load every role we can: REST (if bot is a member) or client-side Role Select cache.
 * Never requires the bot to be in the server — Role Select path always works.
 */
export async function loadRolesForPermissionCheck(
  interaction: ChatInputCommandInteraction | import('discord.js').MessageComponentInteraction,
): Promise<{ roles: RoleLike[]; guildName: string; fromApi: boolean }> {
  const guildName =
    interaction.guild?.name ??
    interaction.client.guilds.cache.get(interaction.guildId ?? '')?.name ??
    'this server';

  const apiRoles = await fetchGuildRolesApi(interaction);
  if (apiRoles?.length) {
    cacheGuildRoles(interaction.guildId, apiRoles);
    return { roles: apiRoles, guildName, fromApi: true };
  }

  const cached = getCachedGuildRoles(interaction.guildId);
  return { roles: cached, guildName, fromApi: false };
}

export { wantsPlainRoleReply };
