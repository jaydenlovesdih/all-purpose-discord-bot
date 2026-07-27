import { EmbedBuilder, SlashCommandBuilder } from 'discord.js';
import { Command } from '../../types/index.js';
import { fail, Colors } from '../../utils/embeds.js';
import { resolveRole } from '../../utils/resolveRole.js';
import {
  formatRolePermissions,
  resolveGuildForRoles,
  withUserInstall,
} from '../../utils/userInstall.js';

const command: Command = {
  data: withUserInstall(
    new SlashCommandBuilder()
      .setName('rolepermissions')
      .setDescription("Show a role's permissions (only you can see this)")
      .addStringOption((opt) =>
        opt
          .setName('role')
          .setDescription('Role mention, ID, or name (closest match)')
          .setRequired(true),
      ),
  ),
  guildOnly: true,
  userInstall: true,
  bypassBotLock: true,
  async execute(interaction) {
    const isPrefix = 'commandMessage' in interaction;
    const ephemeral = !isPrefix;

    const guild = await resolveGuildForRoles(interaction);
    if (!guild) {
      await interaction.reply({
        embeds: [
          fail(
            interaction.user,
            "I cannot see this server's roles. Add the bot **to this server** as well — user-install alone cannot read roles.",
          ),
        ],
        ephemeral,
      });
      return;
    }

    const fromRole = interaction.options.getRole('role', false);
    const roleInput = interaction.options.getString('role', false);
    const resolved = fromRole ?? (roleInput ? resolveRole(guild, roleInput) : null);
    const role = resolved ? guild.roles.cache.get(resolved.id) ?? null : null;

    if (!role) {
      await interaction.reply({
        embeds: [
          fail(
            interaction.user,
            `No role matched \`${roleInput ?? 'that'}\` — try an ID, @mention, or closer name`,
          ),
        ],
        ephemeral,
      });
      return;
    }

    const perms = formatRolePermissions(role.permissions);
    const embed = new EmbedBuilder()
      .setColor(role.color || Colors.success)
      .setTitle(`🔐 Permissions — ${role.name}`)
      .setDescription(perms)
      .addFields(
        { name: 'Role', value: `${role}`, inline: true },
        { name: 'ID', value: `\`${role.id}\``, inline: true },
        { name: 'Position', value: String(role.position), inline: true },
        { name: 'Hoisted', value: role.hoist ? 'Yes' : 'No', inline: true },
        { name: 'Mentionable', value: role.mentionable ? 'Yes' : 'No', inline: true },
        { name: 'Managed', value: role.managed ? 'Yes (integration)' : 'No', inline: true },
      )
      .setFooter({ text: guild.name })
      .setTimestamp();

    await interaction.reply({ embeds: [embed], ephemeral });
  },
};

export default command;
