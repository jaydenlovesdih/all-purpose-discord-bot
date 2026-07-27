import { SlashCommandBuilder } from 'discord.js';
import { Command } from '../../types/index.js';
import {
  buildCollectedRolesText,
  buildRoleBrowseRow,
  buildRolesBrowseActions,
  buildRolesListEmbed,
  buildRolesListText,
  buildRolesNavButtons,
  fetchGuildRolesApi,
  rememberRolesBrowseView,
  wantsPlainRoleReply,
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
    const plain = wantsPlainRoleReply(interaction);
    const guildName =
      interaction.guild?.name ??
      interaction.client.guilds.cache.get(interaction.guildId!)?.name ??
      'this server';
    const guildIcon =
      interaction.guild?.iconURL({ size: 256 }) ??
      interaction.client.guilds.cache.get(interaction.guildId!)?.iconURL({ size: 256 }) ??
      null;

    const roles = await fetchGuildRolesApi(interaction);

    if (roles?.length) {
      if (plain) {
        const { content, page, totalPages } = buildRolesListText(roles, guildName, 0);
        await interaction.reply({
          content,
          embeds: [],
          components: [
            buildRolesNavButtons(page, totalPages, interaction.user.id),
            buildRoleBrowseRow(interaction.user.id),
          ],
          ephemeral,
        });
        return;
      }

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

    // Bot not in server — Discord still fills Role Select with every role on the client.
    // Multi-select pins up to 25 roles per pick into a text list (repeat to add more).
    const { content } = buildCollectedRolesText([], guildName, 0);
    const components = [
      buildRoleBrowseRow(interaction.user.id, { multi: true }),
      buildRoleBrowseRow(interaction.user.id),
      buildRolesBrowseActions(interaction.user.id),
    ];

    await interaction.reply({
      content,
      embeds: [],
      components,
      ephemeral,
    });

    const message = await interaction.fetchReply();
    rememberRolesBrowseView(message.id, {
      ownerId: interaction.user.id,
      plain,
      guildName,
      collected: [],
    });
  },
};

export default command;
