import { PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import { Command } from '../../types/index.js';
import { clearSnipes } from '../../utils/snipeStore.js';
import { successEmbed } from '../../utils/embeds.js';

const command: Command = {
  data: new SlashCommandBuilder().setName('clearsnipe').setDescription('Clear snipes in this channel'),
  permissions: [PermissionFlagsBits.ManageMessages],
  guildOnly: true,
  async execute(interaction) {
    clearSnipes(interaction.channelId);
    await interaction.reply({ embeds: [successEmbed('Cleared snipes for this channel.')] });
  },
};

export default command;
