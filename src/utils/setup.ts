import {
  ChannelType,
  Guild,
  OverwriteType,
  PermissionFlagsBits,
  TextChannel,
} from 'discord.js';
import { getGuildConfig, LogChannels, updateGuildConfig } from './guildConfig.js';

const CATEGORY_NAME = 'blaze mod';
const OLD_CATEGORY_NAMES = ['greed-mod', 'greed mod'];

type LogChannelDef = {
  key: Exclude<keyof LogChannels, 'roles'>;
  name: string;
  topic: string;
};

const LOG_CHANNELS: LogChannelDef[] = [
  { key: 'bans', name: 'bans', topic: 'Ban · Unban · Kick' },
  { key: 'mutes', name: 'mutes', topic: 'Mute · Unmute · Timeout' },
  { key: 'jail', name: 'jail-logs', topic: 'Jail · Unjail' },
  { key: 'purge', name: 'purge', topic: 'Message purges' },
  { key: 'server', name: 'server', topic: 'Roles · Channel create/delete' },
  { key: 'messages', name: 'messages', topic: 'Message delete history' },
];

async function ensureTextChannel(
  guild: Guild,
  categoryId: string,
  name: string,
  topic: string,
  botId: string,
): Promise<TextChannel> {
  const existing = guild.channels.cache.find(
    (c) => c.type === ChannelType.GuildText && c.name === name && c.parentId === categoryId,
  ) as TextChannel | undefined;

  if (existing) {
    if (existing.topic !== topic) {
      await existing.setTopic(topic).catch(() => undefined);
    }
    return existing;
  }

  return (await guild.channels.create({
    name,
    type: ChannelType.GuildText,
    parent: categoryId,
    topic,
    permissionOverwrites: [
      { id: guild.id, deny: [PermissionFlagsBits.ViewChannel] },
      {
        id: botId,
        allow: [
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.SendMessages,
          PermissionFlagsBits.EmbedLinks,
          PermissionFlagsBits.ReadMessageHistory,
        ],
      },
    ],
  })) as TextChannel;
}

export async function runServerSetup(guild: Guild): Promise<string> {
  const me = guild.members.me;
  if (!me) throw new Error('Bot member missing');

  let category = guild.channels.cache.find(
    (c) => c.type === ChannelType.GuildCategory && c.name.toLowerCase() === CATEGORY_NAME,
  );

  if (!category) {
    const legacy = guild.channels.cache.find(
      (c) =>
        c.type === ChannelType.GuildCategory &&
        OLD_CATEGORY_NAMES.includes(c.name.toLowerCase()),
    );
    if (legacy) {
      category = await legacy.setName(CATEGORY_NAME);
    }
  }

  if (!category) {
    category = await guild.channels.create({
      name: CATEGORY_NAME,
      type: ChannelType.GuildCategory,
      permissionOverwrites: [
        { id: guild.id, deny: [PermissionFlagsBits.ViewChannel] },
        {
          id: me.id,
          allow: [
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.SendMessages,
            PermissionFlagsBits.ManageChannels,
            PermissionFlagsBits.ManageRoles,
            PermissionFlagsBits.EmbedLinks,
          ],
        },
      ],
    });
  }

  // Rename legacy `#roles` → `#server` in blaze mod
  const legacyRoles = guild.channels.cache.find(
    (c) =>
      c.type === ChannelType.GuildText &&
      c.name === 'roles' &&
      c.parentId === category.id,
  ) as TextChannel | undefined;
  const existingServer = guild.channels.cache.find(
    (c) =>
      c.type === ChannelType.GuildText &&
      c.name === 'server' &&
      c.parentId === category.id,
  );
  if (legacyRoles && !existingServer) {
    await legacyRoles.setName('server').catch(() => undefined);
    await legacyRoles.setTopic('Roles · Channel create/delete').catch(() => undefined);
  }

  const logChannels: LogChannels = { ...getGuildConfig(guild.id).logChannels };
  delete logChannels.roles;
  const createdLines: string[] = [];

  for (const def of LOG_CHANNELS) {
    const ch = await ensureTextChannel(guild, category.id, def.name, def.topic, me.id);
    logChannels[def.key] = ch.id;
    createdLines.push(`${def.topic}: ${ch}`);
  }

  // Primary/general logs pointer (bans channel as default mod log)
  const primaryLogsId = logChannels.bans!;

  let jail = guild.channels.cache.find(
    (c) => c.type === ChannelType.GuildText && c.name === 'jail' && c.parentId === category!.id,
  ) as TextChannel | undefined;

  let jailRole = guild.roles.cache.find((r) => r.name.toLowerCase() === 'jailed');
  if (!jailRole) {
    jailRole = await guild.roles.create({
      name: 'jailed',
      color: 0x2b2d31,
      reason: 'Blaze jail role',
    });
  }

  if (!jail) {
    jail = (await guild.channels.create({
      name: 'jail',
      type: ChannelType.GuildText,
      parent: category.id,
      permissionOverwrites: [
        { id: guild.id, deny: [PermissionFlagsBits.ViewChannel] },
        {
          id: jailRole.id,
          allow: [
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.SendMessages,
            PermissionFlagsBits.ReadMessageHistory,
          ],
        },
        {
          id: me.id,
          allow: [
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.SendMessages,
            PermissionFlagsBits.ManageChannels,
          ],
        },
      ],
    })) as TextChannel;
  }

  for (const channel of guild.channels.cache.values()) {
    if (channel.id === jail.id || channel.id === category.id) continue;
    if (!('permissionOverwrites' in channel)) continue;
    await channel.permissionOverwrites
      .edit(
        jailRole.id,
        {
          ViewChannel: false,
          SendMessages: false,
          Connect: false,
          Speak: false,
        },
        { type: OverwriteType.Role, reason: 'Jail role lockdown' },
      )
      .catch(() => undefined);
  }

  let muteRole = guild.roles.cache.find((r) => r.name.toLowerCase() === 'muted');
  if (!muteRole) {
    muteRole = await guild.roles.create({
      name: 'Muted',
      color: 0x818386,
      reason: 'Blaze mute role',
    });
  }

  for (const channel of guild.channels.cache.values()) {
    if (!('permissionOverwrites' in channel)) continue;
    await channel.permissionOverwrites
      .edit(muteRole.id, {
        SendMessages: false,
        AddReactions: false,
        Speak: false,
      })
      .catch(() => undefined);
  }

  const prev = getGuildConfig(guild.id);
  updateGuildConfig(guild.id, {
    jailRoleId: jailRole.id,
    jailChannelId: jail.id,
    muteRoleId: muteRole.id,
    modLogChannelId: primaryLogsId,
    logChannels,
    logging: {
      ...prev.logging,
      enabled: true,
      channelId: primaryLogsId,
      events: {
        ...prev.logging.events,
        messageDelete: true,
        memberBan: true,
        memberUnban: true,
        memberRole: true,
      },
    },
  });

  return [
    `Category: **${category.name}**`,
    '',
    '**Log channels**',
    ...createdLines,
    '',
    `Jail: ${jail}`,
    `Jail role: **${jailRole.name}**`,
    `Mute role: **${muteRole.name}**`,
  ].join('\n');
}

export function getPrefix(guildId: string | null | undefined, fallback: string): string {
  if (!guildId) return fallback;
  return getGuildConfig(guildId).prefix ?? fallback;
}
