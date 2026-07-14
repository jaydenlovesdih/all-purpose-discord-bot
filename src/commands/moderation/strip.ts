import { PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import { Command } from '../../types/index.js';
import { stripRoles, sendInvoke } from '../../utils/moderation.js';
import { canBypass } from '../../utils/permissions.js';
import { fail } from '../../utils/embeds.js';
import { buildModButtons, buildModEmbed } from '../../utils/modResponse.js';

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
      await interaction.reply({ embeds: [fail(interaction.user, 'User not in this server')], ephemeral: true });
      return;
    }

    if (
      !canBypass(interaction.user.id) &&
      member.roles.highest.position >= (interaction.member as import('discord.js').GuildMember).roles.highest.position
    ) {
      await interaction.reply({ embeds: [fail(interaction.user, 'You cannot strip this member')], ephemeral: true });
      return;
    }

    const removed = await stripRoles(member);
    await sendInvoke(
      {
        guild: interaction.guild!,
        action: 'strip',
        user,
        moderator: interaction.user,
        reason,
        extra: { roles_removed: removed.length },
      },
      null,
    );

    const embed = buildModEmbed({
      action: 'strip',
      target: user,
      moderator: interaction.user,
      reason,
      member,
      extraLine: `Removed **${removed.length}** role(s)`,
      botName: interaction.client.user?.username,
    });
    const row = buildModButtons('strip', user.id);
    await interaction.reply({ embeds: [embed], components: row ? [row] : [] });
  },
};

export default command;
