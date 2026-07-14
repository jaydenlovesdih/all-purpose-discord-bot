import { SlashCommandBuilder } from 'discord.js';
import { config } from '../../config.js';
import { Command } from '../../types/index.js';
import { getGuildConfig } from '../../utils/guildConfig.js';
import { fail } from '../../utils/embeds.js';
import { buildHelpButtons, buildHelpEmbed } from '../../utils/helpMenu.js';
import {
  buildCommandHelpEmbed,
  buildCommandHelpSelect,
  extractSubcommands,
  resolveHelpTarget,
} from '../../utils/commandHelp.js';
import { getPrefix } from '../../utils/setup.js';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('help')
    .setDescription('Browse commands or get help for a specific command')
    .addStringOption((opt) =>
      opt.setName('command').setDescription('Command to explain (e.g. antinuke)'),
    ),
  async execute(interaction, client) {
    const prefix = getPrefix(interaction.guildId, config.prefix);
    const query = interaction.options.getString('command')?.trim();

    if (!query) {
      const { embed, page, totalPages } = buildHelpEmbed(client, prefix, 'info', 0);
      await interaction.reply({
        embeds: [embed],
        components: buildHelpButtons('info', page, totalPages, interaction.user.id),
      });
      return;
    }

    const guildAliases = interaction.guildId
      ? getGuildConfig(interaction.guildId).aliases
      : {};
    const target = resolveHelpTarget(query, client, guildAliases);
    if (!target) {
      await interaction.reply({
        embeds: [
          fail(
            interaction.user,
            `Unknown command \`${query}\`. Try \`${prefix}help\` for the full list.`,
          ),
        ],
        ephemeral: true,
      });
      return;
    }

    const subs = extractSubcommands(target);
    const embed = buildCommandHelpEmbed(target, prefix, {
      botName: interaction.client.user?.username,
    });
    const select = buildCommandHelpSelect(target.data.name, subs, interaction.user.id);

    await interaction.reply({
      embeds: [embed],
      components: select ? [select] : [],
    });
  },
};

export default command;
