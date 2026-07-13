import { Client, Collection, GatewayIntentBits, Partials } from 'discord.js';
import { BotClient, Command } from './types/index.js';

export function createClient(): BotClient {
  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMembers,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.GuildModeration,
      GatewayIntentBits.MessageContent,
    ],
    partials: [Partials.GuildMember, Partials.Channel],
  }) as BotClient;

  client.commands = new Collection<string, Command>();
  return client;
}
