import { PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import { Command } from '../../types/index.js';
import { getGuildConfig, mutateGuildConfig } from '../../utils/guildConfig.js';
import { successEmbed, errorEmbed, infoEmbed } from '../../utils/embeds.js';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('logging')
    .setDescription('Configure server event logging')
    .addStringOption((opt) =>
      opt
        .setName('subcommand')
        .setDescription('Action')
        .setRequired(true)
        .addChoices(
          { name: 'enable', value: 'enable' },
          { name: 'disable', value: 'disable' },
          { name: 'channel', value: 'channel' },
          { name: 'view', value: 'view' },
        ),
    )
    .addChannelOption((opt) => opt.setName('channel').setDescription('Log channel')),
  permissions: [PermissionFlagsBits.ManageGuild],
  guildOnly: true,
  async execute(interaction) {
    const sub = interaction.options.getString('subcommand', true);
    const channel = interaction.options.getChannel('channel');
    const guildId = interaction.guildId!;

    if (sub === 'enable') {
      mutateGuildConfig(guildId, (c) => {
        c.logging.enabled = true;
        c.logging.channelId = c.logging.channelId ?? c.modLogChannelId ?? interaction.channelId;
      });
      await interaction.reply({ embeds: [successEmbed('Logging enabled.')] });
      return;
    }

    if (sub === 'disable') {
      mutateGuildConfig(guildId, (c) => {
        c.logging.enabled = false;
      });
      await interaction.reply({ embeds: [successEmbed('Logging disabled.')] });
      return;
    }

    if (sub === 'channel') {
      const target = channel ?? interaction.channel;
      if (!target) {
        await interaction.reply({ embeds: [errorEmbed('Provide a channel.')], ephemeral: true });
        return;
      }
      mutateGuildConfig(guildId, (c) => {
        c.logging.channelId = target.id;
        c.logging.enabled = true;
        c.modLogChannelId = c.modLogChannelId ?? target.id;
      });
      await interaction.reply({ embeds: [successEmbed(`Logging channel set to <#${target.id}>`)] });
      return;
    }

    const l = getGuildConfig(guildId).logging;
    await interaction.reply({
      embeds: [
        infoEmbed(
          [
            `Enabled: **${l.enabled}**`,
            `Channel: ${l.channelId ? `<#${l.channelId}>` : 'None'}`,
            `Events: deletes=${l.events.messageDelete}, edits=${l.events.messageEdit}, joins=${l.events.memberJoin}, leaves=${l.events.memberLeave}, bans=${l.events.memberBan}`,
          ].join('\n'),
          'Logging',
        ),
      ],
    });
  },
};

export default command;
