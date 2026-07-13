import { PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import { Command } from '../../types/index.js';
import { mutateGuildConfig, getGuildConfig } from '../../utils/guildConfig.js';
import { successEmbed, errorEmbed, infoEmbed } from '../../utils/embeds.js';

function parseDuration(input: string): number | null {
  const match = input.match(/^(\d+)(s|m|h)$/i);
  if (!match) return null;
  const n = Number(match[1]);
  const unit = match[2].toLowerCase();
  if (unit === 's') return Math.max(20, n);
  if (unit === 'm') return Math.max(20, n * 60);
  return Math.max(20, n * 3600);
}

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('filter')
    .setDescription('Configure AutoMod filters')
    .addStringOption((opt) =>
      opt
        .setName('subcommand')
        .setDescription('Action')
        .setRequired(true)
        .addChoices(
          { name: 'setup', value: 'setup' },
          { name: 'add', value: 'add' },
          { name: 'remove', value: 'remove' },
          { name: 'list', value: 'list' },
          { name: 'clear', value: 'clear' },
          { name: 'invites', value: 'invites' },
          { name: 'links', value: 'links' },
          { name: 'spam', value: 'spam' },
          { name: 'caps', value: 'caps' },
          { name: 'massmention', value: 'massmention' },
          { name: 'emojis', value: 'emojis' },
          { name: 'punishment', value: 'punishment' },
          { name: 'timeout', value: 'timeout' },
          { name: 'view', value: 'view' },
        ),
    )
    .addStringOption((opt) => opt.setName('value').setDescription('Word / true|false / punishment / duration'))
    .addIntegerOption((opt) => opt.setName('threshold').setDescription('Threshold').setMinValue(1).setMaxValue(127)),
  permissions: [PermissionFlagsBits.Administrator],
  guildOnly: true,
  async execute(interaction) {
    const sub = interaction.options.getString('subcommand', true);
    const value = interaction.options.getString('value');
    const threshold = interaction.options.getInteger('threshold');
    const guildId = interaction.guildId!;

    if (sub === 'setup') {
      mutateGuildConfig(guildId, (c) => {
        c.automod.enabled = true;
        c.automod.invites = true;
        c.automod.spam = true;
        c.automod.massMention = true;
      });
      await interaction.reply({ embeds: [successEmbed('AutoMod enabled with invites, spam, and mass-mention filters.')] });
      return;
    }

    if (sub === 'add') {
      if (!value) {
        await interaction.reply({ embeds: [errorEmbed('Provide a word to filter.')], ephemeral: true });
        return;
      }
      mutateGuildConfig(guildId, (c) => {
        if (!c.automod.words.includes(value.toLowerCase())) c.automod.words.push(value.toLowerCase());
        c.automod.enabled = true;
      });
      await interaction.reply({ embeds: [successEmbed(`Added filter word: \`${value}\``)] });
      return;
    }

    if (sub === 'remove') {
      if (!value) {
        await interaction.reply({ embeds: [errorEmbed('Provide a word to remove.')], ephemeral: true });
        return;
      }
      mutateGuildConfig(guildId, (c) => {
        c.automod.words = c.automod.words.filter((w) => w !== value.toLowerCase());
      });
      await interaction.reply({ embeds: [successEmbed(`Removed filter word: \`${value}\``)] });
      return;
    }

    if (sub === 'list') {
      const words = getGuildConfig(guildId).automod.words;
      await interaction.reply({
        embeds: [infoEmbed(words.length ? words.map((w) => `\`${w}\``).join(', ') : 'No filtered words.', 'Filter List')],
      });
      return;
    }

    if (sub === 'clear') {
      mutateGuildConfig(guildId, (c) => {
        c.automod.words = [];
      });
      await interaction.reply({ embeds: [successEmbed('Cleared all filtered words.')] });
      return;
    }

    if (['invites', 'links', 'spam', 'caps', 'massmention', 'emojis'].includes(sub)) {
      const state = value ? ['true', 'on', '1', 'yes'].includes(value.toLowerCase()) : true;
      mutateGuildConfig(guildId, (c) => {
        c.automod.enabled = true;
        if (sub === 'invites') c.automod.invites = state;
        if (sub === 'links') c.automod.links = state;
        if (sub === 'spam') {
          c.automod.spam = state;
          if (threshold) c.automod.spamThreshold = threshold;
        }
        if (sub === 'caps') {
          c.automod.caps = state;
          if (threshold) c.automod.capsThreshold = threshold;
        }
        if (sub === 'massmention') {
          c.automod.massMention = state;
          if (threshold) c.automod.mentionThreshold = threshold;
        }
        if (sub === 'emojis') {
          c.automod.emojis = state;
          if (threshold) c.automod.emojiThreshold = threshold;
        }
      });
      await interaction.reply({
        embeds: [successEmbed(`\`${sub}\` set to **${state}**${threshold ? ` (threshold ${threshold})` : ''}`)],
      });
      return;
    }

    if (sub === 'punishment') {
      const allowed = ['timeout', 'kick', 'ban', 'jail', 'delete'] as const;
      if (!value || !allowed.includes(value as (typeof allowed)[number])) {
        await interaction.reply({
          embeds: [errorEmbed(`Punishment must be one of: ${allowed.join(', ')}`)],
          ephemeral: true,
        });
        return;
      }
      mutateGuildConfig(guildId, (c) => {
        c.automod.punishment = value as (typeof allowed)[number];
      });
      await interaction.reply({ embeds: [successEmbed(`AutoMod punishment set to **${value}**`)] });
      return;
    }

    if (sub === 'timeout') {
      if (!value) {
        await interaction.reply({ embeds: [errorEmbed('Provide duration like `60s`, `5m`, `1h`.')], ephemeral: true });
        return;
      }
      const seconds = parseDuration(value);
      if (!seconds) {
        await interaction.reply({ embeds: [errorEmbed('Invalid duration.')], ephemeral: true });
        return;
      }
      mutateGuildConfig(guildId, (c) => {
        c.automod.timeoutSeconds = seconds;
      });
      await interaction.reply({ embeds: [successEmbed(`AutoMod timeout set to **${seconds}s**`)] });
      return;
    }

    const am = getGuildConfig(guildId).automod;
    await interaction.reply({
      embeds: [
        infoEmbed(
          [
            `Enabled: **${am.enabled}**`,
            `Invites: **${am.invites}** | Links: **${am.links}**`,
            `Spam: **${am.spam}** (${am.spamThreshold}) | Caps: **${am.caps}** (${am.capsThreshold}%)`,
            `Mass mention: **${am.massMention}** (${am.mentionThreshold}) | Emojis: **${am.emojis}** (${am.emojiThreshold})`,
            `Punishment: **${am.punishment}** | Timeout: **${am.timeoutSeconds}s**`,
            `Words: **${am.words.length}**`,
          ].join('\n'),
          'AutoMod Settings',
        ),
      ],
    });
  },
};

export default command;
