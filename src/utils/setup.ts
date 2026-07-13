import {
  ChannelType,
  Guild,
  OverwriteType,
  PermissionFlagsBits,
  TextChannel,
} from 'discord.js';
import { getGuildConfig, updateGuildConfig } from './guildConfig.js';

export async function runServerSetup(guild: Guild): Promise<string> {
  const me = guild.members.me;
  if (!me) throw new Error('Bot member missing');

  let category = guild.channels.cache.find(
    (c) => c.type === ChannelType.GuildCategory && c.name === 'greed-mod',
  );

  if (!category) {
    category = await guild.channels.create({
      name: 'greed-mod',
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
          ],
        },
      ],
    });
  }

  let logs = guild.channels.cache.find(
    (c) => c.type === ChannelType.GuildText && c.name === 'logs' && c.parentId === category!.id,
  ) as TextChannel | undefined;

  if (!logs) {
    logs = (await guild.channels.create({
      name: 'logs',
      type: ChannelType.GuildText,
      parent: category.id,
      permissionOverwrites: [
        { id: guild.id, deny: [PermissionFlagsBits.ViewChannel] },
        { id: me.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] },
      ],
    })) as TextChannel;
  }

  let jail = guild.channels.cache.find(
    (c) => c.type === ChannelType.GuildText && c.name === 'jail' && c.parentId === category!.id,
  ) as TextChannel | undefined;

  let jailRole = guild.roles.cache.find((r) => r.name.toLowerCase() === 'jailed');
  if (!jailRole) {
    jailRole = await guild.roles.create({
      name: 'jailed',
      color: 0x2b2d31,
      reason: 'Greed-style jail role',
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
          allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory],
        },
        { id: me.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ManageChannels] },
      ],
    })) as TextChannel;
  }

  for (const channel of guild.channels.cache.values()) {
    if (channel.id === jail.id || channel.id === category.id) continue;
    if (!('permissionOverwrites' in channel)) continue;
    await channel.permissionOverwrites
      .edit(jailRole.id, {
        ViewChannel: false,
        SendMessages: false,
        Connect: false,
        Speak: false,
      }, { type: OverwriteType.Role, reason: 'Jail role lockdown' })
      .catch(() => undefined);
  }

  let muteRole = guild.roles.cache.find((r) => r.name.toLowerCase() === 'muted');
  if (!muteRole) {
    muteRole = await guild.roles.create({
      name: 'Muted',
      color: 0x818386,
      reason: 'Mute role',
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

  updateGuildConfig(guild.id, {
    jailRoleId: jailRole.id,
    jailChannelId: jail.id,
    muteRoleId: muteRole.id,
    modLogChannelId: logs.id,
  });

  return [
    `Category: **${category.name}**`,
    `Logs: ${logs}`,
    `Jail: ${jail}`,
    `Jail role: **${jailRole.name}**`,
    `Mute role: **${muteRole.name}**`,
  ].join('\n');
}

export function getPrefix(guildId: string | null | undefined, fallback: string): string {
  if (!guildId) return fallback;
  return getGuildConfig(guildId).prefix ?? fallback;
}
