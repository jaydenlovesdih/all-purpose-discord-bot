import { PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import { Command } from '../../types/index.js';
import { getGuildConfig, mutateGuildConfig } from '../../utils/guildConfig.js';
import { sendInvoke, stripRoles } from '../../utils/moderation.js';
import { canBypass } from '../../utils/permissions.js';
import { ok, fail } from '../../utils/embeds.js';
import { buildModButtons, buildModEmbed, usageEmbed } from '../../utils/modResponse.js';
import { getPrefix } from '../../utils/setup.js';
import { config } from '../../config.js';

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
    const prefix = getPrefix(guild.id, config.prefix);

    if (action === 'channel') {
      mutateGuildConfig(guild.id, (c) => {
        c.jailChannelId = interaction.channelId;
      });
      await interaction.reply({ embeds: [ok(interaction.user, `jail channel set to ${interaction.channel}`)] });
      return;
    }

    if (action === 'role') {
      const role = interaction.options.getRole('role');
      if (!role) {
        await interaction.reply({ embeds: [fail(interaction.user, 'Provide a role')], ephemeral: true });
        return;
      }
      mutateGuildConfig(guild.id, (c) => {
        c.jailRoleId = role.id;
      });
      await interaction.reply({ embeds: [ok(interaction.user, `jail role set to **${role.name}**`)] });
      return;
    }

    const user = interaction.options.getUser('user');
    if (!user) {
      await interaction.reply({
        embeds: [usageEmbed('jail', `${prefix}jail @user [reason]`, prefix)],
        ephemeral: true,
      });
      return;
    }

    const member = guild.members.cache.get(user.id);
    const cfg = getGuildConfig(guild.id);
    if (!member || !cfg.jailRoleId) {
      await interaction.reply({
        embeds: [fail(interaction.user, `Member not found or run \`${prefix}setup\` first`)],
        ephemeral: true,
      });
      return;
    }

    if (
      !canBypass(interaction.user.id) &&
      member.roles.highest.position >= (interaction.member as import('discord.js').GuildMember).roles.highest.position
    ) {
      await interaction.reply({ embeds: [fail(interaction.user, 'You cannot jail this member')], ephemeral: true });
      return;
    }

    const reason = interaction.options.getString('reason') ?? 'No reason provided';
    const previous = member.roles.cache.filter((r) => r.id !== guild.id).map((r) => r.id);
    mutateGuildConfig(guild.id, (c) => {
      c.jailedRoles[user.id] = previous;
    });
    await stripRoles(member, cfg.jailRoleId);
    await member.roles.add(cfg.jailRoleId, reason);

    await sendInvoke({ guild, action: 'jail', user, moderator: interaction.user, reason }, null);

    const embed = buildModEmbed({
      action: 'jail',
      target: user,
      moderator: interaction.user,
      reason,
      member,
      botName: interaction.client.user?.username,
    });
    const row = buildModButtons('jail', user.id);
    await interaction.reply({ embeds: [embed], components: row ? [row] : [] });
  },
};

export default command;
