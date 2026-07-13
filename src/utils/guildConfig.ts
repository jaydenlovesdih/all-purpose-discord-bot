import { readJson, writeJson } from './store.js';

export interface InvokeMessages {
  channel?: string;
  dm?: string;
}

export interface AutoModConfig {
  enabled: boolean;
  words: string[];
  invites: boolean;
  links: boolean;
  spam: boolean;
  caps: boolean;
  massMention: boolean;
  emojis: boolean;
  spamThreshold: number;
  capsThreshold: number;
  mentionThreshold: number;
  emojiThreshold: number;
  punishment: 'timeout' | 'kick' | 'ban' | 'jail' | 'delete';
  timeoutSeconds: number;
  whitelistUsers: string[];
  whitelistRoles: string[];
  whitelistChannels: string[];
}

export interface AntiRaidConfig {
  enabled: boolean;
  massJoinThreshold: number;
  minAccountAgeDays: number;
  blockDefaultAvatar: boolean;
  punishment: 'ban' | 'kick' | 'timeout' | 'jail';
  lockdown: boolean;
  logChannelId?: string;
  whitelist: string[];
}

export interface LevelReward {
  level: number;
  roleId: string;
}

export interface LevelsConfig {
  enabled: boolean;
  channelId?: string;
  message: string;
  rewards: LevelReward[];
}

export interface WelcomeConfig {
  enabled: boolean;
  channelId?: string;
  message: string;
  autoRoleIds: string[];
}

export interface StarboardConfig {
  enabled: boolean;
  channelId?: string;
  emoji: string;
  threshold: number;
}

export interface GuildConfig {
  prefix?: string;
  jailRoleId?: string;
  jailChannelId?: string;
  muteRoleId?: string;
  modLogChannelId?: string;
  hardbans: string[];
  jailedRoles: Record<string, string[]>;
  invoke: Record<string, InvokeMessages>;
  automod: AutoModConfig;
  antiraid: AntiRaidConfig;
  levels: LevelsConfig;
  welcome: WelcomeConfig;
  starboard: StarboardConfig;
  afk: Record<string, { reason: string; since: number }>;
  giveaways: Record<string, { prize: string; endsAt: number; winners: number; channelId: string; hostId: string; ended: boolean }>;
}

const DEFAULT_AUTOMOD: AutoModConfig = {
  enabled: false,
  words: [],
  invites: false,
  links: false,
  spam: false,
  caps: false,
  massMention: false,
  emojis: false,
  spamThreshold: 5,
  capsThreshold: 70,
  mentionThreshold: 5,
  emojiThreshold: 10,
  punishment: 'timeout',
  timeoutSeconds: 60,
  whitelistUsers: [],
  whitelistRoles: [],
  whitelistChannels: [],
};

const DEFAULT_ANTIRAID: AntiRaidConfig = {
  enabled: false,
  massJoinThreshold: 5,
  minAccountAgeDays: 0,
  blockDefaultAvatar: false,
  punishment: 'kick',
  lockdown: false,
  whitelist: [],
};

const DEFAULT_LEVELS: LevelsConfig = {
  enabled: false,
  message: 'Congrats {user.mention}! You reached level **{level}**.',
  rewards: [],
};

const DEFAULT_WELCOME: WelcomeConfig = {
  enabled: false,
  message: 'Welcome {user.mention} to **{guild.name}**!',
  autoRoleIds: [],
};

const DEFAULT_STARBOARD: StarboardConfig = {
  enabled: false,
  emoji: '⭐',
  threshold: 3,
};

function defaults(): GuildConfig {
  return {
    hardbans: [],
    jailedRoles: {},
    invoke: {},
    automod: { ...DEFAULT_AUTOMOD, words: [] },
    antiraid: { ...DEFAULT_ANTIRAID, whitelist: [] },
    levels: { ...DEFAULT_LEVELS, rewards: [] },
    welcome: { ...DEFAULT_WELCOME, autoRoleIds: [] },
    starboard: { ...DEFAULT_STARBOARD },
    afk: {},
    giveaways: {},
  };
}

type Store = Record<string, GuildConfig>;

function load(): Store {
  return readJson<Store>('guilds.json', {});
}

function save(store: Store): void {
  writeJson('guilds.json', store);
}

export function getGuildConfig(guildId: string): GuildConfig {
  const store = load();
  if (!store[guildId]) {
    store[guildId] = defaults();
    save(store);
  }
  return { ...defaults(), ...store[guildId],
    automod: { ...DEFAULT_AUTOMOD, ...store[guildId].automod },
    antiraid: { ...DEFAULT_ANTIRAID, ...store[guildId].antiraid },
    levels: { ...DEFAULT_LEVELS, ...store[guildId].levels },
    welcome: { ...DEFAULT_WELCOME, ...store[guildId].welcome },
    starboard: { ...DEFAULT_STARBOARD, ...store[guildId].starboard },
  };
}

export function updateGuildConfig(guildId: string, patch: Partial<GuildConfig>): GuildConfig {
  const store = load();
  const current = getGuildConfig(guildId);
  const next = { ...current, ...patch };
  store[guildId] = next;
  save(store);
  return next;
}

export function mutateGuildConfig(guildId: string, mutator: (cfg: GuildConfig) => void): GuildConfig {
  const cfg = getGuildConfig(guildId);
  mutator(cfg);
  const store = load();
  store[guildId] = cfg;
  save(store);
  return cfg;
}
