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
  mute: [
    { name: 'user', type: 'user', required: true },
    { name: 'minutes', type: 'integer', required: true },
    { name: 'reason', type: 'rest' },
  ],
  unmute: [{ name: 'user', type: 'user', required: true }],
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