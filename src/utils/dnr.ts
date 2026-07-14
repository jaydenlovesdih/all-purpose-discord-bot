import { Client, Message } from 'discord.js';
import { DnrEntry, getGuildConfig, mutateGuildConfig } from './guildConfig.js';
import { addWarning, getWarnings } from './warnings.js';
import { sendInvoke, stripRoles } from './moderation.js';
import { buildModButtons, buildModEmbed } from './modResponse.js';

export const DNR_STRIKE_LIMIT = 3;

export function dnrKey(protectorId: string, targetId: string): string {
  return `${protectorId}:${targetId}`;
}

export function getDnr(
  guildId: string,
  protectorId: string,
  targetId: string,
): DnrEntry | undefined {
  return getGuildConfig(guildId).dnr[dnrKey(protectorId, targetId)];
}

export function setDnr(
  guildId: string,
  protectorId: string,
  targetId: string,
  reason: string,
  setBy: string,
): DnrEntry {
  const key = dnrKey(protectorId, targetId);
  let entry: DnrEntry = {
    protectorId,
    targetId,
    reason,
    strikes: 0,
    setBy,
    setAt: Date.now(),
  };
  mutateGuildConfig(guildId, (c) => {
    const existing = c.dnr[key];
    if (existing) {
      existing.reason = reason;
      existing.setBy = setBy;
      entry = existing;
    } else {
      c.dnr[key] = entry;
    }
  });
  return entry;
}

export function removeDnr(guildId: string, protectorId: string, targetId: string): boolean {
  const key = dnrKey(protectorId, targetId);
  const existed = !!getGuildConfig(guildId).dnr[key];
  if (!existed) return false;
  mutateGuildConfig(guildId, (c) => {
    delete c.dnr[key];
  });
  return true;
}

export function updateDnrReason(
  guildId: string,
  protectorId: string,
  targetId: string,
  reason: string,
): boolean {
  const key = dnrKey(protectorId, targetId);
  if (!getGuildConfig(guildId).dnr[key]) return false;
  mutateGuildConfig(guildId, (c) => {
    const entry = c.dnr[key];
    if (entry) entry.reason = reason;
  });
  return true;
}

async function resolveRepliedAuthorId(message: Message): Promise<string | null> {
  if (!message.reference?.messageId) return null;
  if (message.mentions.repliedUser) return message.mentions.repliedUser.id;

  const refId = message.reference.messageId;
  const cached = message.channel.isTextBased()
    ? message.channel.messages.cache.get(refId)
    : undefined;
  if (cached) return cached.author.id;

  if (message.channel.isTextBased() && 'messages' in message.channel) {
    const fetched = await message.channel.messages.fetch(refId).catch(() => null);
    return fetched?.author.id ?? null;
  }
  return null;
}

/**
 * If this message is a reply that violates an active DNR:
 * delete it, auto-warn, and jail after 3 strikes.
 * Returns true when the message was handled (caller should stop further processing).
 */
export async function enforceDnr(message: Message, client: Client): Promise<boolean> {
  if (!message.guild || message.author.bot || !message.reference?.messageId) return false;

  const protectorId = await resolveRepliedAuthorId(message);
  if (!protectorId || protectorId === message.author.id) return false;

  const entry = getDnr(message.guild.id, protectorId, message.author.id);
  if (!entry) return false;

  await message.delete().catch(() => undefined);

  const strike = entry.strikes + 1;
  mutateGuildConfig(message.guild.id, (c) => {
    const current = c.dnr[dnrKey(protectorId, message.author.id)];
    if (current) current.strikes = strike;
  });

  const dnrReason = entry.reason || 'No reason provided';
  const warnReason = `DNR violation (replied to <@${protectorId}>) · ${dnrReason} · strike ${strike}/${DNR_STRIKE_LIMIT}`;

  addWarning(message.guild.id, message.author.id, protectorId, warnReason);
  const warnCount = getWarnings(message.guild.id, message.author.id).length;

  const protector =
    (await client.users.fetch(protectorId).catch(() => null)) ?? message.author;
  const member = message.member ?? (await message.guild.members.fetch(message.author.id).catch(() => null));

  await sendInvoke(
    {
      guild: message.guild,
      action: 'warn',
      user: message.author,
      moderator: protector,
      reason: warnReason,
      extra: { warning_count: warnCount },
    },
    null,
  );

  if (message.channel.isSendable()) {
    const warnEmbed = buildModEmbed({
      action: 'warn',
      target: message.author,
      moderator: protector,
      reason: warnReason,
      member,
      extraLine: `Auto DNR warning · strike **${strike}/${DNR_STRIKE_LIMIT}**`,
      botName: client.user?.username,
    });
    const warnRow = buildModButtons('warn', message.author.id);
    await message.channel
      .send({ embeds: [warnEmbed], components: warnRow ? [warnRow] : [] })
      .catch(() => undefined);
  }

  if (strike < DNR_STRIKE_LIMIT) return true;

  const cfg = getGuildConfig(message.guild.id);
  if (!member || !cfg.jailRoleId) return true;
  if (member.roles.cache.has(cfg.jailRoleId)) return true;

  const previous = member.roles.cache.filter((r) => r.id !== message.guild!.id).map((r) => r.id);
  mutateGuildConfig(message.guild.id, (c) => {
    c.jailedRoles[message.author.id] = previous;
    delete c.dnr[dnrKey(protectorId, message.author.id)];
  });

  await stripRoles(member, cfg.jailRoleId);
  await member.roles.add(cfg.jailRoleId, `DNR: 3 strikes (protected: ${protectorId})`).catch(() => undefined);

  const jailReason = `DNR auto-jail after ${DNR_STRIKE_LIMIT} violations · ${dnrReason}`;
  await sendInvoke(
    {
      guild: message.guild,
      action: 'jail',
      user: message.author,
      moderator: protector,
      reason: jailReason,
    },
    null,
  );

  if (message.channel.isSendable()) {
    const jailEmbed = buildModEmbed({
      action: 'jail',
      target: message.author,
      moderator: protector,
      reason: jailReason,
      member,
      botName: client.user?.username,
    });
    const jailRow = buildModButtons('jail', message.author.id);
    await message.channel
      .send({ embeds: [jailEmbed], components: jailRow ? [jailRow] : [] })
      .catch(() => undefined);
  }

  return true;
}
