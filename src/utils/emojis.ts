import { Client, GuildEmoji } from 'discord.js';

/** Server that hosts Blaze UI custom emojis */
export const EMOJI_GUILD_ID = '1525972644074098891';

type EmojiKey = 'animatedbolt' | 'blackbolt';

interface CachedEmoji {
  id: string;
  name: string;
  animated: boolean;
  /** Usable in message/embed text */
  mention: string;
}

const cache: Partial<Record<EmojiKey, CachedEmoji>> = {};

const FALLBACK: Record<EmojiKey, string> = {
  animatedbolt: '⚡',
  blackbolt: '⬛',
};

function toCached(emoji: GuildEmoji): CachedEmoji {
  return {
    id: emoji.id,
    name: emoji.name ?? 'emoji',
    animated: emoji.animated ?? false,
    mention: emoji.toString(),
  };
}

/** Load custom emojis from the emoji server (bot must be in that guild). */
export async function initCustomEmojis(client: Client): Promise<void> {
  try {
    const guild =
      client.guilds.cache.get(EMOJI_GUILD_ID) ??
      (await client.guilds.fetch(EMOJI_GUILD_ID).catch(() => null));
    if (!guild) {
      console.warn(`Emoji guild ${EMOJI_GUILD_ID} not found — using unicode fallbacks`);
      return;
    }

    await guild.emojis.fetch().catch(() => undefined);

    const byName = (name: string) =>
      guild.emojis.cache.find((e) => e.name?.toLowerCase() === name.toLowerCase());

    const animated = byName('animatedbolt');
    const black = byName('blackbolt');

    if (animated) cache.animatedbolt = toCached(animated);
    if (black) cache.blackbolt = toCached(black);

    console.log(
      `Custom emojis: animatedbolt=${cache.animatedbolt?.mention ?? 'fallback'} blackbolt=${cache.blackbolt?.mention ?? 'fallback'}`,
    );
  } catch (error) {
    console.warn('Failed to load custom emojis:', error);
  }
}

/** Text form for embeds / messages */
export function emoji(key: EmojiKey): string {
  return cache[key]?.mention ?? FALLBACK[key];
}

/** Success / positive UI accent */
export function bolt(): string {
  return emoji('animatedbolt');
}

/** Error / negative UI accent */
export function blackBolt(): string {
  return emoji('blackbolt');
}

/** For ButtonBuilder.setEmoji(...) */
export function buttonEmoji(key: EmojiKey): { id: string; name: string; animated?: boolean } | string {
  const cached = cache[key];
  if (!cached) return FALLBACK[key];
  return { id: cached.id, name: cached.name, animated: cached.animated };
}
