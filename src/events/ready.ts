import { ActivityType, Events } from 'discord.js';
import { config } from '../config.js';
import { BotClient } from '../types/index.js';
import { initCustomEmojis } from '../utils/emojis.js';

export default {
  name: Events.ClientReady,
  once: true,
  async execute(client: BotClient) {
    if (!client.user) return;

    await initCustomEmojis(client);

    console.log(`Logged in as ${client.user.tag}`);
    console.log(`Serving ${client.guilds.cache.size} guild(s)`);
    console.log(`Owner bypass IDs: ${config.ownerIds.join(', ')}`);

    // Custom status (no Watching/Playing label) — shows as "discord.gg/mogs"
    client.user.setPresence({
      status: 'online',
      activities: [
        {
          type: ActivityType.Custom,
          name: 'Custom Status',
          state: 'discord.gg/mogs',
        },
      ],
    });
  },
};
