import { SlashCommandBuilder } from 'discord.js';
import { Command } from '../../types/index.js';
import { fail } from '../../utils/embeds.js';
import { loadGuildRolesForBrowse } from '../../utils/guildRolesCache.js';
import { buildRolesButtons, buildRolesEmbedFromList } from '../../utils/rolesList.js';
import { withUserInstall } from '../../utils/userInstall.js';

const command: Command = {
  data: withUserInstall(
    new SlashCommandBuilder()
      .setName('roles')
      .setDescription('List server roles 10 at a time (only you can see this)'),
  ),
  guildOnly: true,
  userInstall: true,
  bypassBotLock: true,
  async execute(interaction) {
    const isPrefix = 'commandMessage' in interaction;
    const ephemeral = !isPrefix;
    const guildName =
      interaction.guild?.name ??
      interaction.client.guilds.cache.get(interaction.guildId!)?.name ??
      'this server';
    const guildIcon =
      interaction.guild?.iconURL({ size: 256 }) ??
      interaction.client.guilds.cache.get(interaction.guildId!)?.iconURL({ size: 256 }) ??
      null;

    const roles = await loadGuildRolesForBrowse(interaction);
    if (!roles.length) {
      await interaction.reply({
        embeds: [fail(interaction.user, 'Could not load roles for this server.')],
        ephemeral,
      });
      return;
    }

    const guild = interaction.guild ?? interaction.client.guilds.cache.get(interaction.guildId!);
    const list = roles.map((r) => {
      const live = guild?.roles.cache.get(r.id);
      return {
        id: r.id,
        name: r.name,
        color: r.color,
        hexColor: r.hexColor ?? live?.hexColor,
        memberCount: live?.members.size,
      };
    });

    const { embed, page, totalPages } = buildRolesEmbedFromList(list, guildName, 0, guildIcon);
    await interaction.reply({
      embeds: [embed],
      components: buildRolesButtons(page, totalPages, interaction.user.id),
      ephemeral,
    });
  },
};

export default command;
