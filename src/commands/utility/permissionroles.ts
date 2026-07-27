import { SlashCommandBuilder } from 'discord.js';
import { Command } from '../../types/index.js';
import { fail } from '../../utils/embeds.js';
import {
  buildPermissionPromptText,
  buildPermissionRolesComponents,
  buildPermissionRolesEmbed,
  buildPermissionRolesText,
  findPermission,
  loadRolesForPermissionCheck,
  listAllPermissions,
  rememberPermissionRolesView,
  respondPermissionAutocomplete,
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

    const { roles, guildName, fromApi } = await loadRolesForPermissionCheck(interaction);

    // No permission yet — show pickers
    if (!raw?.trim()) {
      const content = buildPermissionPromptText(guildName, fromApi);
      await interaction.reply({
        ...(plain
          ? { content, embeds: [] }
          : {
              content: fromApi ? undefined : content,
              embeds: [
                fail(interaction.user, 'Pick a permission from the dropdown to see which roles have it.'),
              ],
            }),
        components: buildPermissionRolesComponents(interaction.user.id, 0, undefined, fromApi),
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
        fromApi,
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
          components: buildPermissionRolesComponents(interaction.user.id, 0, undefined, fromApi),
          ephemeral,
        });
      } else {
        await interaction.reply({
          embeds: [fail(interaction.user, tip)],
          components: buildPermissionRolesComponents(interaction.user.id, 0, undefined, fromApi),
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
        fromApi,
      });
      return;
    }

    const all = listAllPermissions();
    const idx = all.findIndex((p) => p.key === perm.key);
    const permPage = Math.max(0, Math.floor(idx / 23));
    const opts = { fromApi, scannedCount: roles.length };

    if (fromApi) {
      if (plain) {
        await interaction.reply({
          content: buildPermissionRolesText(perm, roles, guildName, opts),
          embeds: [],
          components: buildPermissionRolesComponents(interaction.user.id, permPage, perm.key, fromApi),
          ephemeral,
        });
      } else {
        await interaction.reply({
          embeds: [buildPermissionRolesEmbed(perm, roles, guildName, opts)],
          components: buildPermissionRolesComponents(interaction.user.id, permPage, perm.key, fromApi),
          ephemeral,
        });
      }
    } else {
      // No API list yet — permission chosen; wait for Role Select (Discord lists every role)
      const content = buildPermissionPromptText(guildName, false, perm.label);
      await interaction.reply({
        content,
        embeds: [],
        components: buildPermissionRolesComponents(interaction.user.id, permPage, perm.key, false),
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
      fromApi,
    });
  },
};

export default command;
