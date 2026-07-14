import { PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import { Command } from '../../types/index.js';
import { canBypass } from '../../utils/permissions.js';
import { fail } from '../../utils/embeds.js';
import { buildModButtons, buildModEmbed } from '../../utils/modResponse.js';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('role')
    .setDescription('Add or remove a role from a member')
    .addUserOption((opt) => opt.setName('user').setDescription('Target member').setRequired(true))
    .addRoleOption((opt) => opt.setName('role').setDescription('Role to toggle').setRequired(true))
    .addStringOption((opt) => opt.setName('reason').setDescription('Reason')),
  permissions: [PermissionFlagsBits.ManageRoles],
  guildOnly: true,
  async execute(interaction) {
    const user = interaction.options.getUser('user', true);
    const roleId = interaction.options.getRole('role', true).id;
    const reason = interaction.options.getString('reason') ?? 'No reason provided';
    const role = interaction.guild!.roles.cache.get(roleId);
    const member = interaction.guild!.members.cache.get(user.id);

    if (!role) {
      await interaction.reply({ embeds: [fail(interaction.user, 'Role not found in this server')], ephemeral: true });
      return;
    }

    if (!member) {
      await interaction.reply({ embeds: [fail(interaction.user, 'User not found in this server')], ephemeral: true });
      return;
    }

    if (
      !canBypass(interaction.user.id) &&
      role.position >= (interaction.member as import('discord.js').GuildMember).roles.highest.position
    ) {
      await interaction.reply({
        embeds: [fail(interaction.user, 'You cannot manage a role equal to or above your highest role')],
        ephemeral: true,
      });
      return;
    }

    const removing = member.roles.cache.has(role.id);
    if (removing) await member.roles.remove(role, reason);
    else await member.roles.add(role, reason);

    const action = removing ? 'roleremove' : 'roleadd';
    const embed = buildModEmbed({
      action,
      target: user,
      moderator: interaction.user,
      reason,
      member,
      detail: { name: '🎭 Role:', value: `${role}` },
      botName: interaction.client.user?.username,
    });
    const row = buildModButtons(action, user.id);
    await interaction.reply({ embeds: [embed], components: row ? [row] : [] });
  },
};

export default command;
