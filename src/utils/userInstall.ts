import {
  ActionRowBuilder,
  ApplicationIntegrationType,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  Guild,
  InteractionContextType,
  PermissionsBitField,
  RoleSelectMenuBuilder,
  Routes,
  type APIRole,
  type ChatInputCommandInteraction,
  type PermissionResolvable,
  type Role,
} from 'discord.js';
import { Colors } from './embeds.js';
import { resolveRole } from './resolveRole.js';

export type RoleLike = Pick<
  APIRole,
  'id' | 'name' | 'permissions' | 'position' | 'color' | 'hoist' | 'managed' | 'mentionable'
> & { hexColor?: string };

/** Mark slash commands that should be available as a user-installed app. */
export function withUserInstall<T extends { setIntegrationTypes: Function; setContexts: Function }>(
  builder: T,
): T {
  return builder
    .setIntegrationTypes(ApplicationIntegrationType.GuildInstall, ApplicationIntegrationType.UserInstall)
    .setContexts(InteractionContextType.Guild) as T;
}

export function isUserInstallInteraction(
  interaction: ChatInputCommandInteraction | import('discord.js').MessageComponentInteraction,
): boolean {
  const owners = interaction.authorizingIntegrationOwners;
  if (!owners) return false;
  return (
    Object.prototype.hasOwnProperty.call(owners, String(ApplicationIntegrationType.UserInstall)) ||
    Object.prototype.hasOwnProperty.call(owners, ApplicationIntegrationType.UserInstall)
  );
}

/** True when this interaction came from Add to My Apps (user install), not guild bot install / prefix. */
export function wantsPlainRoleReply(
  interaction: ChatInputCommandInteraction | import('discord.js').MessageComponentInteraction,
): boolean {
  if ('commandMessage' in interaction) return false;
  return isUserInstallInteraction(interaction);
}

function mapApiRoles(raw: APIRole[], guildId: string): RoleLike[] {
  return raw
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
}

