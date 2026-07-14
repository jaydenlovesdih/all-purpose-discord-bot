import { PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import { Command } from '../../types/index.js';
import { getGuildConfig, mutateGuildConfig } from '../../utils/guildConfig.js';
import { sendInvoke } from '../../utils/moderation.js';
import { fail } from '../../utils/embeds.js';
import { buildModButtons, buildModEmbed } from '../../utils/modResponse.js';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('unjail')
    .setDescription('Release a member from jail')
    .addUserOption((opt) => opt.setName('user').setDescription('Member').setRequired(true)),
  permissions: [PermissionFlagsBits.ModerateMembers],
  guildOnly: true,
  async execute(interaction) {
    const user = interaction.options.getUser('user', true);
    const member = interaction.guild!.members.cache.get(user.id);
    const cfg = getGuildConfig(interaction.guildId!);

    if (!member || !cfg.jailRoleId) {
      await interaction.reply({
        embeds: [fail(interaction.user, 'Member not found or jail is not set up')],
        ephemeral: true,
      });
      return;
    }

    const previous = cfg.jailedRoles[user.id] ?? [];
    await member.roles.remove(cfg.jailRoleId, 'Unjail');
    if (previous.length) {
      await member.roles.add(previous).catch(() => undefined);
    }
    mutateGuildConfig(interaction.guildId!, (c) => {
      delete c.jailedRoles[user.id];
    });

    await sendInvoke(
      { guild: interaction.guild!, action: 'unjail', user, moderator: interaction.user, reason: 'Unjailed' },
      null,
    );

    const embed = buildModEmbed({
      action: 'unjail',
      target: user,
      moderator: interaction.user,
      reason: 'Unjailed',
      member,
      botName: interaction.client.user?.username,
    });
    const row = buildModButtons('unjail', user.id);
    await interaction.reply({ embeds: [embed], components: row ? [row] : [] });
  },
};

export default command;
