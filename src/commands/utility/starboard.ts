import { PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import { Command } from '../../types/index.js';
import { mutateGuildConfig, getGuildConfig } from '../../utils/guildConfig.js';
import { successEmbed, errorEmbed, infoEmbed } from '../../utils/embeds.js';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('starboard')
    .setDescription('Configure the starboard')
    .addStringOption((opt) =>
      opt
        .setName('subcommand')
        .setDescription('Action')
        .setRequired(true)
        .addChoices(
          { name: 'enable', value: 'enable' },
          { name: 'disable', value: 'disable' },
          { name: 'channel', value: 'channel' },
          { name: 'emoji', value: 'emoji' },
          { name: 'threshold', value: 'threshold' },
          { name: 'view', value: 'view' },
        ),
    )
    .addChannelOption((opt) => opt.setName('channel').setDescription('Starboard channel'))
    .addStringOption((opt) => opt.setName('emoji').setDescription('Emoji to watch'))
    .addIntegerOption((opt) => opt.setName('count').setDescription('Required reactions').setMinValue(1).setMaxValue(50)),
  permissions: [PermissionFlagsBits.ManageGuild],
  guildOnly: true,
  async execute(interaction) {
    const sub = interaction.options.getString('subcommand', true);
    const guildId = interaction.guildId!;

    if (sub === 'enable') {
      mutateGuildConfig(guildId, (c) => {
        c.starboard.enabled = true;
        c.starboard.channelId = c.starboard.channelId ?? interaction.channelId;
      });
      await interaction.reply({ embeds: [successEmbed('Starboard enabled.')] });
      return;
    }

    if (sub === 'disable') {
      mutateGuildConfig(guildId, (c) => {
        c.starboard.enabled = false;
      });
      await interaction.reply({ embeds: [successEmbed('Starboard disabled.')] });
      return;
    }

    if (sub === 'channel') {
      const channel = interaction.options.getChannel('channel') ?? interaction.channel;
      if (!channel) {
        await interaction.reply({ embeds: [errorEmbed('Provide a channel.')], ephemeral: true });
        return;
      }
      mutateGuildConfig(guildId, (c) => {
        c.starboard.channelId = channel.id;
        c.starboard.enabled = true;
      });
      await interaction.reply({ embeds: [successEmbed(`Starboard channel set to <#${channel.id}>`)] });
      return;
    }

    if (sub === 'emoji') {
      const emoji = interaction.options.getString('emoji') ?? '⭐';
      mutateGuildConfig(guildId, (c) => {
        c.starboard.emoji = emoji;
      });
      await interaction.reply({ embeds: [successEmbed(`Starboard emoji set to ${emoji}`)] });
      return;
    }

    if (sub === 'threshold') {
      const count = interaction.options.getInteger('count') ?? 3;
      mutateGuildConfig(guildId, (c) => {
        c.starboard.threshold = count;
      });
      await interaction.reply({ embeds: [successEmbed(`Starboard threshold set to **${count}**`)] });
      return;
    }

    const s = getGuildConfig(guildId).starboard;
    await interaction.reply({
      embeds: [
        infoEmbed(
          [
            `Enabled: **${s.enabled}**`,
            `Channel: ${s.channelId ? `<#${s.channelId}>` : 'None'}`,
            `Emoji: ${s.emoji}`,
            `Threshold: **${s.threshold}**`,
          ].join('\n'),
          'Starboard Settings',
        ),
      ],
    });
  },
};

export default command;
