import { AuditLogEvent, Events } from 'discord.js';
import { BotClient } from '../types/index.js';
import { sendLog } from '../utils/log.js';
import { blackBolt, bolt } from '../utils/emojis.js';

export default {
  name: Events.GuildMemberUpdate,
  async execute(
    oldMember: import('discord.js').GuildMember | import('discord.js').PartialGuildMember,
    newMember: import('discord.js').GuildMember,
    _client: BotClient,
  ) {
    if (!newMember.guild) return;

    // Partial old member = incomplete role cache → looks like every role was "added"
    if (oldMember.partial || !oldMember.roles?.cache) return;

    const oldRoles = oldMember.roles.cache;
    const added = newMember.roles.cache.filter(
      (r) => !oldRoles.has(r.id) && r.id !== newMember.guild.id,
    );
    const removed = oldRoles.filter(
      (r) => !newMember.roles.cache.has(r.id) && r.id !== newMember.guild.id,
    );

    if (!added.size && !removed.size) return;

    // Require a matching audit entry so cache refreshes don't spam #server
    const logs = await newMember.guild
      .fetchAuditLogs({ type: AuditLogEvent.MemberRoleUpdate, limit: 5 })
      .catch(() => null);

    const entry = logs?.entries.find(
      (e) =>
        e.target?.id === newMember.id &&
        Date.now() - e.createdTimestamp < 5_000,
    );

    if (!entry) return;

    const parts: string[] = [];
    if (added.size) parts.push(`${bolt()} ${added.map((r) => r).join(', ')}`);
    if (removed.size) parts.push(`${blackBolt()} ${removed.map((r) => r).join(', ')}`);

    await sendLog(
      newMember.guild,
      'memberRole',
      'Roles Updated',
      `**${newMember.user.username}** had role changes.`,
      undefined,
      {
        emoji: bolt(),
        target: newMember.user,
        moderator: entry.executor ?? null,
        reason: 'Role update',
        detail: { name: `${bolt()} Changes:`, value: parts.join('\n').slice(0, 1024) || 'Unknown' },
        footer: `User ID: ${newMember.id}`,
      },
    );
  },
};
