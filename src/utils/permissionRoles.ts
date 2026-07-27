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
  /** Roles available to filter — from API or collected via Role Select */
  roles: RoleLike[];
  /** True when roles came from GET /guilds/:id/roles (bot in server) */
  fromApi: boolean;
}

export const pendingPermissionRolesViews = new Map<string, PendingPermissionRolesView>();

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

/** Discord fills this with every role — used when we can't GET guild roles via API. */
export function buildPermissionRoleScanRow(
  ownerId: string,
): ActionRowBuilder<RoleSelectMenuBuilder> {
  return new ActionRowBuilder<RoleSelectMenuBuilder>().addComponents(
    new RoleSelectMenuBuilder()
      .setCustomId(`permroles:roles:${ownerId}`)
      .setPlaceholder('Select roles to check (lists every role)')
      .setMinValues(1)
      .setMaxValues(25),
  );
}

export function buildPermissionRolesComponents(
  ownerId: string,
  permPage: number,
  selectedKey: string | undefined,
  fromApi: boolean,
): ActionRowBuilder<StringSelectMenuBuilder | RoleSelectMenuBuilder>[] {
  const rows: ActionRowBuilder<StringSelectMenuBuilder | RoleSelectMenuBuilder>[] = [
    buildPermissionSelectRow(ownerId, permPage, selectedKey),
  ];
  if (!fromApi) {
    rows.push(buildPermissionRoleScanRow(ownerId));
  }
  return rows;
}

export function buildPermissionRolesEmbed(
  perm: PermissionChoice,
  roles: RoleLike[],
  guildName: string,
  opts?: { scannedCount?: number; fromApi?: boolean },
): EmbedBuilder {
  const matching = roles.filter((r) => roleHasPermission(r, perm));
  const list = matching.length
    ? matching
        .sort((a, b) => b.position - a.position)
        .map((r, i) => `**${i + 1}.** <@&${r.id}> — \`${r.id}\``)
        .join('\n')
    : '_No roles have this permission._';

  const desc = list.length > 3900 ? `${list.slice(0, 3900)}\n… _(truncated)_` : list;
  const scanned = opts?.scannedCount ?? roles.length;
  const footerExtra = opts?.fromApi
    ? `${guildName} · ${matching.length} role${matching.length === 1 ? '' : 's'}`
    : `${guildName} · ${matching.length} match · ${scanned} role${scanned === 1 ? '' : 's'} checked`;

  return new EmbedBuilder()
    .setColor(Colors.success)
    .setTitle(`Roles with ${perm.label}`)
    .setDescription(desc)
    .setFooter({
      text: `${footerExtra} · Use the dropdown to switch`,
    })
    .setTimestamp();
}

export function buildPermissionRolesText(
  perm: PermissionChoice,
  roles: RoleLike[],
  guildName: string,
  opts?: { scannedCount?: number; fromApi?: boolean },
): string {
  const matching = roles
    .filter((r) => roleHasPermission(r, perm))
    .sort((a, b) => b.position - a.position);

  const body = matching.length
    ? matching.map((r, i) => `${i + 1}. <@&${r.id}> — \`${r.id}\``).join('\n')
    : '(no roles have this permission)';

  const scanned = opts?.scannedCount ?? roles.length;
  const countLine = opts?.fromApi
    ? `${matching.length} role${matching.length === 1 ? '' : 's'}`
    : `${matching.length} match · ${scanned} role${scanned === 1 ? '' : 's'} checked`;

  let text = [
    `**Roles with ${perm.label}**`,
    `Server: ${guildName}`,
    countLine,
    '',
    body,
    '',
    opts?.fromApi
      ? '_Use the dropdown to switch permission._'
      : '_Select more roles below to check them. Discord lists every role._',
  ].join('\n');

  if (text.length > 1900) {
    text = `${text.slice(0, 1900)}\n… _(truncated)_`;
  }
  return text;
}

export function buildPermissionPromptText(
  guildName: string,
  fromApi: boolean,
  permissionLabel?: string,
): string {
  if (!permissionLabel) {
    return [
      `**Permission → roles**`,
      `Server: ${guildName}`,
      '',
      'Pick a permission from the dropdown.',
      fromApi
        ? null
        : 'Then select roles from the second dropdown — Discord lists every role in this server.',
    ]
      .filter(Boolean)
      .join('\n');
  }

  if (fromApi) {
    return [
      `**Roles with ${permissionLabel}**`,
      `Server: ${guildName}`,
      '',
      'Loading…',
    ].join('\n');
  }

  return [
    `**Roles with ${permissionLabel}**`,
    `Server: ${guildName}`,
    '',
    'Select roles from the dropdown below — Discord lists **every role**.',
    'Matching roles will show here. Select up to 25 at a time; repeat to check more.',
  ].join('\n');
}

export function rememberPermissionRolesView(
  messageId: string,
  view: PendingPermissionRolesView,
): void {
  pendingPermissionRolesViews.set(messageId, view);
  setTimeout(() => pendingPermissionRolesViews.delete(messageId), 15 * 60_000);
}

export async function loadRolesForPermissionCheck(
  interaction: ChatInputCommandInteraction | import('discord.js').MessageComponentInteraction,
): Promise<{ roles: RoleLike[]; guildName: string; fromApi: boolean }> {
  const guildName =
    interaction.guild?.name ??
    interaction.client.guilds.cache.get(interaction.guildId ?? '')?.name ??
    'this server';

  const roles = await fetchGuildRolesApi(interaction);
  if (roles?.length) {
    return { roles, guildName, fromApi: true };
  }

  return { roles: [], guildName, fromApi: false };
}

export function mergeRoleLikes(existing: RoleLike[], incoming: RoleLike[]): RoleLike[] {
  const byId = new Map(existing.map((r) => [r.id, r]));
  for (const role of incoming) {
    byId.set(role.id, role);
  }
  return [...byId.values()].sort((a, b) => b.position - a.position);
}

export { wantsPlainRoleReply };
