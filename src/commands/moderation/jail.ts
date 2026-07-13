import { PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import { Command } from '../../types/index.js';
import { getGuildConfig, mutateGuildConfig } from '../../utils/guildConfig.js';
import { sendInvoke, stripRoles } from '../../utils/moderation.js';
import { canBypass } from '../../utils/permissions.js';
import { successEmbed, errorEmbed } from '../../utils/embeds.js';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('jail')
    .setDescription('Jail a member or configure jail settings')
    .addUserOption((opt) => opt.setName('user').setDescription('Member to jail'))
    .addStringOption((opt) => opt.setName('reason').setDescription('Reason'))
    .addStringOption((opt) =>
      opt
        .setName('action')
        .setDescription('Optional: channel / role config')
        .addChoices(
          { name: 'Set jail channel (current channel)', value: 'channel' },
          { name: 'Use mentioned role as jail role', value: 'role' },
        ),
    )
    .addRoleOption((opt) => opt.setName('role').setDescription('Jail role when action=role')),
  permissions: [PermissionFlagsBits.ModerateMembers],
  guildOnly: true,
  async execute(interaction) {
    const action = interaction.options.getString('action');
    const guild = interaction.guild!;

    if (action === 'channel') {
      mutateGuildConfig(guild.id, (c) => {
        c.jailChannelId = interaction.channelId;
      });
      await interaction.reply({ embeds: [successEmbed(`Jail channel set to ${interaction.channel}`)] });
      return;
    }

    if (action === 'role') {
      const role = interaction.options.getRole('role');
      if (!role) {
        await interaction.reply({ embeds: [errorEmbed('Provide a role.')], ephemeral: true });
        return;
      }
      mutateGuildConfig(guild.id, (c) => {
        c.jailRoleId = role.id;
      });
      await interaction.reply({ embeds: [successEmbed(`Jail role set to **${role.name}**`)] });
      return;
    }

    const user = interaction.options.getUser('user');
    if (!user) {
      await interaction.reply({
        embeds: [errorEmbed('Usage: `.jail @user [reason]` or `/jail user:@user`')],
        ephemeral: true,
      });
      return;
    }

    const member = guild.members.cache.get(user.id);
    const cfg = getGuildConfig(guild.id);
    if (!member || !cfg.jailRoleId) {
      await interaction.reply({
        embeds: [errorEmbed('Member not found or run `.setup` first.')],
        ephemeral: true,
      });
      return;
    }

    if (!canBypass(interaction.user.id) && member.roles.highest.position >= (interaction.member as import('discord.js').GuildMember).roles.highest.position) {
      await interaction.reply({ embeds: [errorEmbed('You cannot jail this member.')], ephemeral: true });
      return;
    }

    const reason = interaction.options.getString('reason') ?? 'No reason provided';
    const previous = member.roles.cache.filter((r) => r.id !== guild.id).map((r) => r.id);
    mutateGuildConfig(guild.id, (c) => {
      c.jailedRoles[user.id] = previous;
    });
    await stripRoles(member, cfg.jailRoleId);
    await member.roles.add(cfg.jailRoleId, reason);

    const used = await sendInvoke(
      { guild, action: 'jail', user, moderator: interaction.user, reason },
      interaction.channel?.isTextBased() ? (interaction.channel as import('discord.js').TextChannel) : null,
    );

    if (!used) {
      await interaction.reply({ embeds: [successEmbed(`Jailed **${user.tag}**\n**Reason:** ${reason}`)] });
    } else if (!interaction.replied) {
      await interaction.reply({ content: 'Done.', ephemeral: true });
    }
  },
};

export default command;
