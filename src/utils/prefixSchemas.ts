import { BUILTIN_ALIASES } from './aliases.js';

export type PrefixArgType = 'user' | 'role' | 'channel' | 'integer' | 'string' | 'rest';

export interface PrefixArgDef {
  name: string;
  type: PrefixArgType;
  required?: boolean;
}

export const prefixSchemas: Record<string, PrefixArgDef[]> = {
  ping: [],
  help: [{ name: 'command', type: 'string' }],
  botinfo: [],
  serverinfo: [],
  coinflip: [],
  setup: [],
  clearsnipe: [],
  roles: [],
  userinfo: [{ name: 'user', type: 'user' }],
  avatar: [{ name: 'user', type: 'user' }],
  ban: [
    { name: 'user', type: 'user', required: true },
    { name: 'delete_days', type: 'integer' },
    { name: 'reason', type: 'rest' },
  ],
  kick: [
    { name: 'user', type: 'user', required: true },
    { name: 'reason', type: 'rest' },
  ],
  softban: [
    { name: 'user', type: 'user', required: true },
    { name: 'reason', type: 'rest' },
  ],
  hardban: [
    { name: 'user', type: 'user', required: true },
    { name: 'reason', type: 'rest' },
  ],
  unban: [
    { name: 'userid', type: 'string', required: true },
    { name: 'reason', type: 'rest' },
  ],
  mute: [
    { name: 'user', type: 'user', required: true },
    { name: 'duration', type: 'string', required: true },
    { name: 'reason', type: 'rest' },
  ],
  timeout: [
    { name: 'user', type: 'user', required: true },
    { name: 'duration', type: 'string', required: true },
    { name: 'reason', type: 'rest' },
  ],
  unmute: [
    { name: 'user', type: 'user', required: true },
    { name: 'reason', type: 'rest' },
  ],
  jail: [
    { name: 'user', type: 'user' },
    { name: 'reason', type: 'rest' },
  ],
  unjail: [
    { name: 'user', type: 'user', required: true },
    { name: 'reason', type: 'rest' },
  ],
  strip: [
    { name: 'user', type: 'user', required: true },
    { name: 'reason', type: 'rest' },
  ],
  purge: [
    { name: 'user', type: 'user' },
    { name: 'amount', type: 'integer', required: true },
  ],
  warn: [
    { name: 'user', type: 'user', required: true },
    { name: 'reason', type: 'rest', required: true },
  ],
  warnings: [{ name: 'user', type: 'user', required: true }],
  role: [
    { name: 'user', type: 'user', required: true },
    { name: 'role', type: 'role', required: true },
    { name: 'reason', type: 'rest' },
  ],
  clearwarnings: [
    { name: 'user', type: 'user', required: true },
    { name: 'reason', type: 'rest' },
  ],
  ticket: [
    { name: 'subcommand', type: 'string', required: true },
    { name: 'role', type: 'role' },
    { name: 'user', type: 'user' },
    { name: 'text', type: 'rest' },
  ],
  dnr: [
    { name: 'user', type: 'user', required: true },
    { name: 'reason', type: 'rest' },
  ],
  undnr: [
    { name: 'user', type: 'user', required: true },
    { name: 'reason', type: 'rest' },
  ],
  filter: [
    { name: 'subcommand', type: 'string', required: true },
    { name: 'value', type: 'string' },
    { name: 'threshold', type: 'integer' },
  ],
  antiraid: [
    { name: 'subcommand', type: 'string', required: true },
    { name: 'value', type: 'string' },
    { name: 'threshold', type: 'integer' },
  ],
  antinuke: [
    { name: 'subcommand', type: 'string', required: true },
    { name: 'value', type: 'string' },
    { name: 'threshold', type: 'integer' },
  ],
  fakepermissions: [
    { name: 'subcommand', type: 'string', required: true },
    { name: 'permissions', type: 'rest' },
  ],
  alias: [
    { name: 'subcommand', type: 'string', required: true },
    { name: 'alias', type: 'string' },
    { name: 'command', type: 'string' },
  ],
  autoresponder: [
    { name: 'subcommand', type: 'string', required: true },
    { name: 'trigger', type: 'string' },
    { name: 'response', type: 'rest' },
  ],
  logging: [
    { name: 'subcommand', type: 'string', required: true },
  ],
  invoke: [
    { name: 'subcommand', type: 'string', required: true },
    { name: 'command', type: 'string' },
    { name: 'text', type: 'rest' },
  ],
  prefix: [{ name: 'new_prefix', type: 'string' }],
  rolereaction: [{ name: 'role', type: 'role', required: true }],
  snipe: [{ name: 'index', type: 'integer' }],
  editsnipe: [{ name: 'index', type: 'integer' }],
  afk: [{ name: 'reason', type: 'rest' }],
  welcome: [
    { name: 'subcommand', type: 'string', required: true },
    { name: 'text', type: 'rest' },
  ],
  levels: [
    { name: 'subcommand', type: 'string', required: true },
    { name: 'level', type: 'integer' },
    { name: 'text', type: 'rest' },
  ],
  starboard: [
    { name: 'subcommand', type: 'string', required: true },
    { name: 'emoji', type: 'string' },
    { name: 'count', type: 'integer' },
  ],
  giveaway: [
    { name: 'duration', type: 'string', required: true },
    { name: 'prize', type: 'rest', required: true },
  ],
  poll: [{ name: 'question', type: 'rest', required: true }],
  say: [
    { name: 'message', type: 'rest', required: true },
    { name: 'channel', type: 'channel' },
  ],
  embed: [
    { name: 'title', type: 'string', required: true },
    { name: 'description', type: 'rest', required: true },
    { name: 'color', type: 'string' },
  ],
  '8ball': [{ name: 'question', type: 'rest', required: true }],
  eval: [{ name: 'code', type: 'rest', required: true }],
};

// Alias names share the same arg schema so `,an toggle` parses like `,antinuke toggle`
for (const [alias, target] of Object.entries(BUILTIN_ALIASES)) {
  if (prefixSchemas[target] !== undefined && prefixSchemas[alias] === undefined) {
    prefixSchemas[alias] = prefixSchemas[target];
  }
}