/** Fetch all guild roles via REST (works when the bot is a member). */
export async function fetchGuildRolesApi(
  source:
    | {
        client: ChatInputCommandInteraction['client'];
        guildId: string | null;
        guild?: Guild | null;
      }
    | ChatInputCommandInteraction
    | import('discord.js').MessageComponentInteraction,
): Promise<RoleLike[] | null> {
  const client = source.client;
  const guildId = source.guildId;
  if (!guildId) return null;

  const interactionGuild = 'guild' in source ? source.guild : null;

  if (interactionGuild && interactionGuild.roles.cache.size > 1) {
    return [...interactionGuild.roles.cache.values()]
      .filter((r) => r.id !== interactionGuild.id)
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

  // Prefer REST so user-install interactions still get a full list when the bot is in the guild
  try {
    const raw = (await client.rest.get(Routes.guildRoles(guildId))) as APIRole[];
    return mapApiRoles(raw, guildId);
  } catch {
    // fall through to cache / fetch
  }

  let cached = client.guilds.cache.get(guildId) ?? interactionGuild ?? null;
  if (!cached) {
    cached = (await client.guilds.fetch(guildId).catch(() => null)) ?? null;
  }
  if (cached) {
    if (cached.roles.cache.size <= 1) {
      await cached.roles.fetch().catch(() => undefined);
    }
    return [...cached.roles.cache.values()]
      .filter((r) => r.id !== cached!.id)
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

  return null;
}

/**
 * Resolve a role for user-install OR guild-install:
 * 1) Discord Role option / resolved data (works even if bot is NOT in the server)
 * 2) String mention / ID / fuzzy name when we can load the role list
 */
export async function resolveRoleFromInteraction(
  interaction: ChatInputCommandInteraction,
): Promise<RoleLike | null> {
  const fromOption = interaction.options.getRole('role', false);
  if (fromOption) {
    return {
      id: fromOption.id,
      name: fromOption.name,
      permissions:
        typeof fromOption.permissions === 'object' && fromOption.permissions != null && 'bitfield' in fromOption.permissions
          ? (fromOption.permissions as PermissionsBitField).bitfield.toString()
          : String((fromOption as APIRole).permissions ?? '0'),
      position: fromOption.position,
      color: fromOption.color,
      hoist: fromOption.hoist,
      managed: fromOption.managed,
      mentionable: fromOption.mentionable,
      hexColor: 'hexColor' in fromOption ? (fromOption as Role).hexColor : undefined,
    };
  }

  const input = interaction.options.getString('query', false) ?? interaction.options.getString('role', false);
  if (!input) return null;

  // Prefer guild cache / fuzzy when bot is in the server
  const guild =
    interaction.client.guilds.cache.get(interaction.guildId ?? '') ??
    (interaction.guildId
      ? await interaction.client.guilds.fetch(interaction.guildId).catch(() => null)
      : null);

  if (guild) {
    if (guild.roles.cache.size <= 1) await guild.roles.fetch().catch(() => undefined);
    const hit = resolveRole(guild, input);
    if (hit) {
      return {
        id: hit.id,
        name: hit.name,
        permissions: hit.permissions.bitfield.toString(),
        position: hit.position,
        color: hit.color,
        hoist: hit.hoist,
        managed: hit.managed,
        mentionable: hit.mentionable,
        hexColor: hit.hexColor,
      };
    }
  }

  // ID-only: try REST single-role / full list fetch (needs bot membership)
  const idMatch = input.match(/^<@&(\d+)>$|^(\d{17,20})$/);
  if (idMatch && interaction.guildId) {
    const id = idMatch[1] ?? idMatch[2];
    const list = await fetchGuildRolesApi(interaction);
    const hit = list?.find((r) => r.id === id);
    if (hit) return hit;
  }

  // Fuzzy against REST role list when available
  const list = await fetchGuildRolesApi(interaction);
  if (list?.length) {
    const q = input.toLowerCase();
    const exact = list.find((r) => r.name.toLowerCase() === q);
    if (exact) return exact;
    const starts = list.filter((r) => r.name.toLowerCase().startsWith(q));
    if (starts.length) return starts.sort((a, b) => a.name.length - b.name.length)[0];
    const includes = list.filter((r) => r.name.toLowerCase().includes(q));
    if (includes.length) return includes[0];
  }

  return null;
}

/** High-impact permissions worth reviewing first */
const DANGEROUS_PERMISSION_FLAGS = new Set<string>([
  'Administrator',
  'BanMembers',
  'KickMembers',
  'ManageGuild',
  'ManageRoles',
  'ManageChannels',
  'ManageWebhooks',
  'ManageMessages',
  'ManageNicknames',
  'ManageGuildExpressions',
  'ManageEvents',
  'ManageThreads',
  'ModerateMembers',
  'MentionEveryone',
  'ViewAuditLog',
  'MuteMembers',
  'DeafenMembers',
  'MoveMembers',
]);

export function formatPermissionNames(
  permissions: PermissionResolvable | string,
  opts?: { dangerousOnly?: boolean },
): string[] {
  const bits = new PermissionsBitField(
    typeof permissions === 'string' ? BigInt(permissions) : permissions,
  );
  if (bits.has(PermissionsBitField.Flags.Administrator)) {
    return ['Administrator (all permissions)'];
  }

  let flags = bits.toArray();
  if (opts?.dangerousOnly) {
    flags = flags.filter((f) => DANGEROUS_PERMISSION_FLAGS.has(f));
  }

  return flags
    .map((p) => p.replace(/([a-z])([A-Z])/g, '$1 $2'))
    .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
}

export function formatRolePermissions(
  permissions: PermissionResolvable | string,
  opts?: { dangerousOnly?: boolean; small?: boolean },
): string {
  const names = formatPermissionNames(permissions, opts);
  if (!names.length) {
    const empty = opts?.dangerousOnly ? '• (none dangerous)' : '• (none)';
    return opts?.small ? `-# ${empty}` : empty;
  }
  return names
    .map((p) => {
      const line = `• ${p}`;
      // Discord subtext — used for the full permission dump so it stays scannable
      return opts?.small ? `-# ${line}` : line;
    })
    .join('\n');
}

export type RolePermViewMode = 'all' | 'danger';

export interface PendingRolePermView {
  ownerId: string;
  /** Null until the user picks a role from the dropdown. */
  role: RoleLike | null;
  guildName?: string | null;
  plain: boolean;
  mode: RolePermViewMode;
}

export const pendingRolePermViews = new Map<string, PendingRolePermView>();

export function buildRoleInfoEmbed(
  role: RoleLike,
  guildName?: string | null,
  mode: RolePermViewMode = 'danger',
): EmbedBuilder {
  const dangerousOnly = mode === 'danger';
  const color = role.color || Colors.success;
  return new EmbedBuilder()
    .setColor(color)
    .setTitle(`Permissions — ${role.name}`)
    .setDescription(
      formatRolePermissions(role.permissions, {
        dangerousOnly,
        small: !dangerousOnly,
      }),
    )
    .addFields(
      { name: 'Role', value: `<@&${role.id}>`, inline: true },
      { name: 'ID', value: `\`${role.id}\``, inline: true },
      { name: 'Position', value: String(role.position), inline: true },
      { name: 'Hoisted', value: role.hoist ? 'Yes' : 'No', inline: true },
      { name: 'Mentionable', value: role.mentionable ? 'Yes' : 'No', inline: true },
      { name: 'Managed', value: role.managed ? 'Yes (integration)' : 'No', inline: true },
    )
    .setFooter({
      text: `${guildName || 'Server roles'} · ${dangerousOnly ? 'Dangerous only' : 'All permissions'}`,
    })
    .setTimestamp();
}

/** Plain-text role info for user-install (My Apps) replies — no embed. */
export function buildRoleInfoText(
  role: RoleLike,
  guildName?: string | null,
  mode: RolePermViewMode = 'danger',
): string {
  const dangerousOnly = mode === 'danger';
  const permBlock = formatRolePermissions(role.permissions, {
    dangerousOnly,
    small: !dangerousOnly,
  });

  const lines = [
    `**${role.name}**`,
    guildName ? `Server: ${guildName}` : null,
    `Role: <@&${role.id}>`,
    `ID: \`${role.id}\``,
    `Position: ${role.position} · Hoisted: ${role.hoist ? 'yes' : 'no'} · Mentionable: ${role.mentionable ? 'yes' : 'no'} · Managed: ${role.managed ? 'yes' : 'no'}`,
    '',
    dangerousOnly ? '**Dangerous permissions**' : '**All permissions**',
    permBlock,
  ].filter((l) => l !== null) as string[];

  let text = lines.join('\n');
  if (text.length > 1900) {
    text = `${text.slice(0, 1900)}\n… _(truncated)_`;
  }
  return text;
}

export function buildRolePermFilterRow(
  ownerId: string,
  mode: RolePermViewMode,
): ActionRowBuilder<ButtonBuilder> {
  const showingDanger = mode === 'danger';
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`roleperms:view:${showingDanger ? 'all' : 'danger'}:${ownerId}`)
      .setLabel(showingDanger ? 'Show all permissions' : 'Show dangerous only')
      .setStyle(showingDanger ? ButtonStyle.Secondary : ButtonStyle.Danger),
  );
}

