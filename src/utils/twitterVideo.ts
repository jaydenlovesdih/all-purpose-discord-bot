import { AttachmentBuilder } from 'discord.js';

const MAX_DISCORD_UPLOAD = 24 * 1024 * 1024; // leave headroom under 25MB
const UA = 'Mozilla/5.0 (compatible; Discordbot/2.0; +https://discord.com)';

/** Matches twitter.com / x.com / fx* / vx* status URLs and captures the snowflake id. */
export const TWITTER_STATUS_RE =
  /https?:\/\/(?:(?:www|mobile|www\.mobile)\.)?(?:twitter\.com|x\.com|fxtwitter\.com|vxtwitter\.com|fixvx\.com|fixupx\.com)\/(?:[\w_]+\/status|i\/status|status)\/(\d+)/gi;

export interface TweetVideo {
  id: string;
  url: string;
  width?: number;
  height?: number;
  duration?: number;
}

export interface TweetMediaResult {
  tweetId: string;
  tweetUrl: string;
  author: string;
  text: string;
  videos: TweetVideo[];
}

interface FxVideoFormat {
  url?: string;
  bitrate?: number;
  container?: string;
}

interface FxVideo {
  id?: string;
  url?: string;
  type?: string;
  format?: string;
  width?: number;
  height?: number;
  duration?: number;
  formats?: FxVideoFormat[];
}

interface FxStatus {
  id?: string;
  url?: string;
  text?: string;
  author?: { screen_name?: string; name?: string };
  media?: {
    videos?: FxVideo[];
    all?: FxVideo[];
  };
}

function pickBestMp4(video: FxVideo): string | null {
  const formats = (video.formats ?? []).filter(
    (f) => f.url && (f.container === 'mp4' || f.url.includes('.mp4')),
  );
  if (formats.length) {
    const sorted = [...formats].sort((a, b) => (b.bitrate ?? 0) - (a.bitrate ?? 0));
    return sorted[0]?.url ?? null;
  }
  if (video.url && (video.url.includes('.mp4') || video.format === 'video/mp4')) {
    return video.url;
  }
  return video.url ?? null;
}

export function extractTweetIds(text: string): string[] {
  const ids: string[] = [];
  const seen = new Set<string>();
  const re = new RegExp(TWITTER_STATUS_RE.source, 'gi');
  let match: RegExpExecArray | null;
  while ((match = re.exec(text)) !== null) {
    const id = match[1];
    if (!seen.has(id)) {
      seen.add(id);
      ids.push(id);
    }
  }
  return ids;
}

export async function fetchTweetMedia(tweetId: string): Promise<TweetMediaResult | null> {
  const res = await fetch(`https://api.fxtwitter.com/2/status/${tweetId}`, {
    headers: {
      'User-Agent': UA,
      Accept: 'application/json',
    },
  });

  if (!res.ok) return null;

  const data = (await res.json()) as { code?: number; status?: FxStatus | null };
  const status = data.status;
  if (!status?.id) return null;

  const rawVideos = [
    ...(status.media?.videos ?? []),
    ...(status.media?.all ?? []).filter((m) => m.type === 'video' || m.type === 'gif'),
  ];

  // Dedupe by id/url
  const seen = new Set<string>();
  const videos: TweetVideo[] = [];
  for (const v of rawVideos) {
    const url = pickBestMp4(v);
    if (!url) continue;
    const key = v.id ?? url;
    if (seen.has(key)) continue;
    seen.add(key);
    videos.push({
      id: v.id ?? key,
      url,
      width: v.width,
      height: v.height,
      duration: v.duration,
    });
  }

  return {
    tweetId: status.id,
    tweetUrl: status.url ?? `https://x.com/i/status/${status.id}`,
    author: status.author?.screen_name ?? status.author?.name ?? 'unknown',
    text: (status.text ?? '').trim(),
    videos,
  };
}

async function downloadUnderLimit(url: string): Promise<Buffer | null> {
  const res = await fetch(url, {
    headers: { 'User-Agent': UA },
    redirect: 'follow',
  });
  if (!res.ok) return null;

  const length = Number(res.headers.get('content-length') ?? 0);
  if (length > MAX_DISCORD_UPLOAD) return null;

  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.byteLength === 0 || buf.byteLength > MAX_DISCORD_UPLOAD) return null;
  return buf;
}

