import { ChannelType, PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import { Command } from '../../types/index.js';
import { getGuildConfig, mutateGuildConfig } from '../../utils/guildConfig.js';
import { ok, fail, infoEmbed } from '../../utils/embeds.js';
import {
  addTicketType,
  buildTicketPanelComponents,
  buildTicketPanelEmbed,
  closeTicket,
  ensureTicketCategory,
  getTicketRecord,
  openTicket,
  removeTicketType,
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
          { name: 'typeadd', value: 'typeadd' },
          { name: 'typeremove', value: 'typeremove' },
          { name: 'typelist', value: 'typelist' },
          { name: 'close', value: 'close' },
          { name: 'add', value: 'add' },
          { name: 'remove', value: 'remove' },
          { name: 'view', value: 'view' },
        ),
    )
    .addStringOption((opt) =>
      opt.setName('value').setDescription('Type id (for typeadd / typeremove)'),
    )
    .addStringOption((opt) =>
      opt.setName('text').setDescription('Panel message, or type label for typeadd'),
    )
    .addChannelOption((opt) =>
      opt
        .setName('channel')
        .setDescription('Category for typeadd (or leave empty)')
        .addChannelTypes(ChannelType.GuildCategory),
    )
    .addUserOption((opt) => opt.setName('user').setDescription('Member to add/remove'))
    .addRoleOption((opt) => opt.setName('role').setDescription('Support role for ticket staff')),
  guildOnly: true,
  async execute(interaction) {
    const sub = interaction.options.getString('subcommand', true);
    const guild = interaction.guild!;
    const guildId = guild.id;
    const text = interaction.options.getString('text');
    const value = interaction.options.getString('value');
    const targetUser = interaction.options.getUser('user');
    const categoryChannel = interaction.options.getChannel('channel');
    const member = interaction.member as import('discord.js').GuildMember;

    const needsManageGuild =
      sub === 'setup' ||
      sub === 'panel' ||
      sub === 'category' ||
      sub === 'support' ||
      sub === 'message' ||
      sub === 'typeadd' ||
      sub === 'typeremove' ||
      sub === 'typelist' ||
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
      const components = buildTicketPanelComponents(cfg.tickets);
      const message = await channel.send({ embeds: [embed], components });

      mutateGuildConfig(guildId, (c) => {
        c.tickets.categoryId = categoryId;
        c.tickets.panelChannelId = interaction.channelId;
        c.tickets.panelMessageId = message.id;
      });

      await interaction.reply({
        embeds: [
          ok(
            interaction.user,
            `ticket system ready · default category <#${categoryId}> · panel posted in ${interaction.channel}` +
              (cfg.tickets.types.length
                ? `\nAdd more types with \`ticket typeadd\` then re-run \`ticket panel\``
                : `\nAdd types with \`ticket typeadd <id> <categoryId> <label>\` then \`ticket panel\``),
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
      const components = buildTicketPanelComponents(cfg.tickets);
      const message = await channel.send({ embeds: [embed], components });

      mutateGuildConfig(guildId, (c) => {
        c.tickets.panelChannelId = interaction.channelId;
        c.tickets.panelMessageId = message.id;
      });

      await interaction.reply({
        embeds: [
          ok(
            interaction.user,
            `ticket panel posted` +
              (cfg.tickets.types.length
                ? ` with **${cfg.tickets.types.length}** type(s)`
                : ` (single Open Ticket button — add types with \`ticket typeadd\`)`),
          ),
        ],
        ephemeral: true,
      });
      return;
    }

    if (sub === 'category') {
      const categoryId = await ensureTicketCategory(guild);
      await interaction.reply({
        embeds: [
          ok(
            interaction.user,
            `default ticket category set to <#${categoryId}> (used when no types are configured)`,
          ),
        ],
      });
      return;
    }

    if (sub === 'typeadd') {
      const id = value;
      let label = text?.trim() ?? '';
      let cat =
        categoryChannel ??
        (interaction as unknown as { message?: import('discord.js').Message }).message?.mentions
          .channels.first() ??
        null;

      // Allow raw category id in the rest text: typeadd support 123456789012345678 General Support
      if ((!cat || cat.type !== ChannelType.GuildCategory) && label) {
        const idMatch = label.match(/^(\d{17,20})\b\s*(.*)$/s);
        if (idMatch) {
          const byId = guild.channels.cache.get(idMatch[1]);
          if (byId) {
            cat = byId;
            label = idMatch[2].trim();
          }
        }
      }

      if (!id || !label) {
        await interaction.reply({
          embeds: [
            fail(
              interaction.user,
              [
                'Usage: `ticket typeadd <id> <category> <label>`',
                'Category = mention **or** category ID (Developer Mode → right-click category → Copy Channel ID)',
                'Example: `ticket typeadd support 123456789012345678 General Support`',
              ].join('\n'),
            ),
          ],
          ephemeral: true,
        });
        return;
      }

      if (!cat || cat.type !== ChannelType.GuildCategory) {
        await interaction.reply({
          embeds: [
            fail(
              interaction.user,
              'Provide a **category** (folder), not a text channel. Paste the category ID if `#` only shows channels.',
            ),
          ],
          ephemeral: true,
        });
        return;
      }

      const result = addTicketType(guildId, {
        id,
        label,
        categoryId: cat.id,
      });

      if ('error' in result) {
        await interaction.reply({ embeds: [fail(interaction.user, result.error)], ephemeral: true });
        return;
      }

      await interaction.reply({
        embeds: [
          ok(
            interaction.user,
            `added type **${result.label}** (\`${result.id}\`) → <#${result.categoryId}>\nRe-post the panel with \`ticket panel\` so members see it.`,
          ),
        ],
      });
      return;
    }

    if (sub === 'typeremove') {
      if (!value) {
        await interaction.reply({
          embeds: [fail(interaction.user, 'Usage: `ticket typeremove <id>`')],
          ephemeral: true,
        });
        return;
      }
      const removed = removeTicketType(guildId, value);
      if (!removed) {
        await interaction.reply({
          embeds: [fail(interaction.user, `No ticket type \`${value}\` found`)],
          ephemeral: true,
        });
        return;
      }
      await interaction.reply({
        embeds: [
          ok(
            interaction.user,
            `removed type \`${value}\` — re-run \`ticket panel\` to update the public panel`,
          ),
        ],
      });
      return;
    }

    if (sub === 'typelist') {
      const types = getGuildConfig(guildId).tickets.types;
      if (!types.length) {
        await interaction.reply({
          embeds: [
            infoEmbed(
              'No ticket types yet.\nAdd one: `ticket typeadd support 123456789012345678 General Support`',
              'Ticket Types',
            ),
          ],
        });
        return;
      }
      await interaction.reply({
        embeds: [
          infoEmbed(
            types
              .map(
                (t, i) =>
                  `**${i + 1}.** \`${t.id}\` — **${t.label}** → <#${t.categoryId}>` +
                  (t.description ? `\n└ ${t.description}` : ''),
              )
              .join('\n'),
            'Ticket Types',
          ),
        ],
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
    const typeLines = t.types.length
      ? t.types.map((ty) => `• \`${ty.id}\` **${ty.label}** → <#${ty.categoryId}>`).join('\n')
      : '_None — using single Open Ticket button_';

    await interaction.reply({
      embeds: [
        infoEmbed(
          [
            `Default category: ${t.categoryId ? `<#${t.categoryId}>` : 'Not set'}`,
            `Panel: ${t.panelChannelId && t.panelMessageId ? `<#${t.panelChannelId}>` : 'Not posted'}`,
            `Support roles: ${t.supportRoleIds.map((id) => `<@&${id}>`).join(', ') || 'None'}`,
            `Open tickets: **${openCount}**`,
            `Next ticket #: **${t.nextNumber}**`,
            '',
            `**Types:**`,
            typeLines,
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
