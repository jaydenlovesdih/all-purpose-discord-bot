import { ActivityType, Events } from 'discord.js';
import { config } from '../config.js';
import { BotClient } from '../types/index.js';

export default {
  name: Events.ClientReady,
  once: true,
  async execute(client: BotClient) {
    if (!client.user) return;

    console.log(`Logged in as ${client.user.tag}`);
    console.log(`Serving ${client.guilds.cache.size} guild(s)`);
    console.log(`Owner bypass IDs: ${config.ownerIds.join(', ')}`);

    client.user.setActivity(`${config.prefix}help`, { type: ActivityType.Watching });
  },
};
