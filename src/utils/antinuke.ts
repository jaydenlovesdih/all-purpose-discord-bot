import { AuditLogEvent, Guild, GuildMember, TextChannel } from 'discord.js';
import { AntinukeModule, getGuildConfig, mutateGuildConfig } from './guildConfig.js';
import { canBypass } from './permissions.js';
import { stripRoles } from './moderation.js';

const buckets = new Map<string, number[]>();

function key(guildId: string, userId: string, module: AntinukeModule): string {
  return `${guildId}:${userId}:${module}`;
}

function hit(guildId: string, userId: string, module: AntinukeModule, threshold: number): boolean {
  const k = key(guildId, userId, module);
  const now = Date.now();
  const stamps = (buckets.get(k) ?? []).filter((t) => now - t < 60_000);
  stamps.push(now);
  buckets.set(k, stamps);
  return stamps.length >= threshold;
}

async function punish(member: GuildMember, punishment: string, reason: string): Promise<void> {
  switch (punishment) {
    case 'ban':
      await member.ban({ reason }).catch(() => undefined);
      break;
    case 'kick':
      await member.kick(reason).catch(() => undefined);
      break;
    case 'timeout':
      await member.timeout(60 * 60_000, reason).catch(() => undefined);
      break;
    case 'strip':
    default:
      await stripRoles(member);
      break;
  }
}

export async function handleAntinuke(
  guild: Guild,
  module: AntinukeModule,
  auditEvent: AuditLogEvent,
): Promise<void> {
  const cfg = getGuildConfig(guild.id).antinuke;
  if (!cfg.enabled) return;
  const mod = cfg.modules[module];
  if (!mod?.enabled) return;

  try {
    const logs = await guild.fetchAuditLogs({ type: auditEvent, limit: 1 });
    const entry = logs.entries.first();
    if (!entry?.executor || entry.executor.bot) return;
    if (Date.now() - entry.createdTimestamp > 8_000) return;

    const executorId = entry.executor.id;
    if (canBypass(executorId)) return;
    if (cfg.whitelist.includes(executorId)) return;
    if (guild.ownerId === executorId) return;

    if (!hit(guild.id, executorId, module, mod.threshold)) return;

    const member = await guild.members.fetch(executorId).catch(() => null);
    if (!member) return;

    await punish(member, mod.punishment, `Antinuke: ${module} threshold exceeded`);

    const logId = cfg.logChannelId ?? getGuildConfig(guild.id).modLogChannelId;
    if (logId) {
      const channel = guild.channels.cache.get(logId);
      if (channel?.isTextBased() && channel.isSendable()) {
        await channel.send(
          `🛡️ **Antinuke** punished ${member} for exceeding \`${module}\` threshold (${mod.threshold}/60s) → **${mod.punishment}**`,
        ).catch(() => undefined);
      }
    }
  } catch {
    // missing audit log perms
  }
}

export async function resolveAuditExecutor(
  guild: Guild,
  type: AuditLogEvent,
): Promise<string | null> {
  try {
    const logs = await guild.fetchAuditLogs({ type, limit: 1 });
    const entry = logs.entries.first();
    if (!entry?.executor || Date.now() - entry.createdTimestamp > 8_000) return null;
    return entry.executor.id;
  } catch {
    return null;
  }
}

export function ensureAntinukeAdmin(guildId: string, userId: string, ownerId: string): boolean {
  if (canBypass(userId) || userId === ownerId) return true;
  return getGuildConfig(guildId).antinuke.admins.includes(userId);
}

export function toggleAntinukeModule(
  guildId: string,
  module: AntinukeModule,
  enabled: boolean,
  threshold?: number,
  punishment?: 'ban' | 'kick' | 'strip' | 'timeout',
): void {
  mutateGuildConfig(guildId, (c) => {
    c.antinuke.enabled = true;
    c.antinuke.modules[module].enabled = enabled;
    if (threshold) c.antinuke.modules[module].threshold = threshold;
    if (punishment) c.antinuke.modules[module].punishment = punishment;
  });
}
