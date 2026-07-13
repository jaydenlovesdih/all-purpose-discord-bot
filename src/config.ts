import 'dotenv/config';

function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

export const config = {
  token: requireEnv('DISCORD_TOKEN'),
  clientId: requireEnv('CLIENT_ID'),
  ownerId: requireEnv('OWNER_ID'),
  prefix: process.env.PREFIX ?? '',
  isProduction: process.env.NODE_ENV === 'production',
};
