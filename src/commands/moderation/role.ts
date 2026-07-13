import { PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import { Command } from '../../types/index.js';
import { canBypass } from '../../utils/permissions.js';
import { successEmbed, errorEmbed } from '../../utils/embeds.js';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('role')
    .setDescription('Add or remove a role from a member')
    .addUserOption((opt) => opt.setName('user').setDescription('Target member').setRequired(true))
    .addRoleOption((opt) => opt.setName('role').setDescription('Role to toggle').setRequired(true)),
  permissions: [PermissionFlagsBits.ManageRoles],
  guildOnly: true,
  async execute(interaction) {
    const user = interaction.options.getUser('user', true);
    const roleId = interaction.options.getRole('role', true).id;
    const role = interaction.guild!.roles.cache.get(roleId);
    const member = interaction.guild!.members.cache.get(user.id);

    if (!role) {
      await interaction.reply({ embeds: [errorEmbed('Role not found in this server.')], ephemeral: true });
      return;
    }

    if (!member) {
      await interaction.reply({ embeds: [errorEmbed('User not found in this server.')], ephemeral: true });
      return;
    }

    if (!canBypass(interaction.user.id) && role.position >= (interaction.member as import('discord.js').GuildMember).roles.highest.position) {
      await interaction.reply({ embeds: [errorEmbed('You cannot manage a role equal to or above your highest role.')], ephemeral: true });
      return;
    }

    if (member.roles.cache.has(role.id)) {
      await member.roles.remove(role);
      await interaction.reply({ embeds: [successEmbed(`Removed **${role.name}** from **${user.tag}**`)] });
    } else {
      await member.roles.add(role);
      await interaction.reply({ embeds: [successEmbed(`Added **${role.name}** to **${user.tag}**`)] });
    }
  },
};

export default command;
