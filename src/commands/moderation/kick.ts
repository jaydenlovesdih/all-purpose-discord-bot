import { PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import { Command } from '../../types/index.js';
import { canBypass } from '../../utils/permissions.js';
import { successEmbed, errorEmbed } from '../../utils/embeds.js';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('kick')
    .setDescription('Kick a member from the server')
    .addUserOption((opt) => opt.setName('user').setDescription('Member to kick').setRequired(true))
    .addStringOption((opt) => opt.setName('reason').setDescription('Reason for the kick')),
  permissions: [PermissionFlagsBits.KickMembers],
  guildOnly: true,
  async execute(interaction) {
    const user = interaction.options.getUser('user', true);
    const reason = interaction.options.getString('reason') ?? 'No reason provided';
    const member = interaction.guild!.members.cache.get(user.id);

    if (!member) {
      await interaction.reply({ embeds: [errorEmbed('That user is not in this server.')], ephemeral: true });
      return;
    }

    if (!canBypass(interaction.user.id)) {
      if (!member.kickable) {
        await interaction.reply({ embeds: [errorEmbed('I cannot kick this member.')], ephemeral: true });
        return;
      }
      if (member.roles.highest.position >= (interaction.member as import('discord.js').GuildMember).roles.highest.position) {
        await interaction.reply({ embeds: [errorEmbed('You cannot kick someone with equal or higher roles.')], ephemeral: true });
        return;
      }
    }

    await member.kick(reason);
    await interaction.reply({
      embeds: [successEmbed(`Kicked **${user.tag}**\n**Reason:** ${reason}`)],
    });
  },
};

export default command;