export function buildRolePermChangeRow(
  ownerId: string,
  placeholder = 'Change role…',
): ActionRowBuilder<RoleSelectMenuBuilder> {
  return new ActionRowBuilder<RoleSelectMenuBuilder>().addComponents(
    new RoleSelectMenuBuilder()
      .setCustomId(`roleperms:pick:${ownerId}`)
      .setPlaceholder(placeholder)
      .setMinValues(1)
      .setMaxValues(1),
  );
}

export function buildRolePermComponents(
  ownerId: string,
  mode: RolePermViewMode,
  opts?: { includeFilter?: boolean; pickPlaceholder?: string },
): ActionRowBuilder<ButtonBuilder | RoleSelectMenuBuilder>[] {
  const rows: ActionRowBuilder<ButtonBuilder | RoleSelectMenuBuilder>[] = [
    buildRolePermChangeRow(ownerId, opts?.pickPlaceholder),
  ];
  if (opts?.includeFilter !== false) {
    rows.push(buildRolePermFilterRow(ownerId, mode));
  }
  return rows;
}

export function roleLikeFromSelect(
  selected: import('discord.js').Role | import('discord.js').APIRole,
): RoleLike {
  return {
    id: selected.id,
    name: selected.name,
    permissions:
      typeof selected.permissions === 'object' &&
      selected.permissions &&
      'bitfield' in selected.permissions
        ? (selected.permissions as import('discord.js').PermissionsBitField).bitfield.toString()
        : String((selected as { permissions?: string }).permissions ?? '0'),
    position: selected.position,
    color: selected.color,
    hoist: selected.hoist,
    managed: selected.managed,
    mentionable: selected.mentionable,
  };
}

