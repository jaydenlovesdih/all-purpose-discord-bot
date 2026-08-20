import { SlashCommandBuilder } from 'discord.js';
import { Command } from '../../types/index.js';
import { fail } from '../../utils/embeds.js';
import { getCachedGuildRoles } from '../../utils/permissionRoles.js';
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
    if (!roles.length) {
      roles = getCachedGuildRoles(interaction.guildId);
    }

    if (!roles.length) {
      await interaction.reply({
        embeds: [
          fail(
            interaction.user,
            'Could not load roles for this server. Invite the bot here to use `/roles`, or use `/rolepermissions` to inspect one role via the dropdown.',
          ),
        ],
        ephemeral,
      });
      return;
    }

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
  },
};

export default command;
