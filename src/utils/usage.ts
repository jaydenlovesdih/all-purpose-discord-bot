import { PrefixArgDef, prefixSchemas } from './prefixSchemas.js';

/** Concrete examples shown when a command is used incorrectly */
const EXAMPLES: Record<string, string> = {
  ban: '@user cutting',
  softban: '@user spam',
  hardban: '@user raid alt',
  kick: '@user toxicity',
  mute: '@user 1h chatting in wrong channel',
  timeout: '@user 30m cool down',
  unmute: '@user cooled off',
  unban: '123456789012345678 appealed',
  jail: '@user breaking rules',
  unjail: '@user',
  strip: '@user mass ping',
  warn: '@user language',
  warnings: '@user',
  clearwarnings: '@user appealed',
  ticket: 'setup',
  dnr: '@user stop replying to me',
  undnr: '@user',
  role: '@user @Member',
  purge: '@user 1000',
  filter: 'add badword',
  antiraid: 'toggle on',
  antinuke: 'toggle on',
  fakepermissions: 'add @user BanMembers',
  alias: 'add q ban',
  autoresponder: 'add hi Hello there!',
  logging: 'enable',
  invoke: 'set ban {user.mention} was banned',
  prefix: '!',
  rolereaction: '@mog-winner',
  nuke: '#general',
  botlock: '',
  snipe: '1',
  editsnipe: '1',
  afk: 'brb food',
  welcome: 'dmmessage Welcome to {guild.name}, {user.name}!',
  help: 'antinuke',
  levels: 'toggle on',
  starboard: 'emoji ⭐',
  giveaway: '1h Nitro Classic',
  poll: 'Should we host a movie night?',
  say: 'Hello everyone',
  embed: '"Title" Description here',
  '8ball': 'Will it rain tomorrow?',
  eval: '1 + 1',
  avatar: '@user',
  userinfo: '@user',
  roles: '',
};

function schemaUsage(schema: PrefixArgDef[], prefix: string, command: string): string {
  if (!schema.length) return `${prefix}${command}`;

  const parts = schema.map((arg) => {
    const label =
      arg.type === 'user'
        ? '@user'
        : arg.type === 'role'
          ? '@role'
          : arg.type === 'channel'
            ? '#channel'
            : arg.type === 'integer'
              ? 'number'
              : arg.type === 'rest'
                ? '...'
                : 'text';
    return arg.required ? `<${label}>` : `[${label}]`;
  });

  return `${prefix}${command} ${parts.join(' ')}`;
}

export function buildUsageLine(command: string, prefix: string): string {
  const schema = prefixSchemas[command] ?? [];
  return schemaUsage(schema, prefix, command);
}

export function buildUsageExample(command: string, prefix: string): string {
  const example = EXAMPLES[command];
  if (example) return `${prefix}${command} ${example}`;
  return buildUsageLine(command, prefix);
}
