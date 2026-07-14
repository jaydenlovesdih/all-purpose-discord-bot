import { PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import { Command } from '../../types/index.js';
import { canBypass } from '../../utils/permissions.js';
import { sendInvoke } from '../../utils/moderation.js';
import { parseDurationMs, formatDuration } from '../../utils/duration.js';
import { fail } from '../../utils/embeds.js';
import { buildModButtons, buildModEmbed } from '../../utils/modResponse.js';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('timeout')
    .setDescription('Timeout a member (duration: 1h, 30m, 1d)')
    .addUserOption((opt) => opt.setName('user').setDescription('Member').setRequired(true))
    .addStringOption((opt) =>
      opt.setName('duration').setDescription('Duration like 1h, 30m, 2d').setRequired(true),
    )
    .addStringOption((opt) => opt.setName('reason').setDescription('Reason')),
  permissions: [PermissionFlagsBits.ModerateMembers],
  guildOnly: true,
  async execute(interaction) {
    const user = interaction.options.getUser('user', true);
    const durationRaw = interaction.options.getString('duration', true);
    const reason = interaction.options.getString('reason') ?? 'No reason provided';
    const ms = parseDurationMs(durationRaw);

    if (!ms || ms < 5_000 || ms > 28 * 86_400_000) {
      await interaction.reply({
        embeds: [fail(interaction.user, 'Invalid duration. Examples: `10m`, `1h`, `1d`, `2d3h`')],
        ephemeral: true,
      });
      return;
    }

    let member = interaction.guild!.members.cache.get(user.id) ?? null;
    if (!member) member = await interaction.guild!.members.fetch(user.id).catch(() => null);
    if (!member) {
      await interaction.reply({ embeds: [fail(interaction.user, 'That user is not in this server')], ephemeral: true });
      return;
    }

    if (
      !canBypass(interaction.user.id) &&
      member.roles.highest.position >= (interaction.member as import('discord.js').GuildMember).roles.highest.position
    ) {
      await interaction.reply({ embeds: [fail(interaction.user, 'You cannot timeout this member')], ephemeral: true });
      return;
    }

    await member.timeout(ms, reason);
    await sendInvoke(
      {
        guild: interaction.guild!,
        action: 'timeout',
        user,
        moderator: interaction.user,
        reason,
        extra: { duration: formatDuration(ms) },
      },
      null,
    );

    const embed = buildModEmbed({
      action: 'timeout',
      target: user,
      moderator: interaction.user,
      reason,
      member,
      extraLine: `Duration: \`${formatDuration(ms)}\``,
      botName: interaction.client.user?.username,
    });
    const row = buildModButtons('timeout', user.id);
    await interaction.reply({ embeds: [embed], components: row ? [row] : [] });
  },
};

export default command;
