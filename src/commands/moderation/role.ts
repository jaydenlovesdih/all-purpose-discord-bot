import { PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import { Command } from '../../types/index.js';
import { canBypass } from '../../utils/permissions.js';
import { fail } from '../../utils/embeds.js';
import { buildModButtons, buildModEmbed } from '../../utils/modResponse.js';
import { sendModLog } from '../../utils/moderation.js';
import { resolveRole } from '../../utils/resolveRole.js';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('role')
    .setDescription('Add or remove a role from a member')
    .addUserOption((opt) => opt.setName('user').setDescription('Target member').setRequired(true))
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
    const user = interaction.options.getUser('user', true);
    const reason = interaction.options.getString('reason') ?? 'No reason provided';
    // Prefix resolves roles into Role objects; slash passes a string (id / name / mention text)
    const fromRole = interaction.options.getRole('role', false);
    const roleInput = interaction.options.getString('role', false);
    const resolved = fromRole ?? (roleInput ? resolveRole(interaction.guild!, roleInput) : null);
    const role = resolved ? interaction.guild!.roles.cache.get(resolved.id) ?? null : null;
    const member =
      interaction.guild!.members.cache.get(user.id) ??
      (await interaction.guild!.members.fetch(user.id).catch(() => null));

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

    if (!member) {
      await interaction.reply({ embeds: [fail(interaction.user, 'User not found in this server')], ephemeral: true });
      return;
    }

    if (
      !canBypass(interaction.user.id) &&
      role.position >= (interaction.member as import('discord.js').GuildMember).roles.highest.position
    ) {
      await interaction.reply({
        embeds: [fail(interaction.user, 'You cannot manage a role equal to or above your highest role')],
        ephemeral: true,
      });
      return;
    }

    const removing = member.roles.cache.has(role.id);
    if (removing) await member.roles.remove(role, reason);
    else await member.roles.add(role, reason);

    const action = removing ? 'roleremove' : 'roleadd';
    await sendModLog({
      guild: interaction.guild!,
      action,
      user,
      moderator: interaction.user,
      reason,
      extra: { role: role.name },
    });
    const embed = buildModEmbed({
      action,
      target: user,
      moderator: interaction.user,
      reason,
      member,
      detail: { name: '🎭 Role:', value: `${role}` },
      botName: interaction.client.user?.username,
    });
    const row = buildModButtons(action, user.id);
    await interaction.reply({ embeds: [embed], components: row ? [row] : [] });
  },
};

export default command;
