import { PermissionFlagsBits, SlashCommandBuilder, TextChannel } from 'discord.js';
import { Command } from '../../types/index.js';
import { fail } from '../../utils/embeds.js';
import { buildPurgeEmbed } from '../../utils/modResponse.js';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('purge')
    .setDescription('Bulk delete messages in this channel')
    .addIntegerOption((opt) =>
      opt.setName('amount').setDescription('Number of messages (1-100)').setRequired(true).setMinValue(1).setMaxValue(100),
    ),
  permissions: [PermissionFlagsBits.ManageMessages],
  guildOnly: true,
  async execute(interaction) {
    const amount = interaction.options.getInteger('amount', true);
    const channel = interaction.channel;

    if (!channel || !channel.isTextBased() || channel.isDMBased()) {
      await interaction.reply({ embeds: [fail(interaction.user, 'Cannot purge here')], ephemeral: true });
      return;
    }

    await interaction.deferReply({ ephemeral: true });

    try {
      const deleted = await (channel as TextChannel).bulkDelete(amount, true);
      await interaction.editReply({
        embeds: [
          buildPurgeEmbed({
            moderator: interaction.user,
            amount: deleted.size,
            channelMention: `${channel}`,
            botName: interaction.client.user?.username,
          }),
        ],
      });
    } catch {
      await interaction.editReply({
        embeds: [fail(interaction.user, 'Could not delete messages (must be under 14 days old)')],
      });
    }
  },
};

export default command;
