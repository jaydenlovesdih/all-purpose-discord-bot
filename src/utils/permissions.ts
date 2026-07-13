import { ChatInputCommandInteraction, GuildMember, PermissionResolvable } from 'discord.js';
import { config } from '../config.js';
import { PrefixCommandInteraction } from './prefixInteraction.js';

type CommandInteractionLike = ChatInputCommandInteraction | PrefixCommandInteraction;

export function isOwner(userId: string): boolean {
  return userId === config.ownerId;
}

export function canBypass(userId: string): boolean {
  return isOwner(userId);
}

function getMember(interaction: CommandInteractionLike): GuildMember | null {
  if (interaction.member instanceof GuildMember) {
    return interaction.member;
  }
  return null;
}

export function hasPermissions(
  member: GuildMember | null,
  permissions: PermissionResolvable[],
  userId: string,
): boolean {
  if (canBypass(userId)) return true;
  if (!member) return false;
  return member.permissions.has(permissions);
}

export async function ensurePermissions(
  interaction: CommandInteractionLike,
  permissions: PermissionResolvable[],
): Promise<boolean> {
  if (canBypass(interaction.user.id)) return true;

  const member = getMember(interaction);
  if (!member?.permissions.has(permissions)) {
    await interaction.reply({
      content: 'You do not have permission to use this command.',
      ephemeral: interaction instanceof ChatInputCommandInteraction,
    });
    return false;
  }

  return true;
}

export async function ensureOwner(interaction: CommandInteractionLike): Promise<boolean> {
  if (isOwner(interaction.user.id)) return true;

  await interaction.reply({
    content: 'This command is restricted to the bot owner.',
    ephemeral: interaction instanceof ChatInputCommandInteraction,
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
