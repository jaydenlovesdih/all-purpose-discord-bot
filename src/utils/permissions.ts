import {
  GuildMember,
  PermissionFlagsBits,
  PermissionResolvable,
  PermissionsBitField,
} from 'discord.js';
import { config } from '../config.js';
import { getGuildConfig, memberHasFakePermission } from './guildConfig.js';
import { PrefixCommandInteraction } from './prefixInteraction.js';
import { fail } from './embeds.js';
import type { ChatInputCommandInteraction } from 'discord.js';
type CommandInteractionLike = ChatInputCommandInteraction | PrefixCommandInteraction;

export function isOwner(userId: string): boolean {
  return userId === config.ownerId;
}

export function canBypass(userId: string): boolean {
  return isOwner(userId);
}

async function resolveMember(interaction: CommandInteractionLike): Promise<GuildMember | null> {
  if (interaction.member instanceof GuildMember) return interaction.member;
  if (!interaction.guild) return null;
  try {
    return await interaction.guild.members.fetch(interaction.user.id);
  } catch {
    return null;
  }
}

export function hasPermissions(
  member: GuildMember | null,
  permissions: PermissionResolvable[],
  userId: string,
): boolean {
  if (canBypass(userId)) return true;
  if (!member) return false;
  if (member.permissions.has(permissions)) return true;

  const bits = new PermissionsBitField(permissions);
  return memberHasFakePermission(
    member.guild.id,
    [...member.roles.cache.keys()],
    bits.bitfield,
  );
}

export async function ensurePermissions(
  interaction: CommandInteractionLike,
  permissions: PermissionResolvable[],
): Promise<boolean> {
  if (canBypass(interaction.user.id)) return true;

  const member = await resolveMember(interaction);
  if (!hasPermissions(member, permissions, interaction.user.id)) {
    await interaction.reply({
      embeds: [fail(interaction.user, 'You do not have permission to use this command')],
      ephemeral: !(interaction instanceof PrefixCommandInteraction),
    });
    return false;
  }

  return true;
}

export async function ensureOwner(interaction: CommandInteractionLike): Promise<boolean> {
  if (isOwner(interaction.user.id)) return true;

  await interaction.reply({
    embeds: [fail(interaction.user, 'This command is restricted to the bot owner')],
    ephemeral: !(interaction instanceof PrefixCommandInteraction),
  });
  return false;
}

export function formatUptime(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  const parts: string[] = [];
  if (days) parts.push(`${days}d`);
  if (hours) parts.push(`${hours}h`);
  if (minutes) parts.push(`${minutes}m`);
  parts.push(`${secs}s`);
  return parts.join(' ');
}

export function truncate(text: string, max = 1000): string {
  return text.length > max ? `${text.slice(0, max - 3)}...` : text;
}

export { PermissionFlagsBits };
