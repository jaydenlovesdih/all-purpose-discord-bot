import { AuditLogEvent, Events } from 'discord.js';
import { BotClient } from '../types/index.js';
import { handleAntinuke } from '../utils/antinuke.js';
import { sendLog } from '../utils/log.js';

export default {
  name: Events.GuildBanAdd,
  async execute(ban: import('discord.js').GuildBan, client: BotClient) {
    await handleAntinuke(ban.guild, 'ban', AuditLogEvent.MemberBanAdd);

    // Skip if our bot already logged via a command (audit executor = bot)
    const logs = await ban.guild
      .fetchAuditLogs({ type: AuditLogEvent.MemberBanAdd, limit: 1 })
      .catch(() => null);
    const entry = logs?.entries.first();
    const recent = entry && Date.now() - entry.createdTimestamp < 8_000 && entry.target?.id === ban.user.id;
    if (recent && entry.executor?.id === client.user?.id) return;

    await sendLog(ban.guild, 'memberBan', 'User Banned', `**${ban.user.username}** has been permanently banned.`, undefined, {
      emoji: '🔨',
      target: ban.user,
      moderator: recent ? entry?.executor ?? null : null,
      reason: recent ? entry?.reason ?? ban.reason ?? 'No reason provided' : ban.reason ?? 'No reason provided',
      footer: `User ID: ${ban.user.id}`,
    });
  },
};
