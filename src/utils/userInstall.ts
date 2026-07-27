import {
  ApplicationIntegrationType,
  Guild,
  InteractionContextType,
  PermissionsBitField,
  Routes,
  type ChatInputCommandInteraction,
  type PermissionResolvable,
} from 'discord.js';

/** Mark slash commands that should be available as a user-installed app. */
export function withUserInstall<T extends { setIntegrationTypes: Function; setContexts: Function }>(
  builder: T,
): T {
  return builder
    .setIntegrationTypes(ApplicationIntegrationType.GuildInstall, ApplicationIntegrationType.UserInstall)
    .setContexts(InteractionContextType.Guild) as T;
}

export function isUserInstallInteraction(interaction: ChatInputCommandInteraction): boolean {
  const owners = interaction.authorizingIntegrationOwners;
  if (!owners) return false;
  return (
    Object.prototype.hasOwnProperty.call(owners, String(ApplicationIntegrationType.UserInstall)) ||
    Object.prototype.hasOwnProperty.call(owners, ApplicationIntegrationType.UserInstall)
  );
}

/**
 * Resolve a usable guild (with roles) for user-install / guild-install interactions.
 * Returns null when the bot has no access to that server's role list.
 */
export async function resolveGuildForRoles(
  interaction: ChatInputCommandInteraction,
): Promise<Guild | null> {
  if (!interaction.guildId) return null;

  const cached = interaction.client.guilds.cache.get(interaction.guildId);
  if (cached) {
    if (cached.roles.cache.size <= 1) {
      await cached.roles.fetch().catch(() => undefined);
    }
    return cached;
  }

  try {
    const fetched = await interaction.client.guilds.fetch(interaction.guildId);
    await fetched.roles.fetch().catch(() => undefined);
    return fetched;
  } catch {
    /* bot not in guild */
  }

  if (interaction.guild) {
    await interaction.guild.roles.fetch().catch(() => undefined);
    if (interaction.guild.roles.cache.size > 0) return interaction.guild;
  }

  try {
    await interaction.client.rest.get(Routes.guildRoles(interaction.guildId));
  } catch {
    /* no access */
  }

  return null;
}

export function formatRolePermissions(permissions: PermissionResolvable): string {
  const bits = new PermissionsBitField(permissions);
  if (bits.has(PermissionsBitField.Flags.Administrator)) {
    return '**Administrator** (all permissions)';
  }
  const list = bits.toArray();
  if (!list.length) return '_No permissions_';
  return list.map((p) => `\`${p}\``).join(', ');
}
