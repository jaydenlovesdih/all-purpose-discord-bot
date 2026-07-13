import { EmbedBuilder, User } from 'discord.js';

/** Bleed/Greed visual system */
export const Colors = {
  /** Soft success green used by Bleed embeds */
  success: 0xa3d977,
  error: 0xed4245,
  warning: 0xfaa81a,
  /** Neutral dark for case/event logs */
  log: 0x2b2d31,
  primary: 0x2b2d31,
  info: 0x2b2d31,
} as const;

function mentionOf(user: User | string): string {
  return typeof user === 'string' ? user : `<@${user.id}>`;
}

/** Bleed-style success: green bar + ✅ @user: message (no title) */
export function ok(user: User | string, message: string): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(Colors.success)
    .setDescription(`✅ ${mentionOf(user)}: ${message}`);
}

/** Bleed-style error */
export function fail(user: User | string, message: string): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(Colors.error)
    .setDescription(`❌ ${mentionOf(user)}: ${message}`);
}

/** @deprecated use ok() — kept so old call sites still look Bleed-like */
export function successEmbed(description: string, _title?: string): EmbedBuilder {
  return new EmbedBuilder().setColor(Colors.success).setDescription(`✅ ${description}`);
}

export function errorEmbed(description: string, _title?: string): EmbedBuilder {
  return new EmbedBuilder().setColor(Colors.error).setDescription(`❌ ${description}`);
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