export function rememberRolePermView(messageId: string, view: PendingRolePermView): void {
  pendingRolePermViews.set(messageId, view);
  setTimeout(() => pendingRolePermViews.delete(messageId), 15 * 60_000);
}

export interface PendingRolesBrowseView {
  ownerId: string;
  plain: boolean;
  guildName: string;
  /** Roles collected via Role Select when the bot cannot GET /guilds/:id/roles */
  collected: RoleLike[];
  /** True when the list came from REST / guild cache (full server list) */
  fromApi: boolean;
  page: number;
}

export const pendingRolesBrowseViews = new Map<string, PendingRolesBrowseView>();

export function rememberRolesBrowseView(messageId: string, view: PendingRolesBrowseView): void {
  pendingRolesBrowseViews.set(messageId, view);
  setTimeout(() => pendingRolesBrowseViews.delete(messageId), 15 * 60_000);
}

/** Single-select: inspect one role. Multi-select: pin up to 25 roles into the list. */
export function buildRoleBrowseRow(
  ownerId: string,
  opts?: { multi?: boolean },
): ActionRowBuilder<RoleSelectMenuBuilder> {
  const multi = opts?.multi ?? false;
  return new ActionRowBuilder<RoleSelectMenuBuilder>().addComponents(
    new RoleSelectMenuBuilder()
      .setCustomId(multi ? `roles:list:${ownerId}` : `roles:pick:${ownerId}`)
      .setPlaceholder(multi ? 'Choose roles from the server list…' : 'Pick a role to inspect')
      .setMinValues(1)
      .setMaxValues(multi ? 25 : 1),
  );
}

export function buildRolesPageComponents(
  page: number,
  totalPages: number,
  ownerId: string,
  opts?: { loadMore?: boolean; inspect?: boolean },
): ActionRowBuilder<ButtonBuilder | RoleSelectMenuBuilder>[] {
  const rows: ActionRowBuilder<ButtonBuilder | RoleSelectMenuBuilder>[] = [
    buildRolesNavButtons(page, totalPages, ownerId),
  ];
  if (opts?.loadMore) {
    rows.push(buildRoleBrowseRow(ownerId, { multi: true }));
  }
  if (opts?.inspect !== false) {
    rows.push(buildRoleBrowseRow(ownerId));
  }
  return rows;
}

export function buildRolesBootstrapText(guildName: string): string {
  return [
    `**Roles — ${guildName}**`,
    '',
    'Use the menu below — Discord lists **every role** in this server.',
    'Pick up to **25** at a time; they load into the paginated list (10 per page, Next/Prev).',
    'Repeat if the server has more than 25 roles.',
  ].join('\n');
}

