import { Client, GatewayIntentBits } from 'discord.js';
import { config } from '../config.js';

export interface DmBotSlot {
  slot: number;
  label: string;
  clientId: string;
  client: Client;
  isMain: boolean;
}

export interface DmBotGuildStatus {
  slot: number;
  label: string;
  clientId: string;
  inGuild: boolean;
  inviteUrl: string;
}

const slots: DmBotSlot[] = [];
const helperClients: Client[] = [];

/** OAuth invite — bots only need guild membership to DM shared members */
export function buildBotInviteUrl(clientId: string): string {
  return `https://discord.com/api/oauth2/authorize?client_id=${clientId}&permissions=0&scope=bot`;
}

export function getDmBotSlots(): readonly DmBotSlot[] {
  return slots;
}

export function getConfiguredDmBotCount(): number {
  return slots.length;
}

export async function initDmBots(mainClient: Client): Promise<void> {
  slots.length = 0;
  for (const helper of helperClients) {
    helper.destroy().catch(() => undefined);
  }
  helperClients.length = 0;

  slots.push({
    slot: 1,
    label: 'Main bot',
    clientId: config.clientId,
    client: mainClient,
    isMain: true,
  });

  const logins = config.dmBots.map(async (bot) => {
    const client = new Client({
      intents: [GatewayIntentBits.Guilds],
    });
    await client.login(bot.token);
    helperClients.push(client);
    slots.push({
      slot: bot.slot,
      label: bot.label,
      clientId: bot.clientId,
      client,
      isMain: false,
    });
    console.log(`DM bot slot ${bot.slot} logged in as ${client.user?.tag ?? bot.clientId}`);
  });

  await Promise.all(logins);
  console.log(`DM bot pool: ${slots.length} bot(s) configured (main + ${config.dmBots.length} helper(s))`);
}

export async function destroyDmBots(): Promise<void> {
  for (const client of helperClients) {
    client.destroy().catch(() => undefined);
  }
  helperClients.length = 0;
  slots.length = 0;
}

export async function getDmBotGuildStatus(guildId: string): Promise<DmBotGuildStatus[]> {
  const results: DmBotGuildStatus[] = [];

  for (const slot of slots) {
    const inGuild = await slot.client.guilds
      .fetch(guildId)
      .then(() => true)
      .catch(() => false);

    results.push({
      slot: slot.slot,
      label: slot.label,
      clientId: slot.clientId,
      inGuild,
      inviteUrl: buildBotInviteUrl(slot.clientId),
    });
  }

  return results;
}

export async function getAvailableDmBotsInGuild(guildId: string): Promise<DmBotSlot[]> {
  const available: DmBotSlot[] = [];
  for (const slot of slots) {
    const inGuild = await slot.client.guilds
      .fetch(guildId)
      .then(() => true)
      .catch(() => false);
    if (inGuild) available.push(slot);
  }
  return available;
}
