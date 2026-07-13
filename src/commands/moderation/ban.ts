import { PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import { Command } from '../../types/index.js';
import { canBypass } from '../../utils/permissions.js';
import { successEmbed, errorEmbed } from '../../utils/embeds.js';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('ban')
    .setDescription('Ban a member from the server')
    .addUserOption((opt) => opt.setName('user').setDescription('Member to ban').setRequired(true))
    .addStringOption((opt) => opt.setName('reason').setDescription('Reason for the ban'))
    .addIntegerOption((opt) =>
      opt.setName('delete_days').setDescription('Days of messages to delete (0-7)').setMinValue(0).setMaxValue(7),
    ),
  permissions: [PermissionFlagsBits.BanMembers],
  guildOnly: true,
  async execute(interaction) {
    const user = interaction.options.getUser('user', true);
    const reason = interaction.options.getString('reason') ?? 'No reason provided';
    const deleteDays = interaction.options.getInteger('delete_days') ?? 0;
    const member = interaction.guild!.members.cache.get(user.id);

    if (user.id === interaction.user.id) {
      await interaction.reply({ embeds: [errorEmbed('You cannot ban yourself.')], ephemeral: true });
      return;
    }

    if (member && !canBypass(interaction.user.id)) {
      if (!member.bannable) {
        await interaction.reply({ embeds: [errorEmbed('I cannot ban this member.')], ephemeral: true });
        return;
      }
      if (member.roles.highest.position >= (interaction.member as import('discord.js').GuildMember).roles.highest.position) {
        await interaction.reply({ embeds: [errorEmbed('You cannot ban someone with equal or higher roles.')], ephemeral: true });
        return;
      }
    }

    await interaction.guild!.members.ban(user.id, { deleteMessageSeconds: deleteDays * 86400, reason });
    await interaction.reply({
      embeds: [successEmbed(`Banned **${user.tag}**\n**Reason:** ${reason}`)],
    });
  },
};

export default command;
