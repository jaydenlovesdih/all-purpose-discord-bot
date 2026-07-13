import { PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import { Command } from '../../types/index.js';
import { canBypass } from '../../utils/permissions.js';
import { sendInvoke } from '../../utils/moderation.js';
import { successEmbed, errorEmbed } from '../../utils/embeds.js';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('mute')
    .setDescription('Timeout a member')
    .addUserOption((opt) => opt.setName('user').setDescription('Member to mute').setRequired(true))
    .addIntegerOption((opt) =>
      opt.setName('minutes').setDescription('Duration in minutes').setRequired(true).setMinValue(1).setMaxValue(40320),
    )
    .addStringOption((opt) => opt.setName('reason').setDescription('Reason for the mute')),
  permissions: [PermissionFlagsBits.ModerateMembers],
  guildOnly: true,
  async execute(interaction) {
    const user = interaction.options.getUser('user', true);
    const minutes = interaction.options.getInteger('minutes', true);
    const reason = interaction.options.getString('reason') ?? 'No reason provided';
    const member = interaction.guild!.members.cache.get(user.id);

    if (!member) {
      await interaction.reply({ embeds: [errorEmbed('That user is not in this server.')], ephemeral: true });
      return;
    }

    if (
      !canBypass(interaction.user.id) &&
      member.roles.highest.position >= (interaction.member as import('discord.js').GuildMember).roles.highest.position
    ) {
      await interaction.reply({ embeds: [errorEmbed('You cannot mute someone with equal or higher roles.')], ephemeral: true });
      return;
    }

    await member.timeout(minutes * 60_000, reason);
    const used = await sendInvoke(
      {
        guild: interaction.guild!,
        action: 'timeout',
        user,
        moderator: interaction.user,
        reason,
        extra: { duration: `${minutes}m` },
      },
      interaction.channel?.isTextBased() ? (interaction.channel as import('discord.js').TextChannel) : null,
    );
    if (!used) {
      await interaction.reply({
        embeds: [successEmbed(`Muted **${user.tag}** for **${minutes}** minute(s)\n**Reason:** ${reason}`)],
      });
    } else if (!interaction.replied) {
      await interaction.reply({ content: 'Done.', ephemeral: true });
    }
  },
};

export default command;
