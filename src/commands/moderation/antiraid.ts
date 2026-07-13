import { PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import { Command } from '../../types/index.js';
import { mutateGuildConfig, getGuildConfig } from '../../utils/guildConfig.js';
import { successEmbed, errorEmbed, infoEmbed } from '../../utils/embeds.js';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('antiraid')
    .setDescription('Configure anti-raid protection')
    .addStringOption((opt) =>
      opt
        .setName('subcommand')
        .setDescription('Action')
        .setRequired(true)
        .addChoices(
          { name: 'toggle', value: 'toggle' },
          { name: 'massjoin', value: 'massjoin' },
          { name: 'newaccounts', value: 'newaccounts' },
          { name: 'avatar', value: 'avatar' },
          { name: 'punishment', value: 'punishment' },
          { name: 'lockdown', value: 'lockdown' },
          { name: 'setlogchannel', value: 'setlogchannel' },
          { name: 'view', value: 'view' },
        ),
    )
    .addStringOption((opt) => opt.setName('value').setDescription('on/off, days, or punishment'))
    .addIntegerOption((opt) => opt.setName('threshold').setDescription('Join/age threshold').setMinValue(1).setMaxValue(100))
    .addChannelOption((opt) => opt.setName('channel').setDescription('Log channel')),
  permissions: [PermissionFlagsBits.Administrator],
  guildOnly: true,
  async execute(interaction) {
    const sub = interaction.options.getString('subcommand', true);
    const value = interaction.options.getString('value');
    const threshold = interaction.options.getInteger('threshold');
    const channel = interaction.options.getChannel('channel');
    const guildId = interaction.guildId!;

    if (sub === 'toggle') {
      let enabled = false;
      mutateGuildConfig(guildId, (c) => {
        c.antiraid.enabled = !c.antiraid.enabled;
        enabled = c.antiraid.enabled;
      });
      await interaction.reply({ embeds: [successEmbed(`AntiRaid is now **${enabled ? 'enabled' : 'disabled'}**`)] });
      return;
    }

    if (sub === 'massjoin') {
      const on = !value || ['on', 'true', '1'].includes(value.toLowerCase());
      mutateGuildConfig(guildId, (c) => {
        c.antiraid.enabled = on || c.antiraid.enabled;
        if (threshold) c.antiraid.massJoinThreshold = threshold;
      });
      await interaction.reply({
        embeds: [successEmbed(`Mass join protection **${on ? 'on' : 'configured'}** (threshold ${threshold ?? getGuildConfig(guildId).antiraid.massJoinThreshold}/60s)`)],
      });
      return;
    }

    if (sub === 'newaccounts') {
      const days = threshold ?? Number(value) ?? 7;
      mutateGuildConfig(guildId, (c) => {
        c.antiraid.enabled = true;
        c.antiraid.minAccountAgeDays = days;
      });
      await interaction.reply({ embeds: [successEmbed(`Blocking accounts newer than **${days}** day(s)`)] });
      return;
    }

    if (sub === 'avatar') {
      const on = !value || ['on', 'true', '1'].includes(value.toLowerCase());
      mutateGuildConfig(guildId, (c) => {
        c.antiraid.enabled = true;
        c.antiraid.blockDefaultAvatar = on;
      });
      await interaction.reply({ embeds: [successEmbed(`Default avatar block **${on ? 'on' : 'off'}**`)] });
      return;
    }

    if (sub === 'punishment') {
      const allowed = ['ban', 'kick', 'timeout', 'jail'] as const;
      if (!value || !allowed.includes(value as (typeof allowed)[number])) {
        await interaction.reply({ embeds: [errorEmbed(`Use: ${allowed.join(', ')}`)], ephemeral: true });
        return;
      }
      mutateGuildConfig(guildId, (c) => {
        c.antiraid.punishment = value as (typeof allowed)[number];
      });
      await interaction.reply({ embeds: [successEmbed(`AntiRaid punishment: **${value}**`)] });
      return;
    }

    if (sub === 'lockdown') {
      const on = !value || ['on', 'true', '1'].includes(value.toLowerCase());
      mutateGuildConfig(guildId, (c) => {
        c.antiraid.lockdown = on;
      });
      const everyone = interaction.guild!.roles.everyone;
      for (const ch of interaction.guild!.channels.cache.values()) {
        if (!('permissionOverwrites' in ch)) continue;
        await ch.permissionOverwrites
          .edit(everyone, { SendMessages: on ? false : null, Connect: on ? false : null })
          .catch(() => undefined);
      }
      await interaction.reply({ embeds: [successEmbed(`Lockdown **${on ? 'enabled' : 'disabled'}**`)] });
      return;
    }

    if (sub === 'setlogchannel') {
      const target = channel ?? interaction.channel;
      if (!target) {
        await interaction.reply({ embeds: [errorEmbed('Provide a channel.')], ephemeral: true });
        return;
      }
      mutateGuildConfig(guildId, (c) => {
        c.antiraid.logChannelId = target.id;
      });
      await interaction.reply({ embeds: [successEmbed(`AntiRaid log channel set to <#${target.id}>`)] });
      return;
    }

    const ar = getGuildConfig(guildId).antiraid;
    await interaction.reply({
      embeds: [
        infoEmbed(
          [
            `Enabled: **${ar.enabled}**`,
            `Mass join threshold: **${ar.massJoinThreshold}/60s**`,
            `Min account age: **${ar.minAccountAgeDays}d**`,
            `Block default avatar: **${ar.blockDefaultAvatar}**`,
            `Punishment: **${ar.punishment}**`,
            `Lockdown: **${ar.lockdown}**`,
            `Log channel: ${ar.logChannelId ? `<#${ar.logChannelId}>` : 'None'}`,
          ].join('\n'),
          'AntiRaid Settings',
        ),
      ],
    });
  },
};

export default command;
