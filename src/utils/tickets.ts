import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  EmbedBuilder,
  Guild,
  GuildMember,
  OverwriteType,
  PermissionFlagsBits,
  StringSelectMenuBuilder,
  TextChannel,
  User,
} from 'discord.js';
import {
  getGuildConfig,
  mutateGuildConfig,
  TicketType,
  TicketsConfig,
} from './guildConfig.js';
import { Colors } from './embeds.js';
import { canBypass } from './permissions.js';
import { bolt } from './emojis.js';

const CATEGORY_NAME = 'tickets';

export function buildTicketPanelEmbed(cfg: TicketsConfig, guildName: string): EmbedBuilder {
  const typeLines =
    cfg.types.length > 0
      ? [
          '',
          '**Options:**',
          ...cfg.types.map((t) => `• **${t.label}**${t.description ? ` — ${t.description}` : ''}`),
        ]
      : [];

  return new EmbedBuilder()
    .setColor(Colors.success)
    .setTitle(cfg.title)
    .setDescription([cfg.description, ...typeLines].join('\n'))
    .setFooter({ text: `${guildName} · Support` })
    .setTimestamp();
}

/** Panel components: select menu when types exist, else a single Open Ticket button */
export function buildTicketPanelComponents(
  cfg: TicketsConfig,
): ActionRowBuilder<ButtonBuilder | StringSelectMenuBuilder>[] {
  if (cfg.types.length > 0) {
    const select = new StringSelectMenuBuilder()
      .setCustomId('ticket:type')
      .setPlaceholder('Choose a ticket type…')
      .addOptions(
        cfg.types.slice(0, 25).map((t) => {
          const option: {
            label: string;
            value: string;
            description?: string;
            emoji?: string;
          } = {
            label: t.label.slice(0, 100),
            value: t.id,
          };
          if (t.description) option.description = t.description.slice(0, 100);
          if (t.emoji) option.emoji = t.emoji;
          return option;
        }),
      );

    return [new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(select)];
  }

  return [
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId('ticket:open')
        .setLabel('Open Ticket')
        .setEmoji('🎫')
        .setStyle(ButtonStyle.Success),
    ),
  ];
}

/** @deprecated use buildTicketPanelComponents */
export function buildTicketPanelRow(): ActionRowBuilder<ButtonBuilder> {
  return buildTicketPanelComponents({
    supportRoleIds: [],
    title: '',
    description: '',
    types: [],
    open: {},
    nextNumber: 1,
  })[0] as ActionRowBuilder<ButtonBuilder>;
}

export function buildTicketCloseRow(channelId: string): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`ticket:close:${channelId}`)
      .setLabel('Close Ticket')
      .setEmoji('🔒')
      .setStyle(ButtonStyle.Danger),
  );
}

export function findOpenTicketChannelId(guildId: string, userId: string): string | undefined {
  const cfg = getGuildConfig(guildId);
  for (const [channelId, record] of Object.entries(cfg.tickets.open)) {
    if (record.ownerId === userId) return channelId;
  }
  return undefined;
}

export function getTicketRecord(guildId: string, channelId: string) {
  return getGuildConfig(guildId).tickets.open[channelId];
}

export function getTicketType(guildId: string, typeId: string): TicketType | undefined {
  return getGuildConfig(guildId).tickets.types.find((t) => t.id === typeId);
}

export function clearTicketChannel(guildId: string, channelId: string): void {
  mutateGuildConfig(guildId, (c) => {
    delete c.tickets.open[channelId];
  });
}

export function canManageTicket(
  member: GuildMember,
  guildId: string,
  ownerId: string,
): boolean {
  if (canBypass(member.id)) return true;
  if (member.id === ownerId) return true;
  if (member.permissions.has(PermissionFlagsBits.ManageChannels)) return true;

  const cfg = getGuildConfig(guildId);
  if (cfg.tickets.supportRoleIds.some((id) => member.roles.cache.has(id))) return true;
  if (cfg.staffRoleIds.some((id) => member.roles.cache.has(id))) return true;
  return false;
}

