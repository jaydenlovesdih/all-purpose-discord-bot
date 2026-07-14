import { PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import { Command } from '../../types/index.js';
import { addWarning, getWarnings } from '../../utils/warnings.js';
import { sendInvoke } from '../../utils/moderation.js';
import { buildModButtons, buildModEmbed } from '../../utils/modResponse.js';

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
    const member = interaction.guild!.members.cache.get(user.id) ?? null;

    addWarning(interaction.guildId!, user.id, interaction.user.id, reason);
    const count = getWarnings(interaction.guildId!, user.id).length;

    await sendInvoke(
      {
        guild: interaction.guild!,
        action: 'warn',
        user,
        moderator: interaction.user,
        reason,
        extra: { warning_count: count },
      },
      null,
    );

    const embed = buildModEmbed({
      action: 'warn',
      target: user,
      moderator: interaction.user,
      reason,
      member,
      extraLine: `Warning #${count}`,
      botName: interaction.client.user?.username,
    });
    const row = buildModButtons('warn', user.id);
    await interaction.reply({ embeds: [embed], components: row ? [row] : [] });
  },
};

export default command;