export function buildRolesBrowseActions(ownerId: string): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`roles:clear:${ownerId}`)
      .setLabel('Clear list')
      .setStyle(ButtonStyle.Secondary),
  );
}

export function buildCollectedRolesText(
  roles: RoleLike[],
  guildName: string,
): { content: string } {
  if (roles.length === 0) {
    return {
      content: [
        `**Roles — ${guildName}**`,
        '',
        'Open the menu below — Discord lists **every role** in this server.',
        'Select up to **25 roles** per pick; repeat until all roles appear here.',
        '',
        '_Or invite the bot to this server for an instant full list._',
      ].join('\n'),
    };
  }

  const sorted = [...roles].sort((a, b) => b.position - a.position);
  const chunks = buildFullRolesPlainChunks(sorted, guildName);
  let content = chunks[0];
  if (chunks.length > 1) {
    content += `\n\n_${sorted.length} roles total — list truncated here. Invite the bot for one-shot full list._`;
  }
  content += '\n\n_Select more roles above if any are missing (25 per pick)._';

  return { content: content.length > 2000 ? `${content.slice(0, 1990)}…` : content };
}

export function buildRolesListEmbed(
  roles: RoleLike[],
  guildName: string,
  page: number,
  guildIcon?: string | null,
): { embed: EmbedBuilder; page: number; totalPages: number } {
  const ROLES_PER_PAGE = 10;
  const totalPages = Math.max(1, Math.ceil(roles.length / ROLES_PER_PAGE));
  const safePage = Math.min(Math.max(0, page), totalPages - 1);
  const slice = roles.slice(safePage * ROLES_PER_PAGE, safePage * ROLES_PER_PAGE + ROLES_PER_PAGE);

  const list = slice.length
    ? slice
        .map((role, i) => {
          const n = safePage * ROLES_PER_PAGE + i + 1;
          const hex =
            role.hexColor ??
            (role.color ? `#${role.color.toString(16).padStart(6, '0')}` : 'default');
          return `**${n}.** <@&${role.id}> — \`${role.id}\`\n┗ ${hex}`;
        })
        .join('\n')
    : '_No roles._';

  const embed = new EmbedBuilder()
    .setColor(Colors.success)
    .setTitle(`Roles — ${guildName}`)
    .setDescription(list)
    .setThumbnail(guildIcon ?? null)
    .setFooter({
      text: `Page ${safePage + 1} of ${totalPages} • Total: ${roles.length} roles`,
    })
    .setTimestamp();

  return { embed, page: safePage, totalPages };
}

/** Plain-text roles list for user-install (My Apps). */
export function buildRolesListText(
  roles: RoleLike[],
  guildName: string,
  page: number,
): { content: string; page: number; totalPages: number } {
  const ROLES_PER_PAGE = 10;
  const totalPages = Math.max(1, Math.ceil(roles.length / ROLES_PER_PAGE));
  const safePage = Math.min(Math.max(0, page), totalPages - 1);
  const slice = roles.slice(safePage * ROLES_PER_PAGE, safePage * ROLES_PER_PAGE + ROLES_PER_PAGE);

  const body = slice.length
    ? slice
        .map((role, i) => {
          const n = safePage * ROLES_PER_PAGE + i + 1;
          return `${n}. <@&${role.id}> — \`${role.id}\``;
        })
        .join('\n')
    : '(no roles)';

  const content = [
    `**Roles — ${guildName}**`,
    `Page ${safePage + 1}/${totalPages} · ${roles.length} total`,
    '',
    body,
    '',
    '_Use Next / Prev to browse roles._',
  ].join('\n');

  return { content, page: safePage, totalPages };
}

