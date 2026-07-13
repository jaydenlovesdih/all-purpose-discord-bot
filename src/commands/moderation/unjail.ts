import { PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import { Command } from '../../types/index.js';
import { getGuildConfig, mutateGuildConfig } from '../../utils/guildConfig.js';
import { sendInvoke } from '../../utils/moderation.js';
import { successEmbed, errorEmbed } from '../../utils/embeds.js';

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
      await interaction.reply({ embeds: [errorEmbed('Member not found or jail is not set up.')], ephemeral: true });
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

    const used = await sendInvoke(
      { guild: interaction.guild!, action: 'unjail', user, moderator: interaction.user, reason: 'Unjailed' },
      interaction.channel?.isTextBased() ? (interaction.channel as import('discord.js').TextChannel) : null,
    );

    if (!used) {
      await interaction.reply({ embeds: [successEmbed(`Unjailed **${user.tag}**`)] });
    } else if (!interaction.replied) {
      await interaction.reply({ content: 'Done.', ephemeral: true });
    }
  },
};

export default command;
