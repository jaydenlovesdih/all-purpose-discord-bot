import { PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import { Command } from '../../types/index.js';
import { mutateGuildConfig, getGuildConfig } from '../../utils/guildConfig.js';
import { successEmbed, errorEmbed, infoEmbed } from '../../utils/embeds.js';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('welcome')
    .setDescription('Configure welcome / leave messages and autoroles')
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
          { name: 'leave', value: 'leave' },
          { name: 'leavechannel', value: 'leavechannel' },
          { name: 'leavemessage', value: 'leavemessage' },
          { name: 'autorole', value: 'autorole' },
          { name: 'view', value: 'view' },
        ),
    )
    .addStringOption((opt) => opt.setName('text').setDescription('Message template'))
    .addChannelOption((opt) => opt.setName('channel').setDescription('Channel'))
    .addRoleOption((opt) => opt.setName('role').setDescription('Autorole')),
  permissions: [PermissionFlagsBits.ManageGuild],
  guildOnly: true,
  async execute(interaction) {
    const sub = interaction.options.getString('subcommand', true);
    const guildId = interaction.guildId!;
    const text = interaction.options.getString('text');
    const channel = interaction.options.getChannel('channel');
    const role =
      interaction.options.getRole('role') ??
      (interaction as unknown as { message?: import('discord.js').Message }).message?.mentions.roles.first();

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
      const target = channel ?? interaction.channel;
      if (!target) {
        await interaction.reply({ embeds: [errorEmbed('Provide a channel.')], ephemeral: true });
        return;
      }
      mutateGuildConfig(guildId, (c) => {
        c.welcome.channelId = target.id;
        c.welcome.enabled = true;
      });
      await interaction.reply({ embeds: [successEmbed(`Welcome channel → <#${target.id}>`)] });
      return;
    }

    if (sub === 'message') {
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

    if (sub === 'leave') {
      mutateGuildConfig(guildId, (c) => {
        c.welcome.leaveEnabled = !c.welcome.leaveEnabled;
        c.welcome.leaveChannelId = c.welcome.leaveChannelId ?? c.welcome.channelId ?? interaction.channelId;
      });
      const enabled = getGuildConfig(guildId).welcome.leaveEnabled;
      await interaction.reply({ embeds: [successEmbed(`Leave messages **${enabled ? 'enabled' : 'disabled'}**`)] });
      return;
    }

    if (sub === 'leavechannel') {
      const target = channel ?? interaction.channel;
      if (!target) {
        await interaction.reply({ embeds: [errorEmbed('Provide a channel.')], ephemeral: true });
        return;
      }
      mutateGuildConfig(guildId, (c) => {
        c.welcome.leaveChannelId = target.id;
        c.welcome.leaveEnabled = true;
      });
      await interaction.reply({ embeds: [successEmbed(`Leave channel → <#${target.id}>`)] });
      return;
    }

    if (sub === 'leavemessage') {
      if (!text) {
        await interaction.reply({ embeds: [errorEmbed('Provide leave message text.')], ephemeral: true });
        return;
      }
      mutateGuildConfig(guildId, (c) => {
        c.welcome.leaveMessage = text;
      });
      await interaction.reply({ embeds: [successEmbed('Leave message updated.')] });
      return;
    }

    if (sub === 'autorole') {
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
            `Welcome: **${w.enabled}** → ${w.channelId ? `<#${w.channelId}>` : 'None'}`,
            `Message: ${w.message}`,
            `Leave: **${w.leaveEnabled}** → ${w.leaveChannelId ? `<#${w.leaveChannelId}>` : 'None'}`,
            `Leave msg: ${w.leaveMessage}`,
            `Autoroles: ${w.autoRoleIds.map((id) => `<@&${id}>`).join(', ') || 'None'}`,
          ].join('\n'),
          'Welcome / Leave',
        ),
      ],
    });
  },
};

export default command;
