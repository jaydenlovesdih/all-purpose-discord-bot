import 'dotenv/config';

function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

/** Hard-coded bot owners — full bypass in all servers */
const BUILTIN_OWNER_IDS = [
  '724265272009293875',
  '743977241138167909',
  '1507115973373722698',
  '786084067644932137',
];

function buildOwnerIds(): string[] {
  const ids = new Set<string>([requireEnv('OWNER_ID'), ...BUILTIN_OWNER_IDS]);
  const extra = process.env.OWNER_IDS?.split(',').map((s) => s.trim()).filter(Boolean) ?? [];
  for (const id of extra) ids.add(id);
  return [...ids];
}

/** Extra bots (2–6) used to split mass announcement DMs across accounts */
export interface DmBotConfig {
  slot: number;
  label: string;
  token: string;
  clientId: string;
}

function loadDmBots(): DmBotConfig[] {
  const bots: DmBotConfig[] = [];
  for (let slot = 2; slot <= 6; slot++) {
    const token = process.env[`DM_BOT_TOKEN_${slot}`]?.trim();
    const clientId = process.env[`DM_BOT_CLIENT_ID_${slot}`]?.trim();
    if (token && clientId) {
      bots.push({ slot, label: `Bot ${slot}`, token, clientId });
    }
  }
  return bots;
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
  /** Helper DM bots (main bot is slot 1) */
  dmBots: loadDmBots(),
};
