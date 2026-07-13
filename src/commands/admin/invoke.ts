import { PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import { Command } from '../../types/index.js';
import { mutateGuildConfig, getGuildConfig } from '../../utils/guildConfig.js';
import { successEmbed, errorEmbed, infoEmbed } from '../../utils/embeds.js';

const INVOKE_ACTIONS = [
  'kick',
  'hardban',
  'ban',
  'softban',
  'unban',
  'timeout',
  'untimeout',
  'strip',
  'jail',
  'unjail',
  'warn',
] as const;

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('invoke')
    .setDescription('Customize moderation response messages')
    .addStringOption((opt) =>
      opt
        .setName('subcommand')
        .setDescription('Action')
        .setRequired(true)
        .addChoices(
          { name: 'message', value: 'message' },
          { name: 'view', value: 'view' },
          { name: 'list', value: 'list' },
          { name: 'reset', value: 'reset' },
          { name: 'test', value: 'test' },
        ),
    )
    .addStringOption((opt) =>
      opt
        .setName('command')
        .setDescription('Moderation command')
        .addChoices(...INVOKE_ACTIONS.map((a) => ({ name: a, value: a }))),
    )
    .addStringOption((opt) => opt.setName('text').setDescription('Message template'))
    .addStringOption((opt) =>
      opt
        .setName('type')
        .setDescription('message or dm')
        .addChoices({ name: 'message', value: 'message' }, { name: 'dm', value: 'dm' }),
    ),
  permissions: [PermissionFlagsBits.Administrator],
  guildOnly: true,
  async execute(interaction) {
    const sub = interaction.options.getString('subcommand', true);
    const action = interaction.options.getString('command');
    const text = interaction.options.getString('text');
    const type = interaction.options.getString('type') ?? 'message';
    const guildId = interaction.guildId!;

    if (sub === 'list') {
      const invoke = getGuildConfig(guildId).invoke;
      const lines = Object.entries(invoke).map(([cmd, msgs]) => {
        const parts = [msgs.channel ? 'channel' : null, msgs.dm ? 'dm' : null].filter(Boolean);
        return `**${cmd}**: ${parts.join(', ') || 'empty'}`;
      });
      await interaction.reply({
        embeds: [infoEmbed(lines.length ? lines.join('\n') : 'No invoke messages set.', 'Invoke List')],
      });
      return;
    }

    if (!action || !INVOKE_ACTIONS.includes(action as (typeof INVOKE_ACTIONS)[number])) {
      await interaction.reply({
        embeds: [errorEmbed(`Pick a command: ${INVOKE_ACTIONS.join(', ')}`)],
        ephemeral: true,
      });
      return;
    }

    if (sub === 'message') {
      if (!text) {
        await interaction.reply({ embeds: [errorEmbed('Provide message text.')], ephemeral: true });
        return;
      }
      mutateGuildConfig(guildId, (c) => {
        if (!c.invoke[action]) c.invoke[action] = {};
        if (type === 'dm') c.invoke[action].dm = text;
        else c.invoke[action].channel = text;
      });
      await interaction.reply({
        embeds: [successEmbed(`Set **${type}** invoke for \`${action}\`.\nVariables: \`{user}\` \`{reason}\` \`{moderator.mention}\` \`{guild.name}\``)],
      });
      return;
    }

    if (sub === 'view') {
      const msgs = getGuildConfig(guildId).invoke[action];
      await interaction.reply({
        embeds: [
          infoEmbed(
            `**Channel:** ${msgs?.channel ?? '_unset_'}\n**DM:** ${msgs?.dm ?? '_unset_'}`,
            `Invoke · ${action}`,
          ),
        ],
      });
      return;
    }

    if (sub === 'reset') {
      mutateGuildConfig(guildId, (c) => {
        delete c.invoke[action];
      });
      await interaction.reply({ embeds: [successEmbed(`Reset invoke messages for \`${action}\``)] });
      return;
    }

    const msgs = getGuildConfig(guildId).invoke[action];
    const sample = (msgs?.channel ?? msgs?.dm ?? '{user} action: {action} reason: {reason}')
      .replaceAll('{user}', interaction.user.toString())
      .replaceAll('{user.mention}', interaction.user.toString())
      .replaceAll('{reason}', 'test reason')
      .replaceAll('{moderator.mention}', interaction.user.toString())
      .replaceAll('{guild.name}', interaction.guild!.name)
      .replaceAll('{action}', action);
    await interaction.reply({ content: sample });
  },
};

export default command;
