import { PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import { Command } from '../../types/index.js';
import { getGuildConfig, mutateGuildConfig } from '../../utils/guildConfig.js';
import { ok, fail, infoEmbed } from '../../utils/embeds.js';
import {
  buildTicketPanelEmbed,
  buildTicketPanelRow,
  closeTicket,
  ensureTicketCategory,
  getTicketRecord,
  openTicket,
} from '../../utils/tickets.js';
import { canBypass } from '../../utils/permissions.js';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('ticket')
    .setDescription('Configure support tickets or manage your ticket')
    .addStringOption((opt) =>
      opt
        .setName('subcommand')
        .setDescription('Action')
        .setRequired(true)
        .addChoices(
          { name: 'setup', value: 'setup' },
          { name: 'panel', value: 'panel' },
          { name: 'category', value: 'category' },
          { name: 'support', value: 'support' },
          { name: 'message', value: 'message' },
          { name: 'close', value: 'close' },
          { name: 'add', value: 'add' },
          { name: 'remove', value: 'remove' },
          { name: 'view', value: 'view' },
        ),
    )
    .addStringOption((opt) => opt.setName('text').setDescription('Panel message text'))
    .addUserOption((opt) => opt.setName('user').setDescription('Member to add/remove'))
    .addRoleOption((opt) => opt.setName('role').setDescription('Support role for ticket staff')),
  guildOnly: true,
  async execute(interaction) {
    const sub = interaction.options.getString('subcommand', true);
    const guild = interaction.guild!;
    const guildId = guild.id;
    const text = interaction.options.getString('text');
    const targetUser = interaction.options.getUser('user');
    const member = interaction.member as import('discord.js').GuildMember;

    const needsManageGuild =
      sub === 'setup' ||
      sub === 'panel' ||
      sub === 'category' ||
      sub === 'support' ||
      sub === 'message' ||
      sub === 'view';

    if (
      needsManageGuild &&
      !canBypass(interaction.user.id) &&
      !member.permissions.has(PermissionFlagsBits.ManageGuild)
    ) {
      await interaction.reply({
        embeds: [fail(interaction.user, 'You need **Manage Server** for that')],
        ephemeral: true,
      });
      return;
    }

    if (sub === 'setup') {
      const channel = interaction.channel;
      if (!channel?.isTextBased() || !channel.isSendable()) {
        await interaction.reply({ embeds: [fail(interaction.user, 'Cannot post a panel here')], ephemeral: true });
        return;
      }

      const categoryId = await ensureTicketCategory(guild);
      const cfg = getGuildConfig(guildId);
      const embed = buildTicketPanelEmbed(cfg.tickets, guild.name);
      const row = buildTicketPanelRow();
      const message = await channel.send({ embeds: [embed], components: [row] });

      mutateGuildConfig(guildId, (c) => {
        c.tickets.categoryId = categoryId;
        c.tickets.panelChannelId = interaction.channelId;
        c.tickets.panelMessageId = message.id;
      });

      await interaction.reply({
        embeds: [
          ok(
            interaction.user,
            `ticket system ready · category <#${categoryId}> · panel posted in ${interaction.channel}`,
          ),
        ],
        ephemeral: true,
      });
      return;
    }

    if (sub === 'panel') {
      const channel = interaction.channel;
      if (!channel?.isTextBased() || !channel.isSendable()) {
        await interaction.reply({ embeds: [fail(interaction.user, 'Cannot post a panel here')], ephemeral: true });
        return;
      }

      const cfg = getGuildConfig(guildId);
      const embed = buildTicketPanelEmbed(cfg.tickets, guild.name);
      const row = buildTicketPanelRow();
      const message = await channel.send({ embeds: [embed], components: [row] });

      mutateGuildConfig(guildId, (c) => {
        c.tickets.panelChannelId = interaction.channelId;
        c.tickets.panelMessageId = message.id;
      });

      await interaction.reply({
        embeds: [ok(interaction.user, `ticket panel posted in ${interaction.channel}`)],
        ephemeral: true,
      });
      return;
    }

    if (sub === 'category') {
      const categoryId = await ensureTicketCategory(guild);
      await interaction.reply({
        embeds: [ok(interaction.user, `ticket category set to <#${categoryId}>`)],
      });
      return;
    }

    if (sub === 'support') {
      const role =
        interaction.options.getRole('role') ??
        (interaction as unknown as { message?: import('discord.js').Message }).message?.mentions.roles.first();
      if (!role) {
        await interaction.reply({
          embeds: [fail(interaction.user, 'Mention a support role')],
          ephemeral: true,
        });
        return;
      }

      let added = false;
      mutateGuildConfig(guildId, (c) => {
        if (c.tickets.supportRoleIds.includes(role.id)) {
          c.tickets.supportRoleIds = c.tickets.supportRoleIds.filter((id) => id !== role.id);
        } else {
          c.tickets.supportRoleIds.push(role.id);
          added = true;
        }
      });

      await interaction.reply({
        embeds: [
          ok(
            interaction.user,
            added
              ? `added **${role.name}** as a ticket support role`
              : `removed **${role.name}** from ticket support roles`,
          ),
        ],
      });
      return;
    }

    if (sub === 'message') {
      if (!text) {
        await interaction.reply({
          embeds: [fail(interaction.user, 'Provide panel message text')],
          ephemeral: true,
        });
        return;
      }

      mutateGuildConfig(guildId, (c) => {
        c.tickets.description = text.replace(/\\n/g, '\n');
      });

      await interaction.reply({ embeds: [ok(interaction.user, 'ticket panel message updated')] });
      return;
    }

    if (sub === 'close') {
      if (!interaction.channel?.isTextBased() || interaction.channel.isDMBased()) {
        await interaction.reply({ embeds: [fail(interaction.user, 'Use this inside a ticket channel')], ephemeral: true });
        return;
      }

      const result = await closeTicket(interaction.channel as import('discord.js').TextChannel, interaction.user);
      if ('error' in result) {
        await interaction.reply({ embeds: [fail(interaction.user, result.error)], ephemeral: true });
        return;
      }

      await interaction.reply({ embeds: [ok(interaction.user, 'closing ticket…')] });
      return;
    }

    if (sub === 'add' || sub === 'remove') {
      if (!interaction.channel?.isTextBased() || interaction.channel.isDMBased()) {
        await interaction.reply({ embeds: [fail(interaction.user, 'Use this inside a ticket channel')], ephemeral: true });
        return;
      }

      const record = getTicketRecord(guildId, interaction.channelId);
      if (!record) {
        await interaction.reply({ embeds: [fail(interaction.user, 'This is not a ticket channel')], ephemeral: true });
        return;
      }

      if (!targetUser) {
        await interaction.reply({ embeds: [fail(interaction.user, 'Mention a user')], ephemeral: true });
        return;
      }

      const channel = interaction.channel as import('discord.js').TextChannel;
      if (sub === 'add') {
        await channel.permissionOverwrites.edit(targetUser.id, {
          ViewChannel: true,
          SendMessages: true,
          ReadMessageHistory: true,
          AttachFiles: true,
          EmbedLinks: true,
        });
        await interaction.reply({ embeds: [ok(interaction.user, `added ${targetUser} to this ticket`)] });
        return;
      }

      if (targetUser.id === record.ownerId) {
        await interaction.reply({ embeds: [fail(interaction.user, 'You cannot remove the ticket owner')], ephemeral: true });
        return;
      }

      await channel.permissionOverwrites.delete(targetUser.id);
      await interaction.reply({ embeds: [ok(interaction.user, `removed ${targetUser} from this ticket`)] });
      return;
    }

    const t = getGuildConfig(guildId).tickets;
    const openCount = Object.keys(t.open).length;
    await interaction.reply({
      embeds: [
        infoEmbed(
          [
            `Category: ${t.categoryId ? `<#${t.categoryId}>` : 'Not set (run \`ticket setup\`)'}`,
            `Panel: ${t.panelChannelId && t.panelMessageId ? `<#${t.panelChannelId}> (${t.panelMessageId})` : 'Not posted'}`,
            `Support roles: ${t.supportRoleIds.map((id) => `<@&${id}>`).join(', ') || 'None'}`,
            `Open tickets: **${openCount}**`,
            `Next ticket #: **${t.nextNumber}**`,
            '',
            `**Title:** ${t.title}`,
            `**Message:** ${t.description}`,
          ].join('\n'),
          'Tickets',
        ),
      ],
    });
  },
};

export default command;
