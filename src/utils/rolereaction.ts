import {
  Attachment,
  DiscordAPIError,
  Guild,
  GuildMember,
  Message,
  RateLimitError,
  TextChannel,
} from 'discord.js';

export interface PendingRoleReaction {
  ownerId: string;
  roleId: string;
  guildId: string;
  channelId: string;
  userIds: string[];
  imageCount: number;
}

export interface RoleReactionProgress {
  processed: number;
  total: number;
  success: number;
  failed: number;
  skipped: number;
}

export const pendingRoleReactions = new Map<string, PendingRoleReaction>();

/** Discord guild member role edits — stay under ~1/sec to avoid 429s */
const ROLE_ADD_INTERVAL_MS = 1_250;
const REACTION_FETCH_DELAY_MS = 400;
const MEMBER_FETCH_DELAY_MS = 300;
const MAX_RETRIES = 8;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function rateLimitWaitMs(error: unknown): number | null {
  if (error instanceof RateLimitError) {
    return error.timeToReset + 500;
  }
  if (error instanceof DiscordAPIError && error.status === 429) {
    const retryAfter =
      ((error.rawError as { retry_after?: number })?.retry_after ?? 5) * 1000;
    return retryAfter + 500;
  }
  return null;
}

async function withRateLimitRetry<T>(fn: () => Promise<T>): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      const wait = rateLimitWaitMs(error);
      if (wait !== null && attempt < MAX_RETRIES - 1) {
        await sleep(wait);
        continue;
      }
      throw error;
    }
  }
  throw lastError;
}

function isImageAttachment(att: Attachment): boolean {
  if (att.contentType?.startsWith('image/')) return true;
  return /\.(png|jpe?g|gif|webp|bmp)$/i.test(att.url);
}

export function messageHasImage(msg: Message): boolean {
  if (msg.attachments.some(isImageAttachment)) return true;
  return msg.embeds.some((e) => !!e.image?.url || !!e.thumbnail?.url);
}

async function resolveMember(guild: Guild, userId: string): Promise<GuildMember | null> {
  const cached = guild.members.cache.get(userId);
  if (cached) return cached;

  await sleep(MEMBER_FETCH_DELAY_MS);
  return withRateLimitRetry(() => guild.members.fetch(userId)).catch(() => null);
}

/** Collect unique non-bot users who reacted to any image message in the channel. */
export async function collectImageReactionUsers(
  channel: TextChannel,
): Promise<{ userIds: string[]; imageCount: number }> {
  const userIds = new Set<string>();
  let imageCount = 0;
  let before: string | undefined;

  for (;;) {
    const batch = await withRateLimitRetry(() =>
      channel.messages.fetch({ limit: 100, before }),
    ).catch(() => null);
    if (!batch?.size) break;

    for (const msg of batch.values()) {
      if (!messageHasImage(msg)) continue;
      imageCount++;

      if (!msg.reactions.cache.size) continue;

      for (const reaction of msg.reactions.cache.values()) {
        await sleep(REACTION_FETCH_DELAY_MS);
        const users = await withRateLimitRetry(() => reaction.users.fetch()).catch(() => null);
        if (!users) continue;
        for (const user of users.values()) {
          if (!user.bot) userIds.add(user.id);
        }
      }
    }

    before = batch.last()?.id;
    if (batch.size < 100) break;
  }

  return { userIds: [...userIds], imageCount };
}

async function addRolePaced(
  member: GuildMember,
  roleId: string,
): Promise<'ok' | 'unmanageable' | 'failed'> {
  if (!member.manageable) return 'unmanageable';

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      await member.roles.add(roleId, 'rolereaction');
      await sleep(ROLE_ADD_INTERVAL_MS);
      return 'ok';
    } catch (error) {
      const wait = rateLimitWaitMs(error);
      if (wait !== null && attempt < MAX_RETRIES - 1) {
        await sleep(wait);
        continue;
      }
      return 'failed';
    }
  }

  return 'failed';
}

export async function applyRoleReaction(
  guild: Guild,
  roleId: string,
  userIds: string[],
  onProgress?: (progress: RoleReactionProgress) => void | Promise<void>,
): Promise<{ success: number; failed: number; skipped: number }> {
  const role = guild.roles.cache.get(roleId);
  if (!role) return { success: 0, failed: userIds.length, skipped: 0 };

  // One bulk fetch beats hundreds of per-user fetches (and avoids member fetch 429s)
  await withRateLimitRetry(() => guild.members.fetch()).catch(() => undefined);

  let success = 0;
  let failed = 0;
  let skipped = 0;
  const total = userIds.length;

  for (let i = 0; i < userIds.length; i++) {
    const userId = userIds[i];
    const member = await resolveMember(guild, userId);
    if (!member) {
      skipped++;
    } else if (member.roles.cache.has(roleId)) {
      skipped++;
    } else {
      const result = await addRolePaced(member, roleId);
      if (result === 'ok') success++;
      else if (result === 'unmanageable') failed++;
      else failed++;
    }

    const processed = i + 1;
    if (onProgress && (processed % 10 === 0 || processed === total)) {
      await onProgress({ processed, total, success, failed, skipped });
    }
  }

  return { success, failed, skipped };
}
