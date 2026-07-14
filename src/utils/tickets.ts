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
  TextChannel,
  User,
} from 'discord.js';
import { getGuildConfig, mutateGuildConfig, TicketsConfig } from './guildConfig.js';
import { Colors } from './embeds.js';
import { canBypass } from './permissions.js';

const CATEGORY_NAME = 'tickets';

export function buildTicketPanelEmbed(cfg: TicketsConfig, guildName: string): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(Colors.success)
    .setTitle(cfg.title)
    .setDescription(cfg.description)
    .setFooter({ text: `${guildName} · Support` })
    .setTimestamp();
}

export function buildTicketPanelRow(): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId('ticket:open')
      .setLabel('Open Ticket')
      .setEmoji('🎫')
      .setStyle(ButtonStyle.Success),
  );
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

export async function openTicket(
  guild: Guild,
  user: User,
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

  const categoryId = await ensureTicketCategory(guild);
  let number = 1;
  mutateGuildConfig(guild.id, (c) => {
    number = c.tickets.nextNumber;
    c.tickets.nextNumber += 1;
  });

  const cfg = getGuildConfig(guild.id);
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

  const channel = (await guild.channels.create({
    name: `ticket-${String(number).padStart(4, '0')}-${sanitizeUsername(user.username)}`,
    type: ChannelType.GuildText,
    parent: categoryId,
    topic: `Ticket #${number} · ${user.tag} (${user.id})`,
    permissionOverwrites: overwrites,
    reason: `Ticket opened by ${user.tag}`,
  })) as TextChannel;

  mutateGuildConfig(guild.id, (c) => {
    c.tickets.open[channel.id] = {
      ownerId: user.id,
      number,
      createdAt: Date.now(),
    };
  });

  const supportMention =
    cfg.tickets.supportRoleIds.map((id) => `<@&${id}>`).join(' ') || null;

  const embed = new EmbedBuilder()
    .setColor(Colors.success)
    .setTitle(`🎫 Ticket #${number}`)
    .setDescription(
      [
        `Welcome ${user}!`,
        '',
        'Please describe your issue and a staff member will assist you shortly.',
        '',
        'When you are done, click **Close Ticket** or ask staff to close it.',
      ].join('\n'),
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
