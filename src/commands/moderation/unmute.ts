import { PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import { Command } from '../../types/index.js';
import { sendInvoke } from '../../utils/moderation.js';
import { fail } from '../../utils/embeds.js';
import { buildModButtons, buildModEmbed } from '../../utils/modResponse.js';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('unmute')
    .setDescription('Remove timeout from a member')
    .addUserOption((opt) => opt.setName('user').setDescription('Member to unmute').setRequired(true))
    .addStringOption((opt) => opt.setName('reason').setDescription('Reason')),
  permissions: [PermissionFlagsBits.ModerateMembers],
  guildOnly: true,
  async execute(interaction) {
    const user = interaction.options.getUser('user', true);
    const reason = interaction.options.getString('reason') ?? 'No reason provided';
    const member = interaction.guild!.members.cache.get(user.id);

    if (!member) {
      await interaction.reply({ embeds: [fail(interaction.user, 'That user is not in this server')], ephemeral: true });
      return;
    }

    if (!member.isCommunicationDisabled()) {
      await interaction.reply({ embeds: [fail(interaction.user, 'That member is not muted')], ephemeral: true });
      return;
    }

    await member.timeout(null, reason);
    await sendInvoke(
      { guild: interaction.guild!, action: 'untimeout', user, moderator: interaction.user, reason },
      null,
    );

    const embed = buildModEmbed({
      action: 'unmute',
      target: user,
      moderator: interaction.user,
      reason,
      member,
      botName: interaction.client.user?.username,
    });
    const row = buildModButtons('unmute', user.id);
    await interaction.reply({ embeds: [embed], components: row ? [row] : [] });
  },
};

export default command;