function sanitizeUsername(username: string): string {
  return username
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .slice(0, 12) || 'user';
}

function sanitizeTypeId(raw: string): string {
  return raw
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9_-]/g, '')
    .slice(0, 32);
}

export async function ensureTicketCategory(guild: Guild): Promise<string> {
  const cfg = getGuildConfig(guild.id);
  if (cfg.tickets.categoryId) {
    const existing = guild.channels.cache.get(cfg.tickets.categoryId);
    if (existing?.type === ChannelType.GuildCategory) return existing.id;
  }

  let category = guild.channels.cache.find(
    (c) => c.type === ChannelType.GuildCategory && c.name.toLowerCase() === CATEGORY_NAME,
  );

  if (!category) {
    category = await guild.channels.create({
      name: CATEGORY_NAME,
      type: ChannelType.GuildCategory,
      permissionOverwrites: [
        { id: guild.id, deny: [PermissionFlagsBits.ViewChannel] },
      ],
      reason: 'Blaze ticket category',
    });
  }

  mutateGuildConfig(guild.id, (c) => {
    c.tickets.categoryId = category!.id;
  });

  return category.id;
}

export function addTicketType(
  guildId: string,
  input: { id: string; label: string; categoryId: string; description?: string; emoji?: string },
): TicketType | { error: string } {
  const id = sanitizeTypeId(input.id);
  if (!id) return { error: 'Invalid type id (use letters, numbers, - or _)' };
  if (!input.label.trim()) return { error: 'Provide a label for this ticket type' };

  const cfg = getGuildConfig(guildId);
  if (cfg.tickets.types.length >= 25) return { error: 'Maximum of 25 ticket types' };
  if (cfg.tickets.types.some((t) => t.id === id)) {
    return { error: `Type \`${id}\` already exists — remove it first or pick another id` };
  }

  const type: TicketType = {
    id,
    label: input.label.trim().slice(0, 100),
    categoryId: input.categoryId,
    description: input.description?.trim().slice(0, 100) || undefined,
    emoji: input.emoji?.trim() || undefined,
  };

  mutateGuildConfig(guildId, (c) => {
    c.tickets.types.push(type);
  });

  return type;
}

export function removeTicketType(guildId: string, typeId: string): boolean {
  const id = sanitizeTypeId(typeId);
  const before = getGuildConfig(guildId).tickets.types.length;
  mutateGuildConfig(guildId, (c) => {
    c.tickets.types = c.tickets.types.filter((t) => t.id !== id);
  });
  return getGuildConfig(guildId).tickets.types.length < before;
}

