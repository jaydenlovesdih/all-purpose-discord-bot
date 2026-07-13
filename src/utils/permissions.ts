import { ChatInputCommandInteraction, GuildMember, PermissionResolvable } from 'discord.js';
import { config } from '../config.js';
import { BotClient } from '../types/index.js';

export function isOwner(userId: string): boolean {
  return userId === config.ownerId;
}

export function canBypass(userId: string): boolean {
  return isOwner(userId);
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
  interaction: ChatInputCommandInteraction,
  permissions: PermissionResolvable[],
): Promise<boolean> {
  if (canBypass(interaction.user.id)) return true;

  const member = interaction.member as GuildMember | null;
  if (!member?.permissions.has(permissions)) {
    await interaction.reply({
      content: 'You do not have permission to use this command.',
      ephemeral: true,
    });
    return false;
  }

  return true;
}

export async function ensureOwner(interaction: ChatInputCommandInteraction): Promise<boolean> {
  if (isOwner(interaction.user.id)) return true;

  await interaction.reply({
    content: 'This command is restricted to the bot owner.',
    ephemeral: true,
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

export function getClient(client: BotClient): BotClient {
  return client;
}
