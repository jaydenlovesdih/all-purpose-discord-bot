import { SlashCommandBuilder } from 'discord.js';
import { Command } from '../../types/index.js';
import { fail } from '../../utils/embeds.js';
import {
  buildPermissionRolesEmbed,
  buildPermissionRolesText,
  buildPermissionSelectRow,
  findPermission,
  loadRolesForPermissionCheck,
  listAllPermissions,
  rememberPermissionRolesView,
  respondPermissionAutocomplete,
  rolesLoadFailedMessage,
  wantsPlainRoleReply,
} from '../../utils/permissionRoles.js';
import { withUserInstall } from '../../utils/userInstall.js';

const command: Command = {
  data: withUserInstall(
    new SlashCommandBuilder()
      .setName('permissionroles')
      .setDescription('List roles that have a given permission (only you can see this)')
      .addStringOption((opt) =>
        opt
          .setName('permission')
          .setDescription('Permission to check (type to search)')
          .setAutocomplete(true)
          .setRequired(false),
      ),
  ),
  guildOnly: true,
  userInstall: true,
  bypassBotLock: true,
  autocomplete: respondPermissionAutocomplete,
  async execute(interaction) {
    const isPrefix = 'commandMessage' in interaction;
    const ephemeral = !isPrefix;
    const plain = wantsPlainRoleReply(interaction);

    const raw =
      interaction.options.getString('permission', false) ??
      interaction.options.getString('value', false);

    const { roles, guildName } = await loadRolesForPermissionCheck(interaction);

    if (!roles) {
      const tip = rolesLoadFailedMessage(guildName);
      if (plain) {
        await interaction.reply({ content: tip, embeds: [], ephemeral });
      } else {
        await interaction.reply({
          embeds: [fail(interaction.user, tip)],
          ephemeral,
        });
      }
      return;
    }

    // No permission yet — show picker; roles are already loaded for instant filter
    if (!raw?.trim()) {
      const content = [
        `**Permission → roles**`,
        `Server: ${guildName}`,
        `Ready to scan **${roles.length}** roles`,
        '',
        'Pick a permission from the dropdown.',
      ].join('\n');

      await interaction.reply({
        ...(plain
          ? { content, embeds: [] }
          : {
              embeds: [
                fail(interaction.user, 'Pick a permission from the dropdown to see which roles have it.'),
              ],
            }),
        components: [buildPermissionSelectRow(interaction.user.id, 0)],
        ephemeral,
      });

      const message = await interaction.fetchReply();
      rememberPermissionRolesView(message.id, {
        ownerId: interaction.user.id,
        permissionKey: '',
        permPage: 0,
        plain,
        guildName,
        roles,
      });
      return;
    }

    const perm = findPermission(raw) ?? listAllPermissions().find((p) => p.key === raw) ?? null;
    if (!perm) {
      const tip = `Unknown permission \`${raw}\`. Use the dropdown or autocomplete to pick one.`;
      if (plain) {
        await interaction.reply({
          content: tip,
          embeds: [],
          components: [buildPermissionSelectRow(interaction.user.id, 0)],
          ephemeral,
        });
      } else {
        await interaction.reply({
          embeds: [fail(interaction.user, tip)],
          components: [buildPermissionSelectRow(interaction.user.id, 0)],
          ephemeral,
        });
      }
      const message = await interaction.fetchReply();
      rememberPermissionRolesView(message.id, {
        ownerId: interaction.user.id,
        permissionKey: '',
        permPage: 0,
        plain,
        guildName,
        roles,
      });
      return;
    }

    const all = listAllPermissions();
    const idx = all.findIndex((p) => p.key === perm.key);
    const permPage = Math.max(0, Math.floor(idx / 23));

    if (plain) {
      await interaction.reply({
        content: buildPermissionRolesText(perm, roles, guildName),
        embeds: [],
        components: [buildPermissionSelectRow(interaction.user.id, permPage, perm.key)],
        ephemeral,
      });
    } else {
      await interaction.reply({
        embeds: [buildPermissionRolesEmbed(perm, roles, guildName)],
        components: [buildPermissionSelectRow(interaction.user.id, permPage, perm.key)],
        ephemeral,
      });
    }

    const message = await interaction.fetchReply();
    rememberPermissionRolesView(message.id, {
      ownerId: interaction.user.id,
      permissionKey: perm.key,
      permPage,
      plain,
      guildName,
      roles,
    });
  },
};

export default command;
