import { ChannelType, EmbedBuilder, Guild, TextChannel, User } from 'discord.js';
import { getGuildConfig, LogChannels, mutateGuildConfig } from './guildConfig.js';
import { Colors } from './embeds.js';

export type LogChannelKey = keyof LogChannels;

/** Channel names created by `,setup` under the blaze mod category */
export const LOG_CHANNEL_NAMES: Record<LogChannelKey, string> = {
  bans: 'bans',
  mutes: 'mutes',
  jail: 'jail-logs',
  purge: 'purge',
  roles: 'roles',
  messages: 'messages',
};

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

function findModCategory(guild: Guild) {
  return guild.channels.cache.find(
    (c) =>
      c.type === ChannelType.GuildCategory &&
      ['blaze mod', 'greed-mod', 'greed mod'].includes(c.name.toLowerCase()),
  );
}

/** Re-find setup log channels by name (survives Railway wiping guilds.json) */
export function discoverLogChannels(guild: Guild): LogChannels {
  const category = findModCategory(guild);
  if (!category) return {};

  const found: LogChannels = {};
  for (const [key, name] of Object.entries(LOG_CHANNEL_NAMES) as [LogChannelKey, string][]) {
    const channel = guild.channels.cache.find(
      (c) => c.type === ChannelType.GuildText && c.parentId === category.id && c.name === name,
    );
    if (channel) found[key] = channel.id;
  }
  return found;
}

/**
 * Resolve a log channel ID. If config was wiped on redeploy, rediscover
 * channels under "blaze mod" and persist them again.
 */
export function resolveLogChannelId(guild: Guild, key: LogChannelKey): string | undefined {
  const cfg = getGuildConfig(guild.id);
  let id = cfg.logChannels?.[key] ?? cfg.logging.channelId ?? cfg.modLogChannelId;

  // Stale / missing — rediscover from Discord
  if (!id || !guild.channels.cache.has(id)) {
    const found = discoverLogChannels(guild);
    if (Object.keys(found).length) {
      mutateGuildConfig(guild.id, (c) => {
        c.logChannels = { ...c.logChannels, ...found };
        c.logging.enabled = true;
        c.logging.channelId = c.logging.channelId ?? found.bans ?? Object.values(found)[0];
        c.modLogChannelId = c.modLogChannelId ?? found.bans ?? Object.values(found)[0];
      });
      id = found[key] ?? found.bans ?? Object.values(found)[0];
    }
  } else if (!cfg.logging.enabled && Object.values(cfg.logChannels ?? {}).some(Boolean)) {
    // Channels configured but flag was reset to default false after redeploy
    mutateGuildConfig(guild.id, (c) => {
      c.logging.enabled = true;
    });
  }

  return id;
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
  const channelId = resolveLogChannelId(guild, key);
  if (!channelId) return;

  let channel = guild.channels.cache.get(channelId);
  if (!channel) {
    channel = (await guild.channels.fetch(channelId).catch(() => null)) ?? undefined;
  }
  if (!channel?.isTextBased() || !channel.isSendable()) return;

  await (channel as TextChannel).send({ embeds: [embed] }).catch(() => undefined);
}

/** Event-based logging (joins, channel create, etc.) */
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
  const key: LogChannelKey =
    event === 'messageDelete' || event === 'messageEdit'
      ? 'messages'
      : event === 'memberRole' || event === 'role'
        ? 'roles'
        : event === 'memberBan' || event === 'memberUnban'
          ? 'bans'
          : 'messages';

  // Rediscover / enable happens inside resolveLogChannelId
  const channelId = resolveLogChannelId(guild, key);
  if (!channelId) return;

  const cfg = getGuildConfig(guild.id);
  // After rediscovery, events are on by default; if config still says off for this event, skip
  // unless we just re-enabled logging from discovery (logging.enabled true)
  if (!cfg.logging.enabled) return;
  if (!cfg.logging.events[event]) return;

  let channel = guild.channels.cache.get(channelId);
  if (!channel) {
    channel = (await guild.channels.fetch(channelId).catch(() => null)) ?? undefined;
  }
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

export interface PurgedMessageSnapshot {
  authorId: string;
  authorTag: string;
  content: string;
  createdTimestamp: number;
  attachments: string[];
  channelId: string;
}

/** After a purge case log, dump deleted messages chronologically in the purge channel */
export async function sendPurgeMessageHistory(
  guild: Guild,
  snapshots: PurgedMessageSnapshot[],
  meta: { moderator: User; channelMention: string },
): Promise<void> {
  if (!snapshots.length) return;

  const channelId = resolveLogChannelId(guild, 'purge');
  if (!channelId) return;

  let logChannel = guild.channels.cache.get(channelId);
  if (!logChannel) {
    logChannel = (await guild.channels.fetch(channelId).catch(() => null)) ?? undefined;
  }
  if (!logChannel?.isTextBased() || !logChannel.isSendable()) return;

  const lines = snapshots.map((s, i) => {
    const when = `<t:${Math.floor(s.createdTimestamp / 1000)}:T>`;
    const body = (s.content || '*no text*').replace(/\n/g, ' ').slice(0, 180);
    const files = s.attachments.length ? ` · 📎 ${s.attachments.length}` : '';
    return `**${i + 1}.** ${when} · **${s.authorTag}**: ${body}${files}`;
  });

  const chunks: string[][] = [];
  let current: string[] = [];
  let size = 0;

  for (const line of lines) {
    if (size + line.length + 1 > 3800 && current.length) {
      chunks.push(current);
      current = [];
      size = 0;
    }
    current.push(line);
    size += line.length + 1;
  }
  if (current.length) chunks.push(current);

  await (logChannel as TextChannel)
    .send({
      embeds: [
        buildServerLogEmbed({
          emoji: '📜',
          title: 'Deleted Messages',
          description: `Logging **${snapshots.length}** deleted message(s) in order (oldest → newest).`,
          moderator: meta.moderator,
          reason: 'Purge history',
          detail: { name: '#️⃣ Channel:', value: meta.channelMention },
          footer: `${snapshots.length} message(s)`,
        }),
      ],
    })
    .catch(() => undefined);

  for (let i = 0; i < chunks.length; i++) {
    const embed = new EmbedBuilder()
      .setColor(Colors.success)
      .setTitle(`📜 Purge History (${i + 1}/${chunks.length})`)
      .setDescription(chunks[i].join('\n'))
      .setTimestamp();

    await (logChannel as TextChannel).send({ embeds: [embed] }).catch(() => undefined);
  }
}
