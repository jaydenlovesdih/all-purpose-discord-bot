import { SlashCommandBuilder } from 'discord.js';
import { Command } from '../../types/index.js';
import { fail } from '../../utils/embeds.js';
import {
  buildRoleBrowseRow,
  buildRolesListEmbed,
  buildRolesListText,
  buildRolesNavButtons,
  fetchGuildRolesApi,
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

    // No API list (bot not in server) — role select still works via Discord client
    if (plain) {
      await interaction.reply({
        content: [
          `**Roles — ${guildName}**`,
          '',
          'Use the dropdown below to browse roles.',
          'Discord fills it from this server on your client — pick one to see permissions.',
        ].join('\n'),
        embeds: [],
        components: [buildRoleBrowseRow(interaction.user.id)],
        ephemeral,
      });
      return;
    }

    await interaction.reply({
      embeds: [
        fail(
          interaction.user,
          'Use the **dropdown** to browse roles (Discord fills it from this server). Pick one to see permissions.',
        ),
      ],
      components: [buildRoleBrowseRow(interaction.user.id)],
      ephemeral,
    });
  },
};

export default command;
