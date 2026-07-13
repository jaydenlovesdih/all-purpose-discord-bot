import { PermissionFlagsBits, SlashCommandBuilder, TextChannel } from 'discord.js';
import { Command } from '../../types/index.js';
import { successEmbed, errorEmbed } from '../../utils/embeds.js';

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
    const channel = interaction.channel as TextChannel;

    await interaction.deferReply({ ephemeral: true });

    const deleted = await channel.bulkDelete(amount, true);
    await interaction.editReply({
      embeds: [successEmbed(`Deleted **${deleted.size}** message(s).`)],
    });
  },
};

export default command;
