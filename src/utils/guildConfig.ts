import { readJson, writeJson } from './store.js';
import { PermissionFlagsBits, PermissionsBitField } from 'discord.js';

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

export type AntinukeModule =
  | 'ban'
  | 'kick'
  | 'role'
  | 'channel'
  | 'webhook'
  | 'emoji'
  | 'botadd'
  | 'guild';

export interface AntinukeModuleConfig {
  enabled: boolean;
  threshold: number;
  punishment: 'ban' | 'kick' | 'strip' | 'timeout';
}

export interface AntinukeConfig {
  enabled: boolean;
  modules: Record<AntinukeModule, AntinukeModuleConfig>;
  whitelist: string[];
  admins: string[];
  logChannelId?: string;
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
  /** Send a customizable DM when a member joins */
  dmEnabled: boolean;
  dmMessage: string;
  leaveEnabled: boolean;
  leaveChannelId?: string;
  leaveMessage: string;
  autoRoleIds: string[];
}

export interface StarboardConfig {
  enabled: boolean;
  channelId?: string;
  emoji: string;
  threshold: number;
}

export interface TicketChannelRecord {
  ownerId: string;
  number: number;
  createdAt: number;
  /** Ticket type id when opened from a multi-type panel */
  typeId?: string;
}

/** A selectable ticket option on the panel → its own category */
export interface TicketType {
  /** Stable id used in select values (e.g. support, appeals) */
  id: string;
  /** Button / select label */
  label: string;
  /** Category channel id where tickets of this type are created */
  categoryId: string;
  /** Optional emoji name/unicode for the select option */
  emoji?: string;
  /** Optional description shown under the select option */
  description?: string;
}

export interface TicketsConfig {
  categoryId?: string;
  supportRoleIds: string[];
  panelChannelId?: string;
  panelMessageId?: string;
  title: string;
  description: string;
  /** Multi-type options on the same panel (each can use a different category) */
  types: TicketType[];
  /** Active ticket channels keyed by channel id */
  open: Record<string, TicketChannelRecord>;
  nextNumber: number;
}

export interface LogChannels {
  /** Ban, unban, kick */
  bans?: string;
  /** Mute, unmute, timeout */
  mutes?: string;
  /** Jail, unjail */
  jail?: string;
  /** Purge */
  purge?: string;
  /** Role changes + channel create/delete (Discord channel name: server) */
  server?: string;
  /** Message delete / edit history */
  messages?: string;
  /** @deprecated migrated to server */
  roles?: string;
}

export interface LoggingConfig {
  enabled: boolean;
  channelId?: string;
  events: {
    messageDelete: boolean;
    messageEdit: boolean;
    memberJoin: boolean;
    memberLeave: boolean;
    memberBan: boolean;
    memberUnban: boolean;
    memberRole: boolean;
    channel: boolean;
    role: boolean;
  };
}

export interface AutoresponderEntry {
  trigger: string;
  response: string;
  exact: boolean;
}

/** Blocks targetId from replying to protectorId's messages */
export interface DnrEntry {
  protectorId: string;
  targetId: string;
  reason: string;
  /** Violations while this DNR is active; jail at 3 */
  strikes: number;
  setBy: string;
  setAt: number;
}

export interface GuildConfig {
  prefix?: string;
  jailRoleId?: string;
  jailChannelId?: string;
  muteRoleId?: string;
  imageMuteRoleId?: string;
  reactionMuteRoleId?: string;
  modLogChannelId?: string;
  /** Dedicated log channels created by setup */
  logChannels: LogChannels;
  staffRoleIds: string[];
  hardbans: string[];
  jailedRoles: Record<string, string[]>;
  /** Key: `${protectorId}:${targetId}` */
  dnr: Record<string, DnrEntry>;
  invoke: Record<string, InvokeMessages>;
  automod: AutoModConfig;
  antiraid: AntiRaidConfig;
  antinuke: AntinukeConfig;
  levels: LevelsConfig;
  welcome: WelcomeConfig;
  starboard: StarboardConfig;
  tickets: TicketsConfig;
  logging: LoggingConfig;
  /**
   * When true, ignore all commands from non-owners (complete silence).
   * Defaults to locked so only bot owners can use commands until unlocked.
   */
  botLocked: boolean;
  aliases: Record<string, string>;
  autoresponders: AutoresponderEntry[];
  fakePermissions: Record<string, string[]>;
  afk: Record<string, { reason: string; since: number }>;
  giveaways: Record<
    string,
    {
      prize: string;
      endsAt: number;
      winners: number;
      channelId: string;
      hostId: string;
      ended: boolean;
      entrants?: string[];
    }
  >;
  caseId?: number;
}

const defaultModule = (): AntinukeModuleConfig => ({
  enabled: false,
  threshold: 3,
  punishment: 'ban',
});

