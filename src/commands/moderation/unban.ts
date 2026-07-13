import { PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import { Command } from '../../types/index.js';
import { sendInvoke } from '../../utils/moderation.js';
import { successEmbed, errorEmbed } from '../../utils/embeds.js';

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
      const used = await sendInvoke(
        { guild: interaction.guild!, action: 'unban', user, moderator: interaction.user, reason },
        interaction.channel?.isTextBased() ? (interaction.channel as import('discord.js').TextChannel) : null,
      );
      if (!used) {
        await interaction.reply({ embeds: [successEmbed(`Unbanned **${user.tag}**`)] });
      } else if (!interaction.replied) {
        await interaction.reply({ content: 'Done.', ephemeral: true });
      }
    } catch {
      await interaction.reply({ embeds: [errorEmbed('Could not unban that user ID.')], ephemeral: true });
    }
  },
};

export default command;
