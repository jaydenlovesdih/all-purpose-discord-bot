import { AuditLogEvent, Events } from 'discord.js';
import { BotClient } from '../types/index.js';
import { sendLog } from '../utils/log.js';

export default {
  name: Events.GuildMemberUpdate,
  async execute(
    oldMember: import('discord.js').GuildMember | import('discord.js').PartialGuildMember,
    newMember: import('discord.js').GuildMember,
    client: BotClient,
  ) {
    if (!newMember.guild) return;

    const oldRoles = oldMember.roles?.cache;
    if (!oldRoles) return;

    const added = newMember.roles.cache.filter((r) => !oldRoles.has(r.id) && r.id !== newMember.guild.id);
    const removed = oldRoles.filter((r) => !newMember.roles.cache.has(r.id) && r.id !== newMember.guild.id);

    if (!added.size && !removed.size) return;

    const logs = await newMember.guild
      .fetchAuditLogs({ type: AuditLogEvent.MemberRoleUpdate, limit: 1 })
      .catch(() => null);
    const entry = logs?.entries.first();
    const recent =
      entry &&
      entry.target?.id === newMember.id &&
      Date.now() - entry.createdTimestamp < 8_000;
    if (recent && entry.executor?.id === client.user?.id) return;

    const parts: string[] = [];
    if (added.size) parts.push(`➕ ${added.map((r) => r).join(', ')}`);
    if (removed.size) parts.push(`➖ ${removed.map((r) => r).join(', ')}`);

    await sendLog(
      newMember.guild,
      'memberRole',
      'Roles Updated',
      `**${newMember.user.username}** had role changes.`,
      undefined,
      {
        emoji: '🎭',
        target: newMember.user,
        moderator: recent ? entry?.executor ?? null : null,
        reason: 'Role update',
        detail: { name: '🎭 Changes:', value: parts.join('\n').slice(0, 1024) || 'Unknown' },
        footer: `User ID: ${newMember.id}`,
      },
    );
  },
};
