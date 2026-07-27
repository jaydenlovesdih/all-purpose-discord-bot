import { EmbedBuilder, SlashCommandBuilder } from 'discord.js';
import { Command } from '../../types/index.js';
import { fail, Colors } from '../../utils/embeds.js';
import {
  buildRoleBrowseRow,
  buildRolesListEmbed,
  buildRolesNavButtons,
  fetchGuildRolesApi,
  withUserInstall,
} from '../../utils/userInstall.js';

const command: Command = {
  data: withUserInstall(
    new SlashCommandBuilder()
      .setName('roles')
      .setDescription('List / browse server roles (only you can see this)'),
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

    const roles = await fetchGuildRolesApi(interaction);

    // Bot is in the server (or REST allowed) → full paginated list
    if (roles?.length) {
      const { embed, page, totalPages } = buildRolesListEmbed(roles, guildName, 0, guildIcon);
      await interaction.reply({
        embeds: [embed],
        components: [
          buildRolesNavButtons(page, totalPages, interaction.user.id),
          buildRoleBrowseRow(interaction.user.id),
        ],
        ephemeral,
      });
      return;
    }

    // User-install in a server the bot is NOT in:
    // Discord Role Select is populated by the client — no bot membership needed.
    const embed = new EmbedBuilder()
      .setColor(Colors.success)
      .setTitle(`🎭 Roles — ${guildName}`)
      .setDescription(
        [
          'The bot is not a member of this server, so it cannot download the full role list from the API.',
          '',
          'Use the **dropdown below** — Discord fills it with every role in this server on your client.',
          'Pick a role to see its ID and permissions (still only visible to you).',
        ].join('\n'),
      )
      .setThumbnail(guildIcon)
      .setTimestamp();

    await interaction.reply({
      embeds: [embed],
      components: [buildRoleBrowseRow(interaction.user.id)],
      ephemeral,
    });
  },
};

export default command;
