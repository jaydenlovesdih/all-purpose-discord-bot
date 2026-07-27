import { ActivityType, Events } from 'discord.js';
import { config } from '../config.js';
import { BotClient } from '../types/index.js';
import { initCustomEmojis } from '../utils/emojis.js';
import { syncWhitelistFromGuilds } from '../utils/guildWhitelist.js';

export default {
  name: Events.ClientReady,
  once: true,
  async execute(client: BotClient) {
    if (!client.user) return;

    await initCustomEmojis(client);

    const added = syncWhitelistFromGuilds(client.guilds.cache.keys());
    console.log(`Logged in as ${client.user.tag}`);
    console.log(`Serving ${client.guilds.cache.size} guild(s)`);
    if (added > 0) {
      console.log(`Guild whitelist: auto-added ${added} existing server(s)`);
    } else {
      console.log(`Guild whitelist: ${client.guilds.cache.size} server(s) already allowed`);
    }
    console.log(`Owner bypass IDs: ${config.ownerIds.join(', ')}`);

    // Custom status (no Watching/Playing label) — shows as "/bestvids"
    client.user.setPresence({
      status: 'online',
      activities: [
        {
          type: ActivityType.Custom,
          name: 'Custom Status',
          state: '/bestvids',
        },
      ],
    });
  },
};