export async function openTicket(
  guild: Guild,
  user: User,
  typeId?: string,
): Promise<{ channel: TextChannel } | { error: string }> {
  const existingId = findOpenTicketChannelId(guild.id, user.id);
  if (existingId) {
    const existing = guild.channels.cache.get(existingId);
    if (existing?.isTextBased()) {
      return { error: `You already have an open ticket: ${existing}` };
    }
    clearTicketChannel(guild.id, existingId);
  }

  const me = guild.members.me;
  if (!me) return { error: 'Bot member missing' };

  const cfg = getGuildConfig(guild.id);
  let ticketType: TicketType | undefined;
  let categoryId: string;

  if (typeId) {
    ticketType = cfg.tickets.types.find((t) => t.id === typeId);
    if (!ticketType) return { error: 'Unknown ticket type — ask staff to update the panel' };
    const cat = guild.channels.cache.get(ticketType.categoryId);
    if (!cat || cat.type !== ChannelType.GuildCategory) {
      return { error: `Category for **${ticketType.label}** is missing — ask staff to fix it` };
    }
    categoryId = ticketType.categoryId;
  } else {
    categoryId = await ensureTicketCategory(guild);
  }

  let number = 1;
  mutateGuildConfig(guild.id, (c) => {
    number = c.tickets.nextNumber;
    c.tickets.nextNumber += 1;
  });

  const overwrites: {
    id: string;
    type?: OverwriteType;
    allow?: bigint[];
    deny?: bigint[];
  }[] = [
    { id: guild.id, deny: [PermissionFlagsBits.ViewChannel] },
    {
      id: user.id,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ReadMessageHistory,
        PermissionFlagsBits.AttachFiles,
        PermissionFlagsBits.EmbedLinks,
      ],
    },
    {
      id: me.id,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ReadMessageHistory,
        PermissionFlagsBits.ManageChannels,
        PermissionFlagsBits.ManageMessages,
        PermissionFlagsBits.EmbedLinks,
      ],
    },
  ];

  for (const roleId of cfg.tickets.supportRoleIds) {
    overwrites.push({
      id: roleId,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ReadMessageHistory,
        PermissionFlagsBits.ManageMessages,
        PermissionFlagsBits.AttachFiles,
        PermissionFlagsBits.EmbedLinks,
      ],
    });
  }

  const typeSlug = ticketType ? `-${sanitizeTypeId(ticketType.id).slice(0, 10)}` : '';
  const channel = (await guild.channels.create({
    name: `ticket${typeSlug}-${String(number).padStart(4, '0')}-${sanitizeUsername(user.username)}`,
    type: ChannelType.GuildText,
    parent: categoryId,
    topic: ticketType
      ? `Ticket #${number} · ${ticketType.label} · ${user.tag} (${user.id})`
      : `Ticket #${number} · ${user.tag} (${user.id})`,
    permissionOverwrites: overwrites,
    reason: `Ticket opened by ${user.tag}${ticketType ? ` (${ticketType.label})` : ''}`,
  })) as TextChannel;

  mutateGuildConfig(guild.id, (c) => {
    c.tickets.open[channel.id] = {
      ownerId: user.id,
      number,
      createdAt: Date.now(),
      typeId: ticketType?.id,
    };
  });

  const supportMention =
    cfg.tickets.supportRoleIds.map((id) => `<@&${id}>`).join(' ') || null;

  const embed = new EmbedBuilder()
    .setColor(Colors.success)
    .setTitle(`${bolt()} Ticket #${number}${ticketType ? ` · ${ticketType.label}` : ''}`)
    .setDescription(
      [
        `Welcome ${user}!`,
        ticketType ? `**Type:** ${ticketType.label}` : null,
        '',
        'Please describe your issue and a staff member will assist you shortly.',
        '',
        'When you are done, click **Close Ticket** or ask staff to close it.',
      ]
        .filter(Boolean)
        .join('\n'),
    )
    .setFooter({ text: `Opened by ${user.tag}` })
    .setTimestamp();

  await channel.send({
    content: supportMention ? `${user} · ${supportMention}` : `${user}`,
    embeds: [embed],
    components: [buildTicketCloseRow(channel.id)],
  });

  return { channel };
}

export async function closeTicket(
  channel: TextChannel,
  closer: User,
): Promise<{ ok: true } | { error: string }> {
  const record = getTicketRecord(channel.guild.id, channel.id);
  if (!record) return { error: 'This is not an active ticket channel' };

  const member =
    channel.guild.members.cache.get(closer.id) ??
    (await channel.guild.members.fetch(closer.id).catch(() => null));
  if (!member || !canManageTicket(member, channel.guild.id, record.ownerId)) {
    return { error: 'You cannot close this ticket' };
  }

  clearTicketChannel(channel.guild.id, channel.id);

  const closing = await channel
    .send({
      embeds: [
        new EmbedBuilder()
          .setColor(Colors.success)
          .setDescription(`🔒 Ticket closed by ${closer}. This channel will be deleted in **5** seconds.`),
      ],
      components: [],
    })
    .catch(() => null);

  setTimeout(() => {
    channel.delete(`Ticket closed by ${closer.tag}`).catch(() => undefined);
  }, 5000);

  if (closing) {
    const messages = await channel.messages.fetch({ limit: 20 }).catch(() => null);
    if (messages) {
      for (const msg of messages.values()) {
        if (msg.id !== closing.id && msg.deletable) {
          await msg.delete().catch(() => undefined);
        }
      }
    }
  }

  return { ok: true };
}
