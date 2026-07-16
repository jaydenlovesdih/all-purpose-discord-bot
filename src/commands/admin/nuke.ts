import {
  ChannelType,
  GuildChannel,
  OverwriteType,
  PermissionFlagsBits,
  SlashCommandBuilder,
  TextChannel,
  VoiceChannel,
  CategoryChannel,
  NewsChannel,
  ForumChannel,
  StageChannel,
} from 'discord.js';
import { Command } from '../../types/index.js';
import { fail, ok, Colors } from '../../utils/embeds.js';
import { EmbedBuilder } from 'discord.js';

type NukeableChannel =
  | TextChannel
  | VoiceChannel
  | NewsChannel
  | ForumChannel
  | StageChannel;

function isNukeable(channel: GuildChannel): channel is NukeableChannel {
  return (
    channel.type === ChannelType.GuildText ||
    channel.type === ChannelType.GuildVoice ||
    channel.type === ChannelType.GuildAnnouncement ||
    channel.type === ChannelType.GuildForum ||
    channel.type === ChannelType.GuildStageVoice
  );
}

function snapshotOverwrites(channel: GuildChannel) {
  return channel.permissionOverwrites.cache.map((ow) => ({
    id: ow.id,
    type: ow.type,
    allow: ow.allow.bitfield,
    deny: ow.deny.bitfield,
  }));
}

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('nuke')
    .setDescription('Delete a channel and recreate an exact replica (owner only)')
    .addChannelOption((opt) =>
      opt
        .setName('channel')
        .setDescription('Channel to nuke (defaults to current)')
        .addChannelTypes(
          ChannelType.GuildText,
          ChannelType.GuildVoice,
          ChannelType.GuildAnnouncement,
          ChannelType.GuildForum,
          ChannelType.GuildStageVoice,
        ),
    ),
  ownerOnly: true,
  guildOnly: true,
  async execute(interaction) {
    const guild = interaction.guild!;
    const me = guild.members.me;

    if (!me?.permissions.has(PermissionFlagsBits.ManageChannels)) {
      await interaction.reply({
        embeds: [fail(interaction.user, 'I need **Manage Channels** to nuke')],
        ephemeral: true,
      });
      return;
    }

    const target =
      (interaction.options.getChannel('channel') as GuildChannel | null) ??
      (interaction.channel as GuildChannel | null);

    if (!target || !('guild' in target) || target.guildId !== guild.id) {
      await interaction.reply({
        embeds: [fail(interaction.user, 'Provide a valid server channel')],
        ephemeral: true,
      });
      return;
    }

    if (target instanceof CategoryChannel || target.type === ChannelType.GuildCategory) {
      await interaction.reply({
        embeds: [fail(interaction.user, 'Cannot nuke a category — nuke individual channels instead')],
        ephemeral: true,
      });
      return;
    }

    if (!isNukeable(target)) {
      await interaction.reply({
        embeds: [fail(interaction.user, 'That channel type cannot be nuked')],
        ephemeral: true,
      });
      return;
    }

    const nukingCurrent =
      interaction.channelId === target.id ||
      !interaction.channel ||
      !('send' in interaction.channel);

    // Snapshot everything before delete
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

    const permissionOverwrites = snapshotOverwrites(target).map((ow) => ({
      id: ow.id,
      type: ow.type as OverwriteType,
      allow: ow.allow,
      deny: ow.deny,
    }));

    if (!nukingCurrent) {
      await interaction.deferReply({ ephemeral: true });
    } else {
      // Channel will be deleted — acknowledge briefly if possible, then recreate
      await interaction.reply({
        embeds: [ok(interaction.user, `nuking ${target}…`)],
      }).catch(() => undefined);
    }

    const reason = `Channel nuke by ${interaction.user.tag} (${interaction.user.id})`;

    try {
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

      // Discord sometimes ignores position on create — force it
      if ('setPosition' in created) {
        await created.setPosition(position, { reason }).catch(() => undefined);
      }

      const doneEmbed = new EmbedBuilder()
        .setColor(Colors.success)
        .setTitle('💣 Channel Nuked')
        .setDescription(
          [
            `**${name}** was deleted and recreated.`,
            '',
            `📁 Category: ${parentId ? `<#${parentId}>` : 'None'}`,
            `🔐 Overwrites: **${permissionOverwrites.length}**`,
            `🛡️ By: ${interaction.user}`,
          ].join('\n'),
        )
        .setTimestamp();

      if (created.isTextBased() && created.isSendable()) {
        await created.send({ embeds: [doneEmbed] }).catch(() => undefined);
      }

      if (!nukingCurrent && interaction.deferred) {
        await interaction.editReply({
          embeds: [ok(interaction.user, `nuked and recreated ${created}`)],
        });
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      if (interaction.deferred || interaction.replied) {
        await interaction.followUp({
          embeds: [fail(interaction.user, `Nuke failed: ${msg}`)],
          ephemeral: true,
        }).catch(() => undefined);
      } else {
        await interaction.reply({
          embeds: [fail(interaction.user, `Nuke failed: ${msg}`)],
          ephemeral: true,
        });
      }
    }
  },
};

export default command;
