export type PrefixArgType = 'user' | 'role' | 'channel' | 'integer' | 'string' | 'rest';

export interface PrefixArgDef {
  name: string;
  type: PrefixArgType;
  required?: boolean;
}

export const prefixSchemas: Record<string, PrefixArgDef[]> = {
  ping: [],
  help: [],
  botinfo: [],
  serverinfo: [],
  coinflip: [],
  setup: [],
  clearsnipe: [],
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
    { name: 'minutes', type: 'integer', required: true },
    { name: 'reason', type: 'rest' },
  ],
  unmute: [{ name: 'user', type: 'user', required: true }],
  jail: [
    { name: 'user', type: 'user' },
    { name: 'reason', type: 'rest' },
  ],
  unjail: [{ name: 'user', type: 'user', required: true }],
  strip: [
    { name: 'user', type: 'user', required: true },
    { name: 'reason', type: 'rest' },
  ],
  purge: [{ name: 'amount', type: 'integer', required: true }],
  warn: [
    { name: 'user', type: 'user', required: true },
    { name: 'reason', type: 'rest', required: true },
  ],
  warnings: [{ name: 'user', type: 'user', required: true }],
  clearwarnings: [{ name: 'user', type: 'user', required: true }],
  role: [
    { name: 'user', type: 'user', required: true },
    { name: 'role', type: 'role', required: true },
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
  invoke: [
    { name: 'subcommand', type: 'string', required: true },
    { name: 'command', type: 'string' },
    { name: 'text', type: 'rest' },
  ],
  prefix: [{ name: 'new_prefix', type: 'string' }],
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
