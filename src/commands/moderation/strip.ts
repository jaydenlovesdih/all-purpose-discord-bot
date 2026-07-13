import { PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import { Command } from '../../types/index.js';
import { stripRoles, sendInvoke } from '../../utils/moderation.js';
import { canBypass } from '../../utils/permissions.js';
import { successEmbed, errorEmbed } from '../../utils/embeds.js';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('strip')
    .setDescription('Remove all roles from a member')
    .addUserOption((opt) => opt.setName('user').setDescription('Member').setRequired(true))
    .addStringOption((opt) => opt.setName('reason').setDescription('Reason')),
  permissions: [PermissionFlagsBits.ManageRoles],
  guildOnly: true,
  async execute(interaction) {
    const user = interaction.options.getUser('user', true);
    const reason = interaction.options.getString('reason') ?? 'No reason provided';
    const member = interaction.guild!.members.cache.get(user.id);

    if (!member) {
      await interaction.reply({ embeds: [errorEmbed('User not in this server.')], ephemeral: true });
      return;
    }

    if (!canBypass(interaction.user.id) && member.roles.highest.position >= (interaction.member as import('discord.js').GuildMember).roles.highest.position) {
      await interaction.reply({ embeds: [errorEmbed('You cannot strip this member.')], ephemeral: true });
      return;
    }

    const removed = await stripRoles(member);
    const used = await sendInvoke(
      { guild: interaction.guild!, action: 'strip', user, moderator: interaction.user, reason, extra: { roles_removed: removed.length } },
      interaction.channel?.isTextBased() ? (interaction.channel as import('discord.js').TextChannel) : null,
    );

    if (!used) {
      await interaction.reply({ embeds: [successEmbed(`Stripped **${removed.length}** role(s) from **${user.tag}**`)] });
    } else if (!interaction.replied) {
      await interaction.reply({ content: 'Done.', ephemeral: true });
    }
  },
};

export default command;
