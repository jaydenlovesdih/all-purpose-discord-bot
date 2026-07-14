/**
 * Built-in command shortcuts. The alias only replaces the command name —
 * remaining args (subcommands, users, etc.) are passed through unchanged.
 * Example: `,an toggle on` → `antinuke toggle on`
 */
export const BUILTIN_ALIASES: Record<string, string> = {
  // moderation
  q: 'ban',
  sban: 'softban',
  hban: 'hardban',
  to: 'timeout',
  // antinuke / raids
  an: 'antinuke',
  antin: 'antinuke',
  // snipe
  c: 'snipe',
  s: 'snipe',
  es: 'editsnipe',
  cs: 'clearsnipe',
  // levels
  lvl: 'levels',
  level: 'levels',
  // info
  i: 'userinfo',
  ui: 'userinfo',
  si: 'serverinfo',
  av: 'avatar',
  // misc
  gw: 'giveaway',
  ar: 'autoresponder',
  fp: 'fakepermissions',
  fakeperms: 'fakepermissions',
};

export function resolveAlias(
  name: string,
  guildAliases: Record<string, string> = {},
): string {
  const key = name.toLowerCase();
  return BUILTIN_ALIASES[key] ?? guildAliases[key] ?? key;
}
