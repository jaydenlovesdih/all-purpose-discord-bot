import { PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import { Command } from '../../types/index.js';
import { getDnr, removeDnr } from '../../utils/dnr.js';
import { sendInvoke } from '../../utils/moderation.js';
import { fail } from '../../utils/embeds.js';
import { buildModButtons, buildModEmbed } from '../../utils/modResponse.js';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('undnr')
    .setDescription('Remove a Do Not Reply restriction you placed on a member')
    .addUserOption((opt) =>
      opt.setName('user').setDescription('Member to allow replies from again').setRequired(true),
    )
    .addStringOption((opt) => opt.setName('reason').setDescription('Reason')),
  permissions: [PermissionFlagsBits.ModerateMembers],
  guildOnly: true,
  async execute(interaction) {
    const user = interaction.options.getUser('user', true);
    const reason = interaction.options.getString('reason') ?? 'No reason provided';
    const guild = interaction.guild!;
    const member = guild.members.cache.get(user.id) ?? null;

    const existing = getDnr(guild.id, interaction.user.id, user.id);
    if (!existing) {
      await interaction.reply({
        embeds: [fail(interaction.user, `You do not have an active DNR on **${user.username}**`)],
        ephemeral: true,
      });
      return;
    }

    removeDnr(guild.id, interaction.user.id, user.id);

    await sendInvoke(
      {
        guild,
        action: 'undnr',
        user,
        moderator: interaction.user,
        reason,
      },
      null,
    );

    const embed = buildModEmbed({
      action: 'undnr',
      target: user,
      moderator: interaction.user,
      reason,
      member,
      extraLine: existing.strikes
        ? `Removed after **${existing.strikes}** strike(s).`
        : undefined,
      botName: interaction.client.user?.username,
      detail: { name: '🚫 Was protecting:', value: `${interaction.user}` },
    });
    const row = buildModButtons('undnr', user.id, { protectorId: interaction.user.id });

    await interaction.reply({
      embeds: [embed],
      components: row ? [row] : [],
    });
  },
};

export default command;
