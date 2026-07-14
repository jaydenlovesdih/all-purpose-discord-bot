import { EmbedBuilder, Guild, TextChannel, User } from 'discord.js';
import { getGuildConfig, LogChannels } from './guildConfig.js';
import { Colors } from './embeds.js';

export type LogChannelKey = keyof LogChannels;

const ACTION_CHANNEL: Record<string, LogChannelKey> = {
  ban: 'bans',
  softban: 'bans',
  hardban: 'bans',
  unhardban: 'bans',
  unban: 'bans',
  kick: 'bans',
  mute: 'mutes',
  timeout: 'mutes',
  unmute: 'mutes',
  untimeout: 'mutes',
  jail: 'jail',
  unjail: 'jail',
  purge: 'purge',
  strip: 'roles',
  roleadd: 'roles',
  roleremove: 'roles',
};

export function logChannelForAction(action: string): LogChannelKey {
  return ACTION_CHANNEL[action] ?? 'bans';
}

export function resolveLogChannelId(guildId: string, key: LogChannelKey): string | undefined {
  const cfg = getGuildConfig(guildId);
  return cfg.logChannels?.[key] ?? cfg.logging.channelId ?? cfg.modLogChannelId;
}

/** Clean Infinity-style log embed (matches mod command responses) */
export function buildServerLogEmbed(opts: {
  emoji: string;
  title: string;
  description: string;
  moderator?: User | string | { toString(): string } | null;
  reason?: string;
  detail?: { name: string; value: string };
  target?: User | null;
  footer?: string;
  content?: string;
  contentLabel?: string;
}): EmbedBuilder {
  const fields = [
    {
      name: '🛡️ Moderator:',
      value: opts.moderator ? `${opts.moderator}` : 'Unknown',
      inline: true,
    },
    {
      name: '📝 Reason:',
      value: (opts.reason || 'No reason provided').slice(0, 1024),
      inline: true,
    },
  ];

  if (opts.detail) {
    fields.push({
      name: opts.detail.name,
      value: opts.detail.value.slice(0, 1024),
      inline: true,
    });
  }

  const embed = new EmbedBuilder()
    .setColor(Colors.success)
    .setTitle(`${opts.emoji} ${opts.title}`)
    .setDescription(opts.description)
    .addFields(fields)
    .setTimestamp();

  if (opts.target) {
    embed.setThumbnail(opts.target.displayAvatarURL({ size: 256 }));
  }
  if (opts.footer) {
    embed.setFooter({ text: opts.footer });
  }
  if (opts.content) {
    embed.addFields({
      name: opts.contentLabel ?? '📄 Content:',
      value: opts.content.slice(0, 1024) || '*empty*',
      inline: false,
    });
  }

  return embed;
}

export async function sendToLogChannel(
  guild: Guild,
  key: LogChannelKey,
  embed: EmbedBuilder,
): Promise<void> {
  const cfg = getGuildConfig(guild.id);
  if (!cfg.logging.enabled) return;

  const channelId = resolveLogChannelId(guild.id, key);
  if (!channelId) return;

  const channel = guild.channels.cache.get(channelId);
  if (!channel?.isTextBased() || !channel.isSendable()) return;

  await (channel as TextChannel).send({ embeds: [embed] }).catch(() => undefined);
}

/** Event-based logging (joins, channel create, etc.) — falls back to messages/roles/bans mapping */
export async function sendLog(
  guild: Guild,
  event: keyof ReturnType<typeof getGuildConfig>['logging']['events'],
  title: string,
  description: string,
  _color?: number,
  opts?: {
    content?: string;
    contentLabel?: string;
    footer?: string;
    iconURL?: string;
    moderator?: User | string | { toString(): string } | null;
    reason?: string;
    detail?: { name: string; value: string };
    target?: User | null;
    emoji?: string;
  },
): Promise<void> {
  const cfg = getGuildConfig(guild.id);
  if (!cfg.logging.enabled || !cfg.logging.events[event]) return;

  const key: LogChannelKey =
    event === 'messageDelete' || event === 'messageEdit'
      ? 'messages'
      : event === 'memberRole' || event === 'role'
        ? 'roles'
        : event === 'memberBan' || event === 'memberUnban'
          ? 'bans'
          : 'messages';

  // Prefer dedicated channel; otherwise general logging channel
  const channelId =
    resolveLogChannelId(guild.id, key) ?? cfg.logging.channelId ?? cfg.modLogChannelId;
  if (!channelId) return;

  const channel = guild.channels.cache.get(channelId);
  if (!channel?.isTextBased() || !channel.isSendable()) return;

  const emoji =
    opts?.emoji ??
    (event === 'messageDelete'
      ? '🗑️'
      : event === 'messageEdit'
        ? '✏️'
        : event === 'memberBan'
          ? '🔨'
          : event === 'memberUnban'
            ? '🔓'
            : event === 'memberRole' || event === 'role'
              ? '🎭'
              : '📋');

  const embed = buildServerLogEmbed({
    emoji,
    title,
    description,
    moderator: opts?.moderator,
    reason: opts?.reason,
    detail: opts?.detail,
    target: opts?.target,
    footer: opts?.footer,
    content: opts?.content,
    contentLabel: opts?.contentLabel,
  });

  await (channel as TextChannel).send({ embeds: [embed] }).catch(() => undefined);
}
