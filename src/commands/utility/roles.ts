import { EmbedBuilder, SlashCommandBuilder } from 'discord.js';
import { Command } from '../../types/index.js';
import { Colors } from '../../utils/embeds.js';
import { cacheGuildRoles, getCachedGuildRoles } from '../../utils/permissionRoles.js';
import {
  buildRoleBrowseRow,
  buildRolesBootstrapText,
  buildRolesListEmbed,
  buildRolesListText,
  buildRolesPageComponents,
  fetchGuildRolesApi,
  rememberRolesBrowseView,
  wantsPlainRoleReply,
  withUserInstall,
} from '../../utils/userInstall.js';

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
    const plain = wantsPlainRoleReply(interaction);
    const guildName =
      interaction.guild?.name ??
      interaction.client.guilds.cache.get(interaction.guildId!)?.name ??
      'this server';
    const guildIcon =
      interaction.guild?.iconURL({ size: 256 }) ??
      interaction.client.guilds.cache.get(interaction.guildId!)?.iconURL({ size: 256 }) ??
      null;

    let roles = (await fetchGuildRolesApi(interaction)) ?? [];
    let fromApi = roles.length > 0;

    if (!roles.length) {
      roles = getCachedGuildRoles(interaction.guildId);
    }

    if (!roles.length) {
      const bootstrap = buildRolesBootstrapText(guildName);
      if (plain) {
        await interaction.reply({
          content: bootstrap,
          embeds: [],
          components: [buildRoleBrowseRow(interaction.user.id, { multi: true })],
          ephemeral,
        });
      } else {
        await interaction.reply({
          embeds: [
            new EmbedBuilder()
              .setColor(Colors.success)
              .setTitle(`Roles — ${guildName}`)
              .setDescription(bootstrap.split('\n\n').slice(1).join('\n\n')),
          ],
          components: [buildRoleBrowseRow(interaction.user.id, { multi: true })],
          ephemeral,
        });
      }

      const message = await interaction.fetchReply();
      rememberRolesBrowseView(message.id, {
        ownerId: interaction.user.id,
        plain,
        guildName,
        collected: [],
        fromApi: false,
        page: 0,
      });
      return;
    }

    if (fromApi) {
      cacheGuildRoles(interaction.guildId, roles);
    }

    if (plain) {
      const { content, page, totalPages } = buildRolesListText(roles, guildName, 0);
      await interaction.reply({
        content,
        embeds: [],
        components: buildRolesPageComponents(page, totalPages, interaction.user.id, {
          loadMore: !fromApi,
        }),
        ephemeral,
      });
    } else {
      const { embed, page, totalPages } = buildRolesListEmbed(roles, guildName, 0, guildIcon);
      await interaction.reply({
        embeds: [embed],
        components: buildRolesPageComponents(page, totalPages, interaction.user.id, {
          loadMore: !fromApi,
        }),
        ephemeral,
      });
    }

    const message = await interaction.fetchReply();
    rememberRolesBrowseView(message.id, {
      ownerId: interaction.user.id,
      plain,
      guildName,
      collected: roles,
      fromApi,
      page: 0,
    });
  },
};

export default command;
