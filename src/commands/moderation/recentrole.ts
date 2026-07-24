import { PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import { Command } from '../../types/index.js';
import { canBypass } from '../../utils/permissions.js';
import { fail, ok } from '../../utils/embeds.js';
import { resolveRole } from '../../utils/resolveRole.js';
import { sendModLog } from '../../utils/moderation.js';

const WINDOW_MS = 10 * 60 * 1000;
const ROLE_ADD_INTERVAL_MS = 1_100;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('recentrole')
    .setDescription('Give a role to every member who joined in the past 10 minutes')
    .addStringOption((opt) =>
      opt
        .setName('role')
        .setDescription('Role mention, ID, or name (closest match)')
        .setRequired(true),
    )
    .addStringOption((opt) => opt.setName('reason').setDescription('Reason')),
  permissions: [PermissionFlagsBits.ManageRoles],
  guildOnly: true,
  async execute(interaction) {
    const reason = interaction.options.getString('reason') ?? 'Recent join role';
    const fromRole = interaction.options.getRole('role', false);
    const roleInput = interaction.options.getString('role', false);
    const resolved = fromRole ?? (roleInput ? resolveRole(interaction.guild!, roleInput) : null);
    const role = resolved ? interaction.guild!.roles.cache.get(resolved.id) ?? null : null;
    const actor = interaction.member as import('discord.js').GuildMember;

    if (!role) {
      await interaction.reply({
        embeds: [
          fail(
            interaction.user,
            `No role matched \`${roleInput ?? 'that'}\` — try an ID, @mention, or closer name`,
          ),
        ],
        ephemeral: true,
      });
      return;
    }

    if (
      !canBypass(interaction.user.id) &&
      role.position >= actor.roles.highest.position
    ) {
      await interaction.reply({
        embeds: [fail(interaction.user, 'You cannot manage a role equal to or above your highest role')],
        ephemeral: true,
      });
      return;
    }

    const me = interaction.guild!.members.me;
    if (me && role.position >= me.roles.highest.position) {
      await interaction.reply({
        embeds: [fail(interaction.user, 'My highest role is too low to assign that role')],
        ephemeral: true,
      });
      return;
    }

    await interaction.deferReply();

    await interaction.guild!.members.fetch().catch(() => undefined);

    const cutoff = Date.now() - WINDOW_MS;
    const targets = interaction.guild!.members.cache.filter(
      (m) =>
        !m.user.bot &&
        m.joinedTimestamp != null &&
        m.joinedTimestamp >= cutoff &&
        !m.roles.cache.has(role.id),
    );

    if (!targets.size) {
      await interaction.editReply({
        embeds: [
          ok(
            interaction.user,
            `No members joined in the last **10 minutes** who still need ${role}`,
          ),
        ],
      });
      return;
    }

    let success = 0;
    let failed = 0;

    for (const member of targets.values()) {
      try {
        await member.roles.add(role, reason);
        success++;
      } catch {
        failed++;
      }
      if (targets.size > 1) await sleep(ROLE_ADD_INTERVAL_MS);
    }

    await sendModLog({
      guild: interaction.guild!,
      action: 'roleadd',
      user: interaction.user,
      moderator: interaction.user,
      reason,
      extra: {
        role: role.name,
        recent_joiners: success,
        failed,
        window: '10m',
      },
    }).catch(() => undefined);

    const parts = [
      `gave ${role} to **${success}** member${success === 1 ? '' : 's'} who joined in the last **10 minutes**`,
    ];
    if (failed) parts.push(`(**${failed}** failed)`);

    await interaction.editReply({
      embeds: [ok(interaction.user, parts.join(' '))],
    });
  },
};

export default command;
