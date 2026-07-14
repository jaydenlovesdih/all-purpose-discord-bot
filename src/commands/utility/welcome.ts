import { PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import { Command } from '../../types/index.js';
import { mutateGuildConfig, getGuildConfig } from '../../utils/guildConfig.js';
import { ok, fail, infoEmbed } from '../../utils/embeds.js';
import { buildWelcomeDmEmbed, formatWelcomeText } from '../../utils/welcomeFormat.js';

const VARS = '`{user}` `{user.mention}` `{user.name}` `{guild.name}` `{membercount}`';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('welcome')
    .setDescription('Configure welcome / leave / DM messages and autoroles')
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
          { name: 'dm', value: 'dm' },
          { name: 'dmmessage', value: 'dmmessage' },
          { name: 'dmtest', value: 'dmtest' },
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
      await interaction.reply({ embeds: [ok(interaction.user, 'channel welcome messages enabled')] });
      return;
    }

    if (sub === 'disable') {
      mutateGuildConfig(guildId, (c) => {
        c.welcome.enabled = false;
      });
      await interaction.reply({ embeds: [ok(interaction.user, 'channel welcome messages disabled')] });
      return;
    }

    if (sub === 'channel') {
      const target = channel ?? interaction.channel;
      if (!target) {
        await interaction.reply({ embeds: [fail(interaction.user, 'Provide a channel')], ephemeral: true });
        return;
      }
      mutateGuildConfig(guildId, (c) => {
        c.welcome.channelId = target.id;
        c.welcome.enabled = true;
      });
      await interaction.reply({ embeds: [ok(interaction.user, `welcome channel → <#${target.id}>`)] });
      return;
    }

    if (sub === 'message') {
      if (!text) {
        await interaction.reply({
          embeds: [fail(interaction.user, `Provide text. Vars: ${VARS}`)],
          ephemeral: true,
        });
        return;
      }
      mutateGuildConfig(guildId, (c) => {
        c.welcome.message = text;
      });
      await interaction.reply({ embeds: [ok(interaction.user, 'channel welcome message updated')] });
      return;
    }

    if (sub === 'dm') {
      mutateGuildConfig(guildId, (c) => {
        c.welcome.dmEnabled = !c.welcome.dmEnabled;
      });
      const enabled = getGuildConfig(guildId).welcome.dmEnabled;
      await interaction.reply({
        embeds: [
          ok(
            interaction.user,
            `DM welcome messages **${enabled ? 'enabled' : 'disabled'}**` +
              (enabled ? `\nSet the text with \`welcome dmmessage ${VARS}\`` : ''),
          ),
        ],
      });
      return;
    }

    if (sub === 'dmmessage') {
      if (!text) {
        await interaction.reply({
          embeds: [fail(interaction.user, `Provide DM text. Vars: ${VARS}`)],
          ephemeral: true,
        });
        return;
      }
      mutateGuildConfig(guildId, (c) => {
        c.welcome.dmMessage = text;
        c.welcome.dmEnabled = true;
      });
      await interaction.reply({
        embeds: [ok(interaction.user, 'DM welcome message updated and DMs enabled')],
      });
      return;
    }

    if (sub === 'dmtest') {
      const member = interaction.guild!.members.cache.get(interaction.user.id) ?? interaction.member;
      if (!member || typeof member === 'string') {
        await interaction.reply({ embeds: [fail(interaction.user, 'Could not resolve your member')], ephemeral: true });
        return;
      }
      const guildMember = member as import('discord.js').GuildMember;
      const cfg = getGuildConfig(guildId);
      const rendered = formatWelcomeText(cfg.welcome.dmMessage, guildMember);
      try {
        await interaction.user.send({ embeds: [buildWelcomeDmEmbed(guildMember, rendered)] });
        await interaction.reply({
          embeds: [ok(interaction.user, 'sent a test welcome DM — check your inbox')],
          ephemeral: true,
        });
      } catch {
        await interaction.reply({
          embeds: [fail(interaction.user, 'Could not DM you (DMs may be closed)')],
          ephemeral: true,
        });
      }
      return;
    }

    if (sub === 'leave') {
      mutateGuildConfig(guildId, (c) => {
        c.welcome.leaveEnabled = !c.welcome.leaveEnabled;
        c.welcome.leaveChannelId = c.welcome.leaveChannelId ?? c.welcome.channelId ?? interaction.channelId;
      });
      const enabled = getGuildConfig(guildId).welcome.leaveEnabled;
      await interaction.reply({ embeds: [ok(interaction.user, `leave messages **${enabled ? 'enabled' : 'disabled'}**`)] });
      return;
    }

    if (sub === 'leavechannel') {
      const target = channel ?? interaction.channel;
      if (!target) {
        await interaction.reply({ embeds: [fail(interaction.user, 'Provide a channel')], ephemeral: true });
        return;
      }
      mutateGuildConfig(guildId, (c) => {
        c.welcome.leaveChannelId = target.id;
        c.welcome.leaveEnabled = true;
      });
      await interaction.reply({ embeds: [ok(interaction.user, `leave channel → <#${target.id}>`)] });
      return;
    }

    if (sub === 'leavemessage') {
      if (!text) {
        await interaction.reply({ embeds: [fail(interaction.user, 'Provide leave message text')], ephemeral: true });
        return;
      }
      mutateGuildConfig(guildId, (c) => {
        c.welcome.leaveMessage = text;
      });
      await interaction.reply({ embeds: [ok(interaction.user, 'leave message updated')] });
      return;
    }

    if (sub === 'autorole') {
      if (!role) {
        await interaction.reply({ embeds: [fail(interaction.user, 'Provide a role')], ephemeral: true });
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
        embeds: [
          ok(
            interaction.user,
            added ? `added autorole **${role.name}**` : `removed autorole **${role.name}**`,
          ),
        ],
      });
      return;
    }

    const w = getGuildConfig(guildId).welcome;
    await interaction.reply({
      embeds: [
        infoEmbed(
          [
            `Channel welcome: **${w.enabled}** → ${w.channelId ? `<#${w.channelId}>` : 'None'}`,
            `Channel msg: ${w.message}`,
            `DM welcome: **${w.dmEnabled}**`,
            `DM msg: ${w.dmMessage}`,
            `Leave: **${w.leaveEnabled}** → ${w.leaveChannelId ? `<#${w.leaveChannelId}>` : 'None'}`,
            `Leave msg: ${w.leaveMessage}`,
            `Autoroles: ${w.autoRoleIds.map((id) => `<@&${id}>`).join(', ') || 'None'}`,
            '',
            `Vars: ${VARS}`,
          ].join('\n'),
          'Welcome / Leave / DM',
        ),
      ],
    });
  },
};

export default command;
