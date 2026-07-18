import { EmbedBuilder, User } from 'discord.js';
import { blackBolt, bolt } from './emojis.js';

/** Embed sidebar colors */
export const Colors = {
  /** Successful command replies */
  success: 0xffffff,
  /** Failed / invalid command replies */
  error: 0x000000,
  warning: 0xfaa81a,
  log: 0x2b2d31,
  primary: 0xffffff,
  info: 0xffffff,
} as const;

function mentionOf(user: User | string): string {
  return typeof user === 'string' ? user : `<@${user.id}>`;
}

/** Bleed-style success */
export function ok(user: User | string, message: string): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(Colors.success)
    .setDescription(`${bolt()} ${mentionOf(user)}: ${message}`);
}

/** Bleed-style error */
export function fail(user: User | string, message: string): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(Colors.error)
    .setDescription(`${blackBolt()} ${mentionOf(user)}: ${message}`);
}

/** @deprecated use ok() — kept so old call sites still look Bleed-like */
export function successEmbed(description: string, _title?: string): EmbedBuilder {
  return new EmbedBuilder().setColor(Colors.success).setDescription(`${bolt()} ${description}`);
}

export function errorEmbed(description: string, _title?: string): EmbedBuilder {
  return new EmbedBuilder().setColor(Colors.error).setDescription(`${blackBolt()} ${description}`);
}

export function infoEmbed(description: string, title?: string): EmbedBuilder {
  const embed = new EmbedBuilder().setColor(Colors.log).setDescription(description);
  if (title) embed.setAuthor({ name: title });
  return embed;
}

/** Compact log embed like Bleed's "Message Deleted" logs */
export function caseLog(opts: {
  title: string;
  description: string;
  content?: string;
  contentLabel?: string;
  footer?: string;
  iconURL?: string | null;
  color?: number;
}): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setColor(opts.color ?? Colors.log)
    .setAuthor({ name: opts.title, iconURL: opts.iconURL ?? undefined })
    .setDescription(opts.description)
    .setTimestamp();

  if (opts.content) {
    embed.addFields({
      name: opts.contentLabel ?? 'Content',
      value: opts.content.slice(0, 1024) || '*empty*',
    });
  }
  if (opts.footer) embed.setFooter({ text: opts.footer });
  return embed;
}
