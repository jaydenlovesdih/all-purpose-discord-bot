import { AuditLogEvent, Events } from 'discord.js';
import { BotClient } from '../types/index.js';
import { sendLog } from '../utils/log.js';

export default {
  name: Events.GuildBanRemove,
  async execute(ban: import('discord.js').GuildBan, client: BotClient) {
    const logs = await ban.guild
      .fetchAuditLogs({ type: AuditLogEvent.MemberBanRemove, limit: 1 })
      .catch(() => null);
    const entry = logs?.entries.first();
    const recent = entry && Date.now() - entry.createdTimestamp < 8_000 && entry.target?.id === ban.user.id;
    if (recent && entry.executor?.id === client.user?.id) return;

    await sendLog(
      ban.guild,
      'memberUnban',
      'User Unbanned',
      `**${ban.user.username}** has been unbanned.`,
      undefined,
      {
        emoji: '🔓',
        target: ban.user,
        moderator: recent ? entry?.executor ?? null : null,
        reason: recent ? entry?.reason ?? 'No reason provided' : 'No reason provided',
        footer: `User ID: ${ban.user.id}`,
      },
    );
  },
};
