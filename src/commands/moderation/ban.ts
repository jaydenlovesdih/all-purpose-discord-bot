import { PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import { Command } from '../../types/index.js';
import { canBypass } from '../../utils/permissions.js';
import { sendInvoke } from '../../utils/moderation.js';
import { fail } from '../../utils/embeds.js';
import { buildModButtons, buildModEmbed } from '../../utils/modResponse.js';

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
    const member = interaction.guild!.members.cache.get(user.id) ?? null;

    if (user.id === interaction.user.id) {
      await interaction.reply({ embeds: [fail(interaction.user, 'You cannot ban yourself')], ephemeral: true });
      return;
    }

    if (member && !canBypass(interaction.user.id)) {
      if (!member.bannable) {
        await interaction.reply({ embeds: [fail(interaction.user, 'I cannot ban this member')], ephemeral: true });
        return;
      }
      if (
        member.roles.highest.position >=
        (interaction.member as import('discord.js').GuildMember).roles.highest.position
      ) {
        await interaction.reply({
          embeds: [fail(interaction.user, 'You cannot ban someone with equal or higher roles')],
          ephemeral: true,
        });
        return;
      }
    }

    await interaction.guild!.members.ban(user.id, { deleteMessageSeconds: deleteDays * 86400, reason });
    await sendInvoke(
      { guild: interaction.guild!, action: 'ban', user, moderator: interaction.user, reason },
      null,
    );

    const embed = buildModEmbed({
      action: 'ban',
      target: user,
      moderator: interaction.user,
      reason,
      member,
      botName: interaction.client.user?.username,
    });
    const row = buildModButtons('ban', user.id);

    await interaction.reply({
      embeds: [embed],
      components: row ? [row] : [],
    });
  },
};

export default command;
