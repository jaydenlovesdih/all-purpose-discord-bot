import {
  ChannelType,
  CategoryChannel,
  Guild,
  GuildChannel,
  NewsChannel,
  OverwriteType,
  ForumChannel,
  StageChannel,
  TextChannel,
  User,
  VoiceChannel,
  EmbedBuilder,
} from 'discord.js';
import { Colors } from './embeds.js';
import { blackBolt } from './emojis.js';

export type NukeableChannel =
  | TextChannel
  | VoiceChannel
  | NewsChannel
  | ForumChannel
  | StageChannel;

export interface PendingNuke {
  ownerId: string;
  guildId: string;
  channelId: string;
  channelName: string;
  /** Active countdown interval / timeout so cancel can clear them */
  timer?: ReturnType<typeof setInterval> | ReturnType<typeof setTimeout>;
  cancelled: boolean;
}

export const pendingNukes = new Map<string, PendingNuke>();

export function isNukeable(channel: GuildChannel): channel is NukeableChannel {
  return (
    channel.type === ChannelType.GuildText ||
    channel.type === ChannelType.GuildVoice ||
    channel.type === ChannelType.GuildAnnouncement ||
    channel.type === ChannelType.GuildForum ||
    channel.type === ChannelType.GuildStageVoice
  );
}

export function isCategoryChannel(channel: GuildChannel): boolean {
  return channel instanceof CategoryChannel || channel.type === ChannelType.GuildCategory;
}

function snapshotOverwrites(channel: GuildChannel) {
  return channel.permissionOverwrites.cache.map((ow) => ({
    id: ow.id,
    type: ow.type as OverwriteType,
    allow: ow.allow.bitfield,
    deny: ow.deny.bitfield,
  }));
}

export async function executeNuke(
  guild: Guild,
  channelId: string,
  by: User,
): Promise<{ channel: GuildChannel; name: string; parentId: string | null; overwriteCount: number } | { error: string }> {
  const target = guild.channels.cache.get(channelId) as GuildChannel | undefined;
  if (!target) return { error: 'Channel no longer exists' };
  if (isCategoryChannel(target)) return { error: 'Cannot nuke a category' };
  if (!isNukeable(target)) return { error: 'That channel type cannot be nuked' };

  const name = target.name;
  const type = target.type;
  const parentId = target.parentId;
  const position = target.position;
  const topic = 'topic' in target ? target.topic ?? undefined : undefined;
  const nsfw = 'nsfw' in target ? Boolean(target.nsfw) : undefined;
  const rateLimitPerUser =
    'rateLimitPerUser' in target ? (target.rateLimitPerUser ?? undefined) : undefined;
  const bitrate = 'bitrate' in target ? (target.bitrate ?? undefined) : undefined;
  const userLimit = 'userLimit' in target ? (target.userLimit ?? undefined) : undefined;
  const rtcRegion = 'rtcRegion' in target ? target.rtcRegion ?? undefined : undefined;
  const videoQualityMode =
    'videoQualityMode' in target ? target.videoQualityMode ?? undefined : undefined;
  const defaultAutoArchiveDuration =
    'defaultAutoArchiveDuration' in target
      ? target.defaultAutoArchiveDuration ?? undefined
      : undefined;
  const availableTags =
    'availableTags' in target ? [...(target.availableTags ?? [])] : undefined;
  const defaultReactionEmoji =
    'defaultReactionEmoji' in target ? target.defaultReactionEmoji ?? undefined : undefined;
  const defaultThreadRateLimitPerUser =
    'defaultThreadRateLimitPerUser' in target
      ? target.defaultThreadRateLimitPerUser ?? undefined
      : undefined;
  const defaultSortOrder =
    'defaultSortOrder' in target ? target.defaultSortOrder ?? undefined : undefined;
  const defaultForumLayout =
    'defaultForumLayout' in target ? target.defaultForumLayout ?? undefined : undefined;

  const permissionOverwrites = snapshotOverwrites(target);
  const reason = `Channel nuke by ${by.tag} (${by.id})`;

  await target.delete(reason);

  const created = await guild.channels.create({
    name,
    type,
    parent: parentId ?? undefined,
    permissionOverwrites,
    topic,
    nsfw,
    rateLimitPerUser,
    bitrate,
    userLimit,
    rtcRegion,
    videoQualityMode,
    defaultAutoArchiveDuration,
    availableTags,
    defaultReactionEmoji,
    defaultThreadRateLimitPerUser,
    defaultSortOrder,
    defaultForumLayout,
    reason,
    position,
  });

  if ('setPosition' in created) {
    await created.setPosition(position, { reason }).catch(() => undefined);
  }

  return {
    channel: created as GuildChannel,
    name,
    parentId,
    overwriteCount: permissionOverwrites.length,
  };
}

export function buildNukeDoneEmbed(
  name: string,
  parentId: string | null,
  overwriteCount: number,
  by: User,
): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(Colors.success)
    .setTitle(`${blackBolt()} Channel Nuked`)
    .setDescription(
      [
        `**${name}** was deleted and recreated.`,
        '',
        `📁 Category: ${parentId ? `<#${parentId}>` : 'None'}`,
        `🔐 Overwrites: **${overwriteCount}**`,
        `🛡️ By: ${by}`,
      ].join('\n'),
    )
    .setTimestamp();
}
