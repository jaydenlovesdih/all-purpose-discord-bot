import { AuditLogEvent, Events } from 'discord.js';
import { BotClient } from '../types/index.js';
import { getGuildConfig } from '../utils/guildConfig.js';
import { sendLog } from '../utils/log.js';

export default {
  name: Events.GuildMemberRemove,
  async execute(
    member: import('discord.js').GuildMember | import('discord.js').PartialGuildMember,
    client: BotClient,
  ) {
    const guild = member.guild;
    const cfg = getGuildConfig(guild.id);
    const user = member.user;

    const logs = await guild.fetchAuditLogs({ type: AuditLogEvent.MemberKick, limit: 1 }).catch(() => null);
    const entry = logs?.entries.first();
    const kicked =
      entry &&
      user &&
      entry.target?.id === member.id &&
      Date.now() - entry.createdTimestamp < 8_000;

    if (kicked && entry.executor?.id !== client.user?.id) {
      await sendLog(
        guild,
        'memberBan',
        'User Kicked',
        `**${user.username}** has been kicked.`,
        undefined,
        {
          emoji: '👢',
          target: user,
          moderator: entry.executor ?? null,
          reason: entry.reason ?? 'No reason provided',
          footer: `User ID: ${member.id}`,
        },
      );
    } else if (!kicked) {
      await sendLog(
        guild,
        'memberLeave',
        'Member Left',
        `**${user?.username ?? member.id}** left the server.`,
        undefined,
        {
          emoji: '👋',
          target: user ?? null,
          reason: 'Left the server',
          footer: `User ID: ${member.id}`,
        },
      );
    }

    if (cfg.welcome.leaveEnabled && cfg.welcome.leaveChannelId) {
      const channel = guild.channels.cache.get(cfg.welcome.leaveChannelId);
      if (channel?.isTextBased() && channel.isSendable()) {
        const text = cfg.welcome.leaveMessage
          .replaceAll('{user}', `<@${member.id}>`)
          .replaceAll('{user.mention}', `<@${member.id}>`)
          .replaceAll('{user.name}', user?.username ?? 'Unknown')
          .replaceAll('{guild.name}', guild.name);
        await channel.send(text).catch(() => undefined);
      }
    }
  },
};
