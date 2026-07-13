import { EmbedBuilder } from 'discord.js';

export const Colors = {
  primary: 0x5865f2,
  success: 0x57f287,
  warning: 0xfee75c,
  error: 0xed4245,
  info: 0xeb459e,
} as const;

export function successEmbed(description: string, title = 'Success'): EmbedBuilder {
  return new EmbedBuilder().setColor(Colors.success).setTitle(title).setDescription(description);
}

export function errorEmbed(description: string, title = 'Error'): EmbedBuilder {
  return new EmbedBuilder().setColor(Colors.error).setTitle(title).setDescription(description);
}

export function infoEmbed(description: string, title = 'Info'): EmbedBuilder {
  return new EmbedBuilder().setColor(Colors.info).setTitle(title).setDescription(description);
}
