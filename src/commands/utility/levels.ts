import { PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import { Command } from '../../types/index.js';
import { mutateGuildConfig, getGuildConfig } from '../../utils/guildConfig.js';
import { getLeaderboard, getUserLevel, xpForLevel } from '../../utils/levelsStore.js';
import { successEmbed, errorEmbed, infoEmbed } from '../../utils/embeds.js';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('levels')
    .setDescription('Configure leveling or view XP stats')
    .addStringOption((opt) =>
      opt
        .setName('subcommand')
        .setDescription('Action')
        .setRequired(true)
        .addChoices(
          { name: 'setup', value: 'setup' },
          { name: 'channel', value: 'channel' },
          { name: 'message', value: 'message' },
          { name: 'role', value: 'role' },
          { name: 'list', value: 'list' },
          { name: 'stats', value: 'stats' },
          { name: 'leaderboard', value: 'leaderboard' },
          { name: 'disable', value: 'disable' },
        ),
    )
    .addIntegerOption((opt) => opt.setName('level').setDescription('Reward level').setMinValue(1).setMaxValue(200))
    .addRoleOption((opt) => opt.setName('role').setDescription('Reward role'))
    .addUserOption((opt) => opt.setName('user').setDescription('User for stats'))
    .addChannelOption((opt) => opt.setName('channel').setDescription('Level-up channel'))
    .addStringOption((opt) => opt.setName('text').setDescription('Level-up message')),
  guildOnly: true,
  async execute(interaction) {
    const sub = interaction.options.getString('subcommand', true);
    const guildId = interaction.guildId!;
    const member = interaction.member as import('discord.js').GuildMember | null;
    const isAdmin = member?.permissions.has(PermissionFlagsBits.ManageGuild) ?? false;

    if (['setup', 'channel', 'message', 'role', 'disable'].includes(sub) && !isAdmin) {
      await interaction.reply({ embeds: [errorEmbed('Manage Server permission required.')], ephemeral: true });
      return;
    }

    if (sub === 'setup') {
      mutateGuildConfig(guildId, (c) => {
        c.levels.enabled = true;
        c.levels.channelId = c.levels.channelId ?? interaction.channelId;
      });
      await interaction.reply({ embeds: [successEmbed('Leveling enabled.')] });
      return;
    }

    if (sub === 'disable') {
      mutateGuildConfig(guildId, (c) => {
        c.levels.enabled = false;
      });
      await interaction.reply({ embeds: [successEmbed('Leveling disabled.')] });
      return;
    }

    if (sub === 'channel') {
      const channel = interaction.options.getChannel('channel') ?? interaction.channel;
      if (!channel) {
        await interaction.reply({ embeds: [errorEmbed('Provide a channel.')], ephemeral: true });
        return;
      }
      mutateGuildConfig(guildId, (c) => {
        c.levels.channelId = channel.id;
        c.levels.enabled = true;
      });
      await interaction.reply({ embeds: [successEmbed(`Level channel set to <#${channel.id}>`)] });
      return;
    }

    if (sub === 'message') {
      const text = interaction.options.getString('text');
      if (!text) {
        await interaction.reply({
          embeds: [errorEmbed('Provide text. Vars: `{user.mention}` `{level}` `{guild.name}`')],
          ephemeral: true,
        });
        return;
      }
      mutateGuildConfig(guildId, (c) => {
        c.levels.message = text;
      });
      await interaction.reply({ embeds: [successEmbed('Level message updated.')] });
      return;
    }

    if (sub === 'role') {
      const level = interaction.options.getInteger('level');
      const role = interaction.options.getRole('role');
      if (!level) {
        await interaction.reply({ embeds: [errorEmbed('Provide a level number.')], ephemeral: true });
        return;
      }
      if (!role) {
        mutateGuildConfig(guildId, (c) => {
          c.levels.rewards = c.levels.rewards.filter((r) => r.level !== level);
        });
        await interaction.reply({ embeds: [successEmbed(`Removed reward for level **${level}**`)] });
        return;
      }
      mutateGuildConfig(guildId, (c) => {
        c.levels.rewards = c.levels.rewards.filter((r) => r.level !== level);
        c.levels.rewards.push({ level, roleId: role.id });
        c.levels.rewards.sort((a, b) => a.level - b.level);
      });
      await interaction.reply({ embeds: [successEmbed(`Level **${level}** → **${role.name}**`)] });
      return;
    }

    if (sub === 'list') {
      const rewards = getGuildConfig(guildId).levels.rewards;
      await interaction.reply({
        embeds: [
          infoEmbed(
            rewards.length
              ? rewards.map((r) => `Level **${r.level}** → <@&${r.roleId}>`).join('\n')
              : 'No level rewards.',
            'Level Rewards',
          ),
        ],
      });
      return;
    }

    if (sub === 'leaderboard') {
      const board = getLeaderboard(guildId, 10);
      await interaction.reply({
        embeds: [
          infoEmbed(
            board.length
              ? board.map((e, i) => `**${i + 1}.** <@${e.userId}> — Level ${e.level} (${e.xp} XP)`).join('\n')
              : 'No XP data yet.',
            'Leaderboard',
          ),
        ],
      });
      return;
    }

    const user = interaction.options.getUser('user') ?? interaction.user;
    const stats = getUserLevel(guildId, user.id);
    await interaction.reply({
      embeds: [
        infoEmbed(
          [
            `User: **${user.tag}**`,
            `Level: **${stats.level}**`,
            `XP: **${stats.xp}** / ${xpForLevel(stats.level + 1)}`,
            `Messages: **${stats.messages}**`,
          ].join('\n'),
          'Level Stats',
        ),
      ],
    });
  },
};

export default command;
