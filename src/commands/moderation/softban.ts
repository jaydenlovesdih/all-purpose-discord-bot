import { PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import { Command } from '../../types/index.js';
import { sendInvoke } from '../../utils/moderation.js';
import { successEmbed, errorEmbed } from '../../utils/embeds.js';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('softban')
    .setDescription('Ban then unban a user to delete messages')
    .addUserOption((opt) => opt.setName('user').setDescription('Member').setRequired(true))
    .addStringOption((opt) => opt.setName('reason').setDescription('Reason')),
  permissions: [PermissionFlagsBits.BanMembers],
  guildOnly: true,
  async execute(interaction) {
    const user = interaction.options.getUser('user', true);
    const reason = interaction.options.getString('reason') ?? 'No reason provided';

    try {
      await interaction.guild!.members.ban(user.id, { deleteMessageSeconds: 7 * 86400, reason: `Softban: ${reason}` });
      await interaction.guild!.members.unban(user.id, 'Softban complete');
    } catch {
      await interaction.reply({ embeds: [errorEmbed('Could not softban that user.')], ephemeral: true });
      return;
    }

    const used = await sendInvoke(
      { guild: interaction.guild!, action: 'softban', user, moderator: interaction.user, reason },
      interaction.channel?.isTextBased() ? (interaction.channel as import('discord.js').TextChannel) : null,
    );

    if (!used) {
      await interaction.reply({ embeds: [successEmbed(`Softbanned **${user.tag}**\n**Reason:** ${reason}`)] });
    } else if (!interaction.replied) {
      await interaction.reply({ content: 'Done.', ephemeral: true });
    }
  },
};

export default command;