export function buildRolesNavButtons(
  page: number,
  totalPages: number,
  ownerId: string,
): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`roles:page:prev:${page}:${ownerId}`)
      .setLabel('Prev')
      .setEmoji('⬅️')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(page <= 0),
    new ButtonBuilder()
      .setCustomId(`roles:page:next:${page}:${ownerId}`)
      .setLabel('Next')
      .setEmoji('➡️')
      .setStyle(ButtonStyle.Success)
      .setDisabled(page >= totalPages - 1),
  );
}

const ROLES_PER_EMBED = 30;
const MAX_EMBEDS = 10;

function roleLinePlain(role: RoleLike, index: number): string {
  return `${index + 1}. <@&${role.id}> — \`${role.id}\``;
}

function roleLineEmbed(role: RoleLike, index: number): string {
  const hex =
    role.hexColor ?? (role.color ? `#${role.color.toString(16).padStart(6, '0')}` : 'default');
  return `**${index + 1}.** <@&${role.id}> — \`${role.id}\`\n┗ ${hex}`;
}

/** Plain-text chunks for the full role list (user-install / My Apps). */
export function buildFullRolesPlainChunks(roles: RoleLike[], guildName: string): string[] {
  if (!roles.length) {
    return [`**Roles — ${guildName}**\n(no roles)`];
  }

  const header = `**Roles — ${guildName}** · ${roles.length} total\n\n`;
  const chunks: string[] = [];
  let current = header;

  for (let i = 0; i < roles.length; i++) {
    const line = roleLinePlain(roles[i], i);
    if (current.length + line.length + 1 > 1950) {
      chunks.push(current.trimEnd());
      current = '';
    }
    current += `${line}\n`;
  }

  if (current.trim()) chunks.push(current.trimEnd());
  return chunks;
}

/** Embed list for the full role list (guild / prefix). */
export function buildFullRolesEmbeds(
  roles: RoleLike[],
  guildName: string,
  guildIcon?: string | null,
): EmbedBuilder[] {
  if (!roles.length) {
    return [
      new EmbedBuilder()
        .setColor(Colors.success)
        .setTitle(`Roles — ${guildName}`)
        .setDescription('_No roles._')
        .setTimestamp(),
    ];
  }

  const embeds: EmbedBuilder[] = [];
  for (let offset = 0; offset < roles.length && embeds.length < MAX_EMBEDS; offset += ROLES_PER_EMBED) {
    const slice = roles.slice(offset, offset + ROLES_PER_EMBED);
    const body = slice.map((role, i) => roleLineEmbed(role, offset + i)).join('\n');
    const embed = new EmbedBuilder()
      .setColor(Colors.success)
      .setTitle(embeds.length === 0 ? `Roles — ${guildName}` : `Roles — ${guildName} (cont.)`)
      .setDescription(body)
      .setTimestamp();

    if (embeds.length === 0 && guildIcon) {
      embed.setThumbnail(guildIcon);
    }

    embeds.push(embed);
  }

  const shown = Math.min(roles.length, ROLES_PER_EMBED * MAX_EMBEDS);
  if (roles.length > shown) {
    embeds[embeds.length - 1].setFooter({
      text: `Showing ${shown} of ${roles.length} roles`,
    });
  } else {
    embeds[embeds.length - 1].setFooter({
      text: `${roles.length} role${roles.length === 1 ? '' : 's'}`,
    });
  }

  return embeds;
}

/** @deprecated use fetchGuildRolesApi — kept for older call sites */
export async function resolveGuildForRoles(
  interaction: ChatInputCommandInteraction,
): Promise<Guild | null> {
  if (!interaction.guildId) return null;
  const cached = interaction.client.guilds.cache.get(interaction.guildId);
  if (cached) {
    if (cached.roles.cache.size <= 1) await cached.roles.fetch().catch(() => undefined);
    return cached;
  }
  return interaction.client.guilds.fetch(interaction.guildId).catch(() => null);
}
