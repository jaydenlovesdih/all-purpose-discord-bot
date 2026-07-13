import { PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import { Command } from '../../types/index.js';
import { mutateGuildConfig, getGuildConfig } from '../../utils/guildConfig.js';
import { successEmbed, errorEmbed, infoEmbed } from '../../utils/embeds.js';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('welcome')
    .setDescription('Configure welcome messages and autoroles')
    .addStringOption((opt) =>
      opt
        .setName('subcommand')
        .setDescription('Action')
        .setRequired(true)
        .addChoices(
          { name: 'enable', value: 'enable' },
          { name: 'disable', value: 'disable' },
          { name: 'channel', value: 'channel' },
          { name: 'message', value: 'message' },
          { name: 'autorole', value: 'autorole' },
          { name: 'view', value: 'view' },
        ),
    )
    .addStringOption((opt) => opt.setName('text').setDescription('Welcome message template'))
    .addChannelOption((opt) => opt.setName('channel').setDescription('Welcome channel'))
    .addRoleOption((opt) => opt.setName('role').setDescription('Autorole to add/remove')),
  permissions: [PermissionFlagsBits.ManageGuild],
  guildOnly: true,
  async execute(interaction) {
    const sub = interaction.options.getString('subcommand', true);
    const guildId = interaction.guildId!;

    if (sub === 'enable') {
      mutateGuildConfig(guildId, (c) => {
        c.welcome.enabled = true;
        c.welcome.channelId = c.welcome.channelId ?? interaction.channelId;
      });
      await interaction.reply({ embeds: [successEmbed('Welcome messages enabled.')] });
      return;
    }

    if (sub === 'disable') {
      mutateGuildConfig(guildId, (c) => {
        c.welcome.enabled = false;
      });
      await interaction.reply({ embeds: [successEmbed('Welcome messages disabled.')] });
      return;
    }

    if (sub === 'channel') {
      const channel = interaction.options.getChannel('channel') ?? interaction.channel;
      if (!channel) {
        await interaction.reply({ embeds: [errorEmbed('Provide a channel.')], ephemeral: true });
        return;
      }
      mutateGuildConfig(guildId, (c) => {
        c.welcome.channelId = channel.id;
        c.welcome.enabled = true;
      });
      await interaction.reply({ embeds: [successEmbed(`Welcome channel set to <#${channel.id}>`)] });
      return;
    }

    if (sub === 'message') {
      const text = interaction.options.getString('text');
      if (!text) {
        await interaction.reply({
          embeds: [errorEmbed('Provide text. Vars: `{user.mention}` `{user.name}` `{guild.name}`')],
          ephemeral: true,
        });
        return;
      }
      mutateGuildConfig(guildId, (c) => {
        c.welcome.message = text;
      });
      await interaction.reply({ embeds: [successEmbed('Welcome message updated.')] });
      return;
    }

    if (sub === 'autorole') {
      const role = interaction.options.getRole('role');
      if (!role) {
        await interaction.reply({ embeds: [errorEmbed('Provide a role.')], ephemeral: true });
        return;
      }
      let added = false;
      mutateGuildConfig(guildId, (c) => {
        if (c.welcome.autoRoleIds.includes(role.id)) {
          c.welcome.autoRoleIds = c.welcome.autoRoleIds.filter((id) => id !== role.id);
        } else {
          c.welcome.autoRoleIds.push(role.id);
          added = true;
        }
      });
      await interaction.reply({
        embeds: [successEmbed(added ? `Added autorole **${role.name}**` : `Removed autorole **${role.name}**`)],
      });
      return;
    }

    const w = getGuildConfig(guildId).welcome;
    await interaction.reply({
      embeds: [
        infoEmbed(
          [
            `Enabled: **${w.enabled}**`,
            `Channel: ${w.channelId ? `<#${w.channelId}>` : 'None'}`,
            `Message: ${w.message}`,
            `Autoroles: ${w.autoRoleIds.map((id) => `<@&${id}>`).join(', ') || 'None'}`,
          ].join('\n'),
          'Welcome Settings',
        ),
      ],
    });
  },
};

export default command;
