import { SlashCommandBuilder } from 'discord.js';
import { config } from '../../config.js';
import { Command } from '../../types/index.js';
import { buildHelpButtons, buildHelpEmbed } from '../../utils/helpMenu.js';
import { getPrefix } from '../../utils/setup.js';

const command: Command = {
  data: new SlashCommandBuilder().setName('help').setDescription('List all available commands'),
  async execute(interaction, client) {
    const prefix = getPrefix(interaction.guildId, config.prefix);
    const { embed, page, totalPages } = buildHelpEmbed(client, prefix, 'info', 0);
    const components = buildHelpButtons('info', page, totalPages, interaction.user.id);

    await interaction.reply({ embeds: [embed], components });
  },
};

export default command;
