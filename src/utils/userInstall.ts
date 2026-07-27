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

/** Fetch all guild roles via REST (works when the bot is a member). */
export async function fetchGuildRolesApi(source: {
  client: ChatInputCommandInteraction['client'];
  guildId: string | null;
}): Promise<RoleLike[] | null> {
  if (!source.guildId) return null;

  const cached = source.client.guilds.cache.get(source.guildId);
  if (cached) {
    if (cached.roles.cache.size <= 1) {
      await cached.roles.fetch().catch(() => undefined);
    }
    return [...cached.roles.cache.values()]
      .filter((r) => r.id !== cached.id)
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

  try {
    const raw = (await source.client.rest.get(Routes.guildRoles(source.guildId))) as APIRole[];
    return raw
      .filter((r) => r.id !== source.guildId)
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
    return null;
  }
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
  opts?: { dangerousOnly?: boolean },
): string {
  const names = formatPermissionNames(permissions, opts);
  if (!names.length) {
    return opts?.dangerousOnly ? '_No dangerous permissions_' : '_No permissions_';
  }
  return names.map((p) => `• ${p}`).join('\n');
}

export type RolePermViewMode = 'all' | 'danger';

export interface PendingRolePermView {
  ownerId: string;
  role: RoleLike;
  guildName?: string | null;
  plain: boolean;
  mode: RolePermViewMode;
}

export const pendingRolePermViews = new Map<string, PendingRolePermView>();

export function buildRoleInfoEmbed(
  role: RoleLike,
  guildName?: string | null,
  mode: RolePermViewMode = 'all',
): EmbedBuilder {
  const dangerousOnly = mode === 'danger';
  const color = role.color || Colors.success;
  return new EmbedBuilder()
    .setColor(color)
    .setTitle(`Permissions — ${role.name}`)
    .setDescription(formatRolePermissions(role.permissions, { dangerousOnly }))
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
  mode: RolePermViewMode = 'all',
): string {
  const dangerousOnly = mode === 'danger';
  const perms = formatPermissionNames(role.permissions, { dangerousOnly });
  const permBlock = perms.length
    ? perms.map((p) => `• ${p}`).join('\n')
    : dangerousOnly
      ? '• (none dangerous)'
      : '• (none)';

  const lines = [
    `**${role.name}**`,
    guildName ? `Server: ${guildName}` : null,
    `Role: <@&${role.id}>`,
    `ID: \`${role.id}\``,
    `Position: ${role.position} · Hoisted: ${role.hoist ? 'yes' : 'no'} · Mentionable: ${role.mentionable ? 'yes' : 'no'} · Managed: ${role.managed ? 'yes' : 'no'}`,
    '',
    dangerousOnly ? '**Dangerous permissions**' : '**Permissions**',
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

export function rememberRolePermView(messageId: string, view: PendingRolePermView): void {
  pendingRolePermViews.set(messageId, view);
  setTimeout(() => pendingRolePermViews.delete(messageId), 15 * 60_000);
}

export function buildRoleBrowseRow(ownerId: string): ActionRowBuilder<RoleSelectMenuBuilder> {
  return new ActionRowBuilder<RoleSelectMenuBuilder>().addComponents(
    new RoleSelectMenuBuilder()
      .setCustomId(`roles:pick:${ownerId}`)
      .setPlaceholder('Pick a role to view')
      .setMinValues(1)
      .setMaxValues(1),
  );
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
    '_Use the dropdown to inspect a role._',
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
