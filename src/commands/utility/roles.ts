import { SlashCommandBuilder } from 'discord.js';
import { Command } from '../../types/index.js';
import { fail } from '../../utils/embeds.js';
import { buildRolesButtons, buildRolesEmbed } from '../../utils/rolesList.js';

const command: Command = {
  data: new SlashCommandBuilder().setName('roles').setDescription('List all server roles'),
  guildOnly: true,
  async execute(interaction) {
    if (!interaction.guild) {
      await interaction.reply({ embeds: [fail(interaction.user, 'Guild only')], ephemeral: true });
      return;
    }

    const { embed, page, totalPages } = buildRolesEmbed(interaction.guild, 0);
    await interaction.reply({
      embeds: [embed],
      components: buildRolesButtons(page, totalPages, interaction.user.id),
    });
  },
};

export default command;