export const FAKE_PERM_MAP: Record<string, bigint> = {
  administrator: PermissionFlagsBits.Administrator,
  ban_members: PermissionFlagsBits.BanMembers,
  kick_members: PermissionFlagsBits.KickMembers,
  moderate_members: PermissionFlagsBits.ModerateMembers,
  manage_guild: PermissionFlagsBits.ManageGuild,
  manage_channels: PermissionFlagsBits.ManageChannels,
  manage_roles: PermissionFlagsBits.ManageRoles,
  manage_messages: PermissionFlagsBits.ManageMessages,
  manage_nicknames: PermissionFlagsBits.ManageNicknames,
  manage_webhooks: PermissionFlagsBits.ManageWebhooks,
  mention_everyone: PermissionFlagsBits.MentionEveryone,
  view_audit_log: PermissionFlagsBits.ViewAuditLog,
  mute_members: PermissionFlagsBits.MuteMembers,
  manage_expressions: PermissionFlagsBits.ManageGuildExpressions,
};

function defaultAntinuke(): AntinukeConfig {
  return {
    enabled: false,
    modules: {
      ban: defaultModule(),
      kick: defaultModule(),
      role: defaultModule(),
      channel: defaultModule(),
      webhook: defaultModule(),
      emoji: defaultModule(),
      botadd: defaultModule(),
      guild: defaultModule(),
    },
    whitelist: [],
    admins: [],
  };
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
  dmEnabled: false,
  dmMessage:
    'Hey {user.name}! Welcome to **{guild.name}**. Thanks for joining — check the rules and say hi!',
  leaveEnabled: false,
  leaveMessage: '**{user.name}** left **{guild.name}**.',
  autoRoleIds: [],
};

const DEFAULT_STARBOARD: StarboardConfig = {
  enabled: false,
  emoji: '⭐',
  threshold: 3,
};

const DEFAULT_TICKETS: TicketsConfig = {
  supportRoleIds: [],
  title: '🎫 Support Tickets',
  description:
    'Need help from staff? Choose a ticket type below and describe your issue.\n\nOnly open one ticket at a time.',
  types: [],
  open: {},
  nextNumber: 1,
};

const DEFAULT_LOGGING: LoggingConfig = {
  enabled: false,
  events: {
    messageDelete: true,
    messageEdit: true,
    memberJoin: true,
    memberLeave: true,
    memberBan: true,
    memberUnban: true,
    memberRole: true,
    channel: true,
    role: true,
  },
};

function defaults(): GuildConfig {
  return {
    staffRoleIds: [],
    hardbans: [],
    jailedRoles: {},
    dnr: {},
    invoke: {},
    automod: { ...DEFAULT_AUTOMOD, words: [] },
    antiraid: { ...DEFAULT_ANTIRAID, whitelist: [] },
    antinuke: defaultAntinuke(),
    levels: { ...DEFAULT_LEVELS, rewards: [] },
    welcome: { ...DEFAULT_WELCOME, autoRoleIds: [] },
    starboard: { ...DEFAULT_STARBOARD },
    tickets: { ...DEFAULT_TICKETS, open: {}, supportRoleIds: [], types: [] },
    logging: { ...DEFAULT_LOGGING, events: { ...DEFAULT_LOGGING.events } },
    logChannels: {},
    botLocked: true,
    aliases: {},
    autoresponders: [],
    fakePermissions: {},
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
  const raw = store[guildId];
  const base = defaults();
  return {
    ...base,
    ...raw,
    automod: { ...DEFAULT_AUTOMOD, ...raw.automod },
    antiraid: { ...DEFAULT_ANTIRAID, ...raw.antiraid },
    antinuke: {
      ...defaultAntinuke(),
      ...raw.antinuke,
      modules: { ...defaultAntinuke().modules, ...raw.antinuke?.modules },
    },
    levels: { ...DEFAULT_LEVELS, ...raw.levels },
    welcome: { ...DEFAULT_WELCOME, ...raw.welcome },
    starboard: { ...DEFAULT_STARBOARD, ...raw.starboard },
    tickets: {
      ...DEFAULT_TICKETS,
      ...raw.tickets,
      open: { ...(raw.tickets?.open ?? {}) },
      supportRoleIds: raw.tickets?.supportRoleIds ?? [],
      types: raw.tickets?.types ?? [],
    },
    logging: {
      ...DEFAULT_LOGGING,
      ...raw.logging,
      events: { ...DEFAULT_LOGGING.events, ...raw.logging?.events },
    },
    logChannels: (() => {
      const lc: LogChannels = { ...(raw.logChannels ?? {}) };
      if (!lc.server && lc.roles) {
        lc.server = lc.roles;
        delete lc.roles;
      }
      return lc;
    })(),
    aliases: raw.aliases ?? {},
    autoresponders: raw.autoresponders ?? [],
    fakePermissions: raw.fakePermissions ?? {},
    staffRoleIds: raw.staffRoleIds ?? [],
    dnr: raw.dnr ?? {},
  };
}

export function updateGuildConfig(guildId: string, patch: Partial<GuildConfig>): GuildConfig {
  const current = getGuildConfig(guildId);
  const next = { ...current, ...patch };
  const store = load();
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

export function memberHasFakePermission(
  guildId: string,
  roleIds: string[],
  permission: bigint,
): boolean {
  const fake = getGuildConfig(guildId).fakePermissions;
  const needed = new PermissionsBitField(permission);
  for (const roleId of roleIds) {
    const names = fake[roleId] ?? [];
    for (const name of names) {
      const bit = FAKE_PERM_MAP[name.toLowerCase()];
      if (bit !== undefined && needed.has(bit)) return true;
      if (name.toLowerCase() === 'administrator') return true;
    }
  }
  return false;
}
