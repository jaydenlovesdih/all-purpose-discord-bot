import { Client, Collection, GatewayIntentBits, Partials } from 'discord.js';
import { BotClient, Command } from './types/index.js';

export function createClient(): BotClient {
  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMembers,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.GuildMessageReactions,
      GatewayIntentBits.GuildModeration,
      GatewayIntentBits.MessageContent,
      GatewayIntentBits.GuildVoiceStates,
    ],
    partials: [Partials.GuildMember, Partials.Channel, Partials.Message, Partials.Reaction],
  }) as BotClient;

  client.commands = new Collection<string, Command>();
  return client;
}
