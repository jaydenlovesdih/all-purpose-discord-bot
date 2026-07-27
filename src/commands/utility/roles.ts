import { SlashCommandBuilder } from 'discord.js';
import { Command } from '../../types/index.js';
import { fail } from '../../utils/embeds.js';
import { buildRolesButtons, buildRolesEmbed } from '../../utils/rolesList.js';
import { resolveGuildForRoles, withUserInstall } from '../../utils/userInstall.js';

const command: Command = {
  data: withUserInstall(
    new SlashCommandBuilder()
      .setName('roles')
      .setDescription('List all server roles (only you can see this)'),
  ),
  guildOnly: true,
  userInstall: true,
  bypassBotLock: true,
  async execute(interaction) {
    const isPrefix = 'commandMessage' in interaction;
    const ephemeral = !isPrefix;

    const guild = await resolveGuildForRoles(interaction);
    if (!guild) {
      await interaction.reply({
        embeds: [
          fail(
            interaction.user,
            "I cannot see this server's roles. Add the bot **to this server** as well — user-install alone cannot read role lists.",
          ),
        ],
        ephemeral,
      });
      return;
    }

    const { embed, page, totalPages } = buildRolesEmbed(guild, 0);
    await interaction.reply({
      embeds: [embed],
      components: buildRolesButtons(page, totalPages, interaction.user.id),
      ephemeral,
    });
  },
};

export default command;
