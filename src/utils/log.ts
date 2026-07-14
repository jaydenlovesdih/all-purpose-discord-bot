import { AttachmentBuilder, ChannelType, EmbedBuilder, Guild, TextChannel, User } from 'discord.js';
import { getGuildConfig, LogChannels, mutateGuildConfig } from './guildConfig.js';
import { Colors } from './embeds.js';

export type LogChannelKey = keyof Omit<LogChannels, 'roles'>;

/** Channel names under the blaze mod category */
export const LOG_CHANNEL_NAMES: Record<LogChannelKey, string> = {
  bans: 'bans',
  mutes: 'mutes',
  jail: 'jail-logs',
  purge: 'purge',
  server: 'server',
  messages: 'messages',
};

/** Legacy Discord channel names we still accept when rediscovering */
const LEGACY_NAMES: Partial<Record<LogChannelKey, string[]>> = {
  server: ['server', 'roles'],
  jail: ['jail-logs', 'jail-log'],
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
  strip: 'server',
  roleadd: 'server',
  roleremove: 'server',
  warn: 'bans',
  clearwarnings: 'bans',
  dnr: 'bans',
  undnr: 'bans',
};

export function logChannelForAction(action: string): LogChannelKey {
  return ACTION_CHANNEL[action] ?? 'bans';
}

/** Map logging.events keys → dedicated channels (never cross-wire) */
export function logChannelForEvent(
  event: keyof ReturnType<typeof getGuildConfig>['logging']['events'],
): LogChannelKey | null {
  switch (event) {
    case 'messageDelete':
    case 'messageEdit':
      return 'messages';
    case 'memberBan':
    case 'memberUnban':
      return 'bans';
    case 'memberRole':
    case 'role':
    case 'channel':
      return 'server';
    case 'memberJoin':
    case 'memberLeave':
      // Not part of dedicated setup channels — skip unless you want them later
      return null;
    default:
      return null;
  }
}

function findModCategory(guild: Guild) {
  return guild.channels.cache.find(
    (c) =>
      c.type === ChannelType.GuildCategory &&
      ['blaze mod', 'greed-mod', 'greed mod'].includes(c.name.toLowerCase()),
  );
}

export function isBlazeModChannel(channel: {
  guild: Guild;
  parentId?: string | null;
}): boolean {
  if (!channel.parentId) return false;
  const parent = channel.guild.channels.cache.get(channel.parentId);
  return !!parent && parent.type === ChannelType.GuildCategory && parent.name.toLowerCase() === 'blaze mod';
}

function matchLogChannel(
  guild: Guild,
  categoryId: string,
  key: LogChannelKey,
): TextChannel | undefined {
  const names = LEGACY_NAMES[key] ?? [LOG_CHANNEL_NAMES[key]];
  return guild.channels.cache.find(
    (c) =>
      c.type === ChannelType.GuildText &&
      c.parentId === categoryId &&
      names.includes(c.name.toLowerCase()),
  ) as TextChannel | undefined;
}

/** Re-find setup log channels by name (survives Railway wiping guilds.json) */
export function discoverLogChannels(guild: Guild): LogChannels {
  const category = findModCategory(guild);
  if (!category) return {};

  const found: LogChannels = {};
  for (const key of Object.keys(LOG_CHANNEL_NAMES) as LogChannelKey[]) {
    const channel = matchLogChannel(guild, category.id, key);
    if (channel) found[key] = channel.id;
  }

  // Migrate old config key "roles" → "server" if we only have the old field
  const cfg = getGuildConfig(guild.id);
  if (!found.server && cfg.logChannels?.roles) {
    found.server = cfg.logChannels.roles;
  }

  return found;
}

/**
 * Resolve a log channel ID for a dedicated key.
 * Never falls back to bans/other keys — that was sending wrong logs to wrong channels.
 */
export function resolveLogChannelId(guild: Guild, key: LogChannelKey): string | undefined {
  const cfg = getGuildConfig(guild.id);
  let id = cfg.logChannels?.[key] ?? (key === 'server' ? cfg.logChannels?.roles : undefined);

  if (id) {
    const existing = guild.channels.cache.get(id);
    if (!existing) {
      // Stale ID after wipe/channel delete
      id = undefined;
    }
  }

  if (!id) {
    const found = discoverLogChannels(guild);
    if (Object.keys(found).length) {
      mutateGuildConfig(guild.id, (c) => {
        c.logChannels = {
          ...c.logChannels,
          ...found,
        };
        // Drop deprecated roles mirror once server is set
        if (found.server) delete c.logChannels.roles;
        c.logging.enabled = true;
        if (found.bans) {
          c.logging.channelId = found.bans;
          c.modLogChannelId = found.bans;
        }
      });
      id = found[key];
    }
  } else if (!cfg.logging.enabled) {
    mutateGuildConfig(guild.id, (c) => {
      c.logging.enabled = true;
    });
  }

  return id;
}

/** Clean Infinity-style log embed */
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

/** Event-based logging with strict channel routing */
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
  const key = logChannelForEvent(event);

  // Events without a dedicated channel (joins/leaves) are skipped —
  // never dump them into messages/bans.
  if (!key) return;

  const cfg = getGuildConfig(guild.id);
  if (!cfg.logging.events[event]) {
    // Auto-enable setup-related events after config wipe / rediscovery
    if (
      ['messageDelete', 'memberBan', 'memberUnban', 'memberRole', 'role', 'channel'].includes(event)
    ) {
      mutateGuildConfig(guild.id, (c) => {
        c.logging.events[event] = true;
      });
    } else {
      return;
    }
  }

  const channelId = resolveLogChannelId(guild, key);
  if (!channelId) return;

  if (!getGuildConfig(guild.id).logging.enabled) {
    mutateGuildConfig(guild.id, (c) => {
      c.logging.enabled = true;
    });
  }

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
            : event === 'channel'
              ? '📁'
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

/** After a purge case log, attach deleted messages as a downloadable .txt */
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
    const when = new Date(s.createdTimestamp).toISOString();
    const body = s.content || '[no text content]';
    const files = s.attachments.length
      ? `\n  Attachments:\n${s.attachments.map((u) => `  - ${u}`).join('\n')}`
      : '';
    return `#${i + 1} | ${when} | ${s.authorTag} (${s.authorId})\n${body}${files}`;
  });

  const header = [
    'Blaze Purge Log',
    `Channel: ${meta.channelMention}`,
    `Moderator: ${meta.moderator.tag} (${meta.moderator.id})`,
    `Messages: ${snapshots.length}`,
    `Generated: ${new Date().toISOString()}`,
    'Order: oldest → newest',
    '─'.repeat(40),
    '',
  ].join('\n');

  const file = new AttachmentBuilder(Buffer.from(`${header}${lines.join('\n\n')}\n`, 'utf8'), {
    name: `purge-${Date.now()}.txt`,
  });

  await (logChannel as TextChannel)
    .send({
      embeds: [
        buildServerLogEmbed({
          emoji: '📜',
          title: 'Deleted Messages',
          description: `**${snapshots.length}** deleted message(s) saved to the attached file (oldest → newest).`,
          moderator: meta.moderator,
          reason: 'Purge history',
          detail: { name: '#️⃣ Channel:', value: meta.channelMention },
          footer: `${snapshots.length} message(s)`,
        }),
      ],
      files: [file],
    })
    .catch(() => undefined);
}
