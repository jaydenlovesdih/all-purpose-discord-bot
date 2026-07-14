import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  SlashCommandBuilder,
} from 'discord.js';
import { Command } from '../../types/index.js';
import { Colors, fail } from '../../utils/embeds.js';
import {
  collectImageReactionUsers,
  pendingRoleReactions,
} from '../../utils/rolereaction.js';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('rolereaction')
    .setDescription('Give a role to everyone who reacted to image messages in this channel (owner only)')
    .addRoleOption((opt) =>
      opt.setName('role').setDescription('Role to assign').setRequired(true),
    ),
  ownerOnly: true,
  guildOnly: true,
  async execute(interaction) {
    const role =
      interaction.options.getRole('role', true) ??
      (interaction as unknown as { message?: import('discord.js').Message }).message?.mentions.roles.first();

    if (!role) {
      await interaction.reply({
        embeds: [fail(interaction.user, 'Mention a role to assign')],
        ephemeral: true,
      });
      return;
    }

    const channel = interaction.channel;
    if (!channel?.isTextBased() || channel.isDMBased() || !('messages' in channel)) {
      await interaction.reply({
        embeds: [fail(interaction.user, 'Run this in a text channel')],
        ephemeral: true,
      });
      return;
    }

    await interaction.deferReply();

    const { userIds, imageCount } = await collectImageReactionUsers(
      channel as import('discord.js').TextChannel,
    );

    if (!imageCount) {
      await interaction.editReply({
        embeds: [fail(interaction.user, 'No image messages found in this channel')],
      });
      return;
    }

    if (!userIds.length) {
      await interaction.editReply({
        embeds: [fail(interaction.user, `Found **${imageCount}** image message(s) but no reactions to role`)],
      });
      return;
    }

    const embed = new EmbedBuilder()
      .setColor(Colors.success)
      .setTitle('🎭 Role Reaction')
      .setDescription(
        [
          `Give ${role} to **${userIds.length}** member(s)?`,
          '',
          `Scanned this channel for image messages with reactions.`,
          `**Image messages:** ${imageCount}`,
          `**Unique reactors:** ${userIds.length}`,
          '',
          'Only you can confirm or cancel this.',
        ].join('\n'),
      )
      .setFooter({ text: `Role: ${role.name} (${role.id})` })
      .setTimestamp();

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId('rolereaction:confirm')
        .setLabel('Confirm')
        .setEmoji('✅')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId('rolereaction:cancel')
        .setLabel('Cancel')
        .setEmoji('❌')
        .setStyle(ButtonStyle.Secondary),
    );

    const reply = await interaction.editReply({ embeds: [embed], components: [row] });
    const replyId = reply.id;

    pendingRoleReactions.set(replyId, {
      ownerId: interaction.user.id,
      roleId: role.id,
      guildId: interaction.guildId!,
      channelId: channel.id,
      userIds,
      imageCount,
    });

    setTimeout(() => pendingRoleReactions.delete(replyId), 10 * 60_000);
  },
};

export default command;
