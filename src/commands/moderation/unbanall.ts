import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  PermissionFlagsBits,
  SlashCommandBuilder,
} from 'discord.js';
import { Command } from '../../types/index.js';
import { fail, Colors } from '../../utils/embeds.js';
import { blackBolt, buttonEmoji } from '../../utils/emojis.js';
import { isUnbanAllRunning, pendingUnbanAlls } from '../../utils/unbanAll.js';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('unbanall')
    .setDescription('Unban everyone on the ban list, slowly to avoid rate limits')
    .addStringOption((opt) => opt.setName('reason').setDescription('Reason')),
  permissions: [PermissionFlagsBits.BanMembers],
  guildOnly: true,
  async execute(interaction) {
    const guild = interaction.guild!;
    const reason =
      interaction.options.getString('reason') ??
      `Mass unban by ${interaction.user.tag}`;

    if (isUnbanAllRunning(guild.id)) {
      await interaction.reply({
        embeds: [fail(interaction.user, 'A mass unban is already running in this server')],
        ephemeral: true,
      });
      return;
    }

    const me = guild.members.me;
    if (!me?.permissions.has(PermissionFlagsBits.BanMembers)) {
      await interaction.reply({
        embeds: [fail(interaction.user, 'I need **Ban Members** to unban people')],
        ephemeral: true,
      });
      return;
    }

    await interaction.deferReply();

    let banCount = 0;
    try {
      const bans = await guild.bans.fetch();
      banCount = bans.size;
    } catch {
      await interaction.editReply({
        embeds: [fail(interaction.user, 'Could not fetch the ban list')],
      });
      return;
    }

    if (banCount === 0) {
      await interaction.editReply({
        embeds: [fail(interaction.user, 'Nobody is banned in this server')],
      });
      return;
    }

    const estMinutes = Math.ceil((banCount * 1.4) / 60);
    const embed = new EmbedBuilder()
      .setColor(Colors.error)
      .setTitle(`${blackBolt()} Confirm Mass Unban`)
      .setDescription(
        [
          `This will unban **${banCount}** user${banCount === 1 ? '' : 's'}.`,
          '',
          `Unbans are paced (~1.4s each) so Discord does not rate-limit the bot.`,
          `Estimated time: **~${estMinutes} minute${estMinutes === 1 ? '' : 's'}**.`,
          '',
          `Reason: ${reason}`,
          '',
          'Hardban flags for these users will also be cleared.',
          '',
          'Press **Confirm** to start, or **Cancel** to abort.',
        ].join('\n'),
      )
      .setFooter({ text: `Requested by ${interaction.user.tag}` })
      .setTimestamp();

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId('unbanall:confirm')
        .setLabel('Confirm')
        .setEmoji(buttonEmoji('blackbolt'))
        .setStyle(ButtonStyle.Danger),
      new ButtonBuilder()
        .setCustomId('unbanall:cancel')
        .setLabel('Cancel')
        .setStyle(ButtonStyle.Secondary),
    );

    const msg = await interaction.editReply({ embeds: [embed], components: [row] });
    pendingUnbanAlls.set(msg.id, {
      ownerId: interaction.user.id,
      guildId: guild.id,
      reason,
    });
    setTimeout(() => pendingUnbanAlls.delete(msg.id), 10 * 60_000);
  },
};

export default command;
