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
    const needsRoleMenus = !fromApi;

    if (!raw?.trim()) {
      const content = buildPermissionPromptText(guildName, roles.length);
      await interaction.reply({
        ...(plain
          ? { content, embeds: [] }
          : {
              content: needsRoleMenus ? content : undefined,
              embeds: [
                fail(
                  interaction.user,
                  roles.length
                    ? 'Pick a permission from the dropdown to see which roles have it.'
                    : 'Pick a permission, then select roles from the menus (Discord lists every role).',
                ),
              ],
            }),
        components: buildPermissionRolesComponents(
          interaction.user.id,
          0,
          undefined,
          needsRoleMenus,
        ),
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
      await interaction.reply({
        ...(plain
          ? { content: tip, embeds: [] }
          : { embeds: [fail(interaction.user, tip)] }),
        components: buildPermissionRolesComponents(
          interaction.user.id,
          0,
          undefined,
          needsRoleMenus,
        ),
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

    const all = listAllPermissions();
    const idx = all.findIndex((p) => p.key === perm.key);
    const permPage = Math.max(0, Math.floor(idx / 23));
    const components = buildPermissionRolesComponents(
      interaction.user.id,
      permPage,
      perm.key,
      needsRoleMenus,
    );

    if (roles.length) {
      if (plain || needsRoleMenus) {
        await interaction.reply({
          content: buildPermissionRolesText(perm, roles, guildName),
          embeds: [],
          components,
          ephemeral,
        });
      } else {
        await interaction.reply({
          embeds: [buildPermissionRolesEmbed(perm, roles, guildName)],
          components,
          ephemeral,
        });
      }
    } else {
      const content = [
        `**Roles with ${perm.label}**`,
        `Server: ${guildName}`,
        '',
        'Discord lists **every role** in the menus below.',
        'Select roles (up to 100 across the menus) — matching ones show here instantly.',
      ].join('\n');
      await interaction.reply({
        content,
        embeds: [],
        components,
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
