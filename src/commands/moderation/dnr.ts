import { PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import { Command } from '../../types/index.js';
import { getDnr, setDnr } from '../../utils/dnr.js';
import { sendInvoke } from '../../utils/moderation.js';
import { fail } from '../../utils/embeds.js';
import { buildModButtons, buildModEmbed } from '../../utils/modResponse.js';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('dnr')
    .setDescription('Do Not Reply — auto-warn anyone who replies to your messages')
    .addUserOption((opt) =>
      opt.setName('user').setDescription('Member who must not reply to you').setRequired(true),
    )
    .addStringOption((opt) => opt.setName('reason').setDescription('Reason for the DNR')),
  permissions: [PermissionFlagsBits.ModerateMembers],
  guildOnly: true,
  async execute(interaction) {
    const user = interaction.options.getUser('user', true);
    const reason = interaction.options.getString('reason') ?? 'No reason provided';
    const guild = interaction.guild!;
    const member = guild.members.cache.get(user.id) ?? null;

    if (user.id === interaction.user.id) {
      await interaction.reply({
        embeds: [fail(interaction.user, 'You cannot DNR yourself')],
        ephemeral: true,
      });
      return;
    }

    if (user.bot) {
      await interaction.reply({
        embeds: [fail(interaction.user, 'You cannot DNR a bot')],
        ephemeral: true,
      });
      return;
    }

    const existing = getDnr(guild.id, interaction.user.id, user.id);
    setDnr(guild.id, interaction.user.id, user.id, reason, interaction.user.id);

    await sendInvoke(
      {
        guild,
        action: 'dnr',
        user,
        moderator: interaction.user,
        reason,
      },
      null,
    );

    const embed = buildModEmbed({
      action: 'dnr',
      target: user,
      moderator: interaction.user,
      reason,
      member,
      extraLine: existing
        ? 'DNR updated — replies to you will be deleted and warned.'
        : 'Replies to your messages will be deleted and auto-warned (jail at 3 strikes).',
      botName: interaction.client.user?.username,
      detail: { name: '🚫 Protecting:', value: `${interaction.user}` },
    });
    const row = buildModButtons('dnr', user.id, { protectorId: interaction.user.id });

    await interaction.reply({
      embeds: [embed],
      components: row ? [row] : [],
    });
  },
};

export default command;
