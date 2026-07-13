import { PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import { Command } from '../../types/index.js';
import { sendInvoke } from '../../utils/moderation.js';
import { successEmbed, errorEmbed } from '../../utils/embeds.js';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('unmute')
    .setDescription('Remove timeout from a member')
    .addUserOption((opt) => opt.setName('user').setDescription('Member to unmute').setRequired(true)),
  permissions: [PermissionFlagsBits.ModerateMembers],
  guildOnly: true,
  async execute(interaction) {
    const user = interaction.options.getUser('user', true);
    const member = interaction.guild!.members.cache.get(user.id);

    if (!member) {
      await interaction.reply({ embeds: [errorEmbed('That user is not in this server.')], ephemeral: true });
      return;
    }

    if (!member.isCommunicationDisabled()) {
      await interaction.reply({ embeds: [errorEmbed('That member is not muted.')], ephemeral: true });
      return;
    }

    await member.timeout(null);
    const used = await sendInvoke(
      { guild: interaction.guild!, action: 'untimeout', user, moderator: interaction.user, reason: 'Unmuted' },
      interaction.channel?.isTextBased() ? (interaction.channel as import('discord.js').TextChannel) : null,
    );
    if (!used) {
      await interaction.reply({ embeds: [successEmbed(`Unmuted **${user.tag}**`)] });
    } else if (!interaction.replied) {
      await interaction.reply({ content: 'Done.', ephemeral: true });
    }
  },
};

export default command;