/** Prefer highest quality that still fits Discord's upload cap; fall back through formats. */
export async function downloadTweetVideos(
  media: TweetMediaResult,
): Promise<{ attachments: AttachmentBuilder[]; skipped: number }> {
  const attachments: AttachmentBuilder[] = [];
  let skipped = 0;

  const res = await fetch(`https://api.fxtwitter.com/2/status/${media.tweetId}`, {
    headers: { 'User-Agent': UA, Accept: 'application/json' },
  });
  const data = res.ok ? ((await res.json()) as { status?: FxStatus }) : null;
  const fxVideos = [
    ...(data?.status?.media?.videos ?? []),
    ...(data?.status?.media?.all ?? []).filter((m) => m.type === 'video' || m.type === 'gif'),
  ];

  for (let i = 0; i < media.videos.length; i++) {
    const video = media.videos[i];
    const fx = fxVideos.find((v) => v.id === video.id) ?? fxVideos[i];

    const candidates: string[] = [];
    const mp4s = (fx?.formats ?? [])
      .filter((f) => f.url && (f.container === 'mp4' || f.url.includes('.mp4')))
      .sort((a, b) => (b.bitrate ?? 0) - (a.bitrate ?? 0));
    for (const f of mp4s) {
      if (f.url) candidates.push(f.url);
    }
    if (video.url) candidates.unshift(video.url);
    // unique
    const urls = [...new Set(candidates)];

    let buf: Buffer | null = null;
    for (const u of urls) {
      buf = await downloadUnderLimit(u);
      if (buf) break;
    }

    if (!buf) {
      skipped += 1;
      continue;
    }

    const name = `x-${media.tweetId}${media.videos.length > 1 ? `-${i + 1}` : ''}.mp4`;
    attachments.push(new AttachmentBuilder(buf, { name }));
  }

  return { attachments, skipped };
}

export function buildTwitterCaption(media: TweetMediaResult): string {
  const snippet = media.text
    ? media.text.length > 180
      ? `${media.text.slice(0, 177)}…`
      : media.text
    : '';
  const lines = [
    `**@${media.author}** · permanent video`,
    snippet || null,
    media.tweetUrl,
  ].filter(Boolean);
  return lines.join('\n');
}

/** In-memory dedupe so auto + manual don't double-post the same tweet quickly. */
const recentPosts = new Map<string, number>();

export function shouldSkipRecent(guildId: string, tweetId: string): boolean {
  const key = `${guildId}:${tweetId}`;
  const last = recentPosts.get(key) ?? 0;
  if (Date.now() - last < 60_000) return true;
  recentPosts.set(key, Date.now());
  if (recentPosts.size > 500) {
    const cutoff = Date.now() - 120_000;
    for (const [k, t] of recentPosts) {
      if (t < cutoff) recentPosts.delete(k);
    }
  }
  return false;
}

/** Auto-convert Twitter/X videos in a guild message. Returns true if a video was posted. */
export async function handleTwitterAutoMessage(
  message: import('discord.js').Message,
): Promise<boolean> {
  if (!message.guild || !message.channel.isSendable()) return false;
  if (!message.content) return false;

  const ids = extractTweetIds(message.content);
  if (!ids.length) return false;

  const me = message.guild.members.me;
  if (me) {
    const perms = message.channel.isThread()
      ? message.channel.permissionsFor(me)
      : 'permissionsFor' in message.channel
        ? message.channel.permissionsFor(me)
        : null;
    if (perms && (!perms.has('SendMessages') || !perms.has('AttachFiles'))) return false;
  }

  let posted = false;

  for (const id of ids.slice(0, 2)) {
    if (shouldSkipRecent(message.guild.id, id)) continue;

    const media = await fetchTweetMedia(id).catch(() => null);
    if (!media?.videos.length) continue;

    const { attachments } = await downloadTweetVideos(media).catch(() => ({
      attachments: [] as AttachmentBuilder[],
      skipped: 0,
    }));
    if (!attachments.length) continue;

    await message.channel
      .send({
        content: buildTwitterCaption(media).slice(0, 2000),
        files: attachments.slice(0, 10),
        reply: { messageReference: message.id, failIfNotExists: false },
      })
      .catch(() => undefined);

    posted = true;
  }

  return posted;
}
