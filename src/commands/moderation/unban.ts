import { PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import { Command } from '../../types/index.js';
import { sendInvoke } from '../../utils/moderation.js';
import { fail } from '../../utils/embeds.js';
import { buildModButtons, buildModEmbed } from '../../utils/modResponse.js';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('unban')
    .setDescription('Unban a user by ID')
    .addStringOption((opt) => opt.setName('userid').setDescription('User ID').setRequired(true))
    .addStringOption((opt) => opt.setName('reason').setDescription('Reason')),
  permissions: [PermissionFlagsBits.BanMembers],
  guildOnly: true,
  async execute(interaction) {
    const userId = interaction.options.getString('userid', true);
    const reason = interaction.options.getString('reason') ?? 'No reason provided';

    try {
      const user = await interaction.client.users.fetch(userId);
      await interaction.guild!.members.unban(userId, reason);
      await sendInvoke(
        { guild: interaction.guild!, action: 'unban', user, moderator: interaction.user, reason },
        null,
      );

      const embed = buildModEmbed({
        action: 'unban',
        target: user,
        moderator: interaction.user,
        reason,
        botName: interaction.client.user?.username,
      });
      const row = buildModButtons('unban', user.id);
      await interaction.reply({ embeds: [embed], components: row ? [row] : [] });
    } catch {
      await interaction.reply({ embeds: [fail(interaction.user, 'Could not unban that user ID')], ephemeral: true });
    }
  },
};

export default command;
