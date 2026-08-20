import {
  DiscordAPIError,
  Guild,
  GuildMember,
  RateLimitError,
  User,
} from 'discord.js';
import { getAvailableDmBotsInGuild, type DmBotSlot } from './dmBots.js';

export interface PendingAnnounce {
  ownerId: string;
  guildId: string;
  message: string;
}

export interface AnnounceProgress {
  processed: number;
  total: number;
  sent: number;
  failed: number;
  skipped: number;
}

export const pendingAnnounces = new Map<string, PendingAnnounce>();

const runningGuilds = new Set<string>();
const cancelGuilds = new Set<string>();

/** Per-bot pacing — ~1 DM every 1.2s per account; bots run in parallel */
const DM_INTERVAL_MS = 1_200;
const MAX_RETRIES = 6;
const PROGRESS_EVERY = 10;

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

export function formatAnnounceText(template: string, member: GuildMember): string {
  return template
    .replaceAll('{user}', member.toString())
    .replaceAll('{user.mention}', member.toString())
    .replaceAll('{user.name}', member.user.username)
    .replaceAll('{user.tag}', member.user.tag)
    .replaceAll('{guild}', member.guild.name)
    .replaceAll('{guild.name}', member.guild.name)
    .replaceAll('{membercount}', String(member.guild.memberCount));
}

export function isAnnounceRunning(guildId: string): boolean {
  return runningGuilds.has(guildId);
}

export function cancelAnnounce(guildId: string): boolean {
  if (!runningGuilds.has(guildId)) return false;
  cancelGuilds.add(guildId);
  return true;
}

function isDmBlocked(error: unknown): boolean {
  return error instanceof DiscordAPIError && error.code === 50_007;
}

function splitMembers(members: GuildMember[], botCount: number): GuildMember[][] {
  const buckets: GuildMember[][] = Array.from({ length: botCount }, () => []);
  for (let i = 0; i < members.length; i++) {
    buckets[i % botCount].push(members[i]);
  }
  return buckets;
}

async function sendDm(
  bot: DmBotSlot,
  user: User,
  content: string,
): Promise<'sent' | 'skipped' | 'failed'> {
  try {
    await withRateLimitRetry(async () => {
      const dm = await bot.client.users.createDM(user.id);
      await dm.send({ content });
    });
    return 'sent';
  } catch (error) {
    if (isDmBlocked(error)) return 'skipped';
    return 'failed';
  }
}

async function runBotQueue(
  bot: DmBotSlot,
  members: GuildMember[],
  messageTemplate: string,
  guildId: string,
  onResult: (result: 'sent' | 'skipped' | 'failed') => void,
): Promise<void> {
  for (let i = 0; i < members.length; i++) {
    if (cancelGuilds.has(guildId)) break;

    const member = members[i];
    const content = formatAnnounceText(messageTemplate, member);
    const result = await sendDm(bot, member.user, content);
    onResult(result);

    if (i < members.length - 1 && !cancelGuilds.has(guildId)) {
      await sleep(DM_INTERVAL_MS);
    }
  }
}

export async function executeAnnounceDm(
  guild: Guild,
  message: string,
  onProgress?: (progress: AnnounceProgress) => void | Promise<void>,
): Promise<{ sent: number; failed: number; skipped: number; total: number; cancelled: boolean }> {
  if (runningGuilds.has(guild.id)) {
    return { sent: 0, failed: 0, skipped: 0, total: 0, cancelled: false };
  }

  runningGuilds.add(guild.id);
  cancelGuilds.delete(guild.id);

  try {
    const bots = await getAvailableDmBotsInGuild(guild.id);
    if (!bots.length) {
      return { sent: 0, failed: 0, skipped: 0, total: 0, cancelled: false };
    }

    await guild.members.fetch();
    const targets = [...guild.members.cache.values()].filter((m) => !m.user.bot);
    const total = targets.length;

    if (total === 0) {
      return { sent: 0, failed: 0, skipped: 0, total: 0, cancelled: false };
    }

    const buckets = splitMembers(targets, bots.length);
    let processed = 0;
    let sent = 0;
    let failed = 0;
    let skipped = 0;

    const report = async () => {
      if (processed === total || processed % PROGRESS_EVERY === 0 || processed === 0) {
        await onProgress?.({ processed, total, sent, failed, skipped });
      }
    };

    await report();

    const bump = (result: 'sent' | 'skipped' | 'failed') => {
      processed++;
      if (result === 'sent') sent++;
      else if (result === 'skipped') skipped++;
      else failed++;
      void report();
    };

    await Promise.all(
      bots.map((bot, index) => runBotQueue(bot, buckets[index], message, guild.id, bump)),
    );

    const cancelled = cancelGuilds.has(guild.id);
    return { sent, failed, skipped, total, cancelled };
  } finally {
    runningGuilds.delete(guild.id);
    cancelGuilds.delete(guild.id);
  }
}
