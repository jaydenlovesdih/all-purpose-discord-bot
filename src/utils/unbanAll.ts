import { DiscordAPIError, Guild, RateLimitError } from 'discord.js';
import { mutateGuildConfig } from './guildConfig.js';

export interface PendingUnbanAll {
  ownerId: string;
  guildId: string;
  reason: string;
}

export interface UnbanAllProgress {
  processed: number;
  total: number;
  success: number;
  failed: number;
}

export const pendingUnbanAlls = new Map<string, PendingUnbanAll>();
const runningGuilds = new Set<string>();

/** Discord ban edits — stay under ~1/sec to avoid 429s */
const UNBAN_INTERVAL_MS = 1_400;
const MAX_RETRIES = 8;
const PROGRESS_EVERY = 5;

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

export function isUnbanAllRunning(guildId: string): boolean {
  return runningGuilds.has(guildId);
}

export async function executeUnbanAll(
  guild: Guild,
  reason: string,
  onProgress?: (progress: UnbanAllProgress) => void | Promise<void>,
): Promise<{ success: number; failed: number; total: number }> {
  if (runningGuilds.has(guild.id)) {
    return { success: 0, failed: 0, total: 0 };
  }
  runningGuilds.add(guild.id);

  try {
    const bans = await withRateLimitRetry(() => guild.bans.fetch());
    const entries = [...bans.values()];
    const total = entries.length;
    let success = 0;
    let failed = 0;

    if (total === 0) {
      return { success: 0, failed: 0, total: 0 };
    }

    await onProgress?.({ processed: 0, total, success: 0, failed: 0 });

    for (let i = 0; i < entries.length; i++) {
      const ban = entries[i];
      try {
        await withRateLimitRetry(() => guild.members.unban(ban.user.id, reason));
        mutateGuildConfig(guild.id, (c) => {
          c.hardbans = c.hardbans.filter((id) => id !== ban.user.id);
        });
        success++;
      } catch {
        failed++;
      }

      const processed = i + 1;
      if (processed === total || processed % PROGRESS_EVERY === 0) {
        await onProgress?.({ processed, total, success, failed });
      }

      if (i < entries.length - 1) {
        await sleep(UNBAN_INTERVAL_MS);
      }
    }

    return { success, failed, total };
  } finally {
    runningGuilds.delete(guild.id);
  }
}
