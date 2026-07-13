import { PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import { Command } from '../../types/index.js';
import { addWarning, getWarnings } from '../../utils/warnings.js';
import { sendInvoke } from '../../utils/moderation.js';
import { successEmbed } from '../../utils/embeds.js';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('warn')
    .setDescription('Warn a member')
    .addUserOption((opt) => opt.setName('user').setDescription('Member to warn').setRequired(true))
    .addStringOption((opt) => opt.setName('reason').setDescription('Reason').setRequired(true)),
  permissions: [PermissionFlagsBits.ModerateMembers],
  guildOnly: true,
  async execute(interaction) {
    const user = interaction.options.getUser('user', true);
    const reason = interaction.options.getString('reason', true);

    addWarning(interaction.guildId!, user.id, interaction.user.id, reason);
    const count = getWarnings(interaction.guildId!, user.id).length;

    const used = await sendInvoke(
      {
        guild: interaction.guild!,
        action: 'warn',
        user,
        moderator: interaction.user,
        reason,
        extra: { warning_count: count },
      },
      interaction.channel?.isTextBased() ? (interaction.channel as import('discord.js').TextChannel) : null,
    );

    if (!used) {
      await interaction.reply({
        embeds: [successEmbed(`Warned **${user.tag}** (warning #${count})\n**Reason:** ${reason}`)],
      });
    } else if (!interaction.replied) {
      await interaction.reply({ content: 'Done.', ephemeral: true });
    }
  },
};

export default command;
