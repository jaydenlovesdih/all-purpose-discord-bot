import { SlashCommandBuilder } from 'discord.js';
import { Command } from '../../types/index.js';
import { fail } from '../../utils/embeds.js';
import { isOwner } from '../../utils/permissions.js';
import { buildDocsComponents, buildDocsEmbed } from '../../utils/botDocs.js';
import { getPrefix } from '../../utils/setup.js';
import { config } from '../../config.js';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('docs')
    .setDescription('Full Blaze documentation (server owner or bot owner only)'),
  guildOnly: true,
  async execute(interaction) {
    const guild = interaction.guild!;
    const allowed = isOwner(interaction.user.id) || guild.ownerId === interaction.user.id;

    if (!allowed) {
      await interaction.reply({
        embeds: [
          fail(
            interaction.user,
            'Only the **server owner** or a **bot owner** can use docs',
          ),
        ],
        ephemeral: true,
      });
      return;
    }

    const prefix = getPrefix(guild.id, config.prefix);
    const { embed, page, totalPages } = buildDocsEmbed(prefix, 0);

    await interaction.reply({
      embeds: [embed],
      components: buildDocsComponents(page, totalPages, interaction.user.id),
    });
  },
};

export default command;
