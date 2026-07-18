import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  EmbedBuilder,
  GuildChannel,
  PermissionFlagsBits,
  SlashCommandBuilder,
} from 'discord.js';
import { Command } from '../../types/index.js';
import { fail, Colors } from '../../utils/embeds.js';
import {
  isCategoryChannel,
  isNukeable,
  pendingNukes,
} from '../../utils/nuke.js';
import { blackBolt, buttonEmoji } from '../../utils/emojis.js';

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

    if (isCategoryChannel(target)) {
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

    const embed = new EmbedBuilder()
      .setColor(Colors.error)
      .setTitle(`${blackBolt()} Confirm Channel Nuke`)
      .setDescription(
        [
          `Are you sure you want to nuke ${target}?`,
          '',
          'This deletes **all messages** and recreates the channel with the same name, category, and permissions.',
          '',
          'Press **Confirm** to start a **3 second** countdown, or **Cancel** to abort.',
        ].join('\n'),
      )
      .setFooter({ text: `Channel ID: ${target.id}` })
      .setTimestamp();

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId('nuke:confirm')
        .setLabel('Confirm')
        .setEmoji(buttonEmoji('blackbolt'))
        .setStyle(ButtonStyle.Danger),
      new ButtonBuilder()
        .setCustomId('nuke:cancel')
        .setLabel('Cancel')
        .setEmoji(buttonEmoji('animatedbolt'))
        .setStyle(ButtonStyle.Secondary),
    );

    const reply = await interaction.reply({
      embeds: [embed],
      components: [row],
      fetchReply: true,
    });

    pendingNukes.set(reply.id, {
      ownerId: interaction.user.id,
      guildId: guild.id,
      channelId: target.id,
      channelName: target.name,
      cancelled: false,
    });

    setTimeout(() => {
      const pending = pendingNukes.get(reply.id);
      if (!pending || pending.timer) return;
      pendingNukes.delete(reply.id);
    }, 60_000);
  },
};

export default command;
