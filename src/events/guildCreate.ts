import { Events, Guild } from 'discord.js';
import { warmGuildRolesCache } from '../utils/guildRolesCache.js';
import { isGuildWhitelisted } from '../utils/guildWhitelist.js';

export default {
  name: Events.GuildCreate,
  async execute(guild: Guild) {
    if (isGuildWhitelisted(guild.id)) {
      console.log(`Joined whitelisted guild: ${guild.name} (${guild.id})`);
      await warmGuildRolesCache(guild.client, guild.id).catch(() => undefined);
      return;
    }

    console.warn(
      `Leaving non-whitelisted guild: ${guild.name} (${guild.id}) — add with allowserver first`,
    );

    try {
      const owner = await guild.fetchOwner().catch(() => null);
      if (owner) {
        await owner
          .send(
            `I left **${guild.name}** because this server is not on my invite whitelist. Ask a bot owner to allow guild ID \`${guild.id}\` first.`,
          )
          .catch(() => undefined);
      }
    } catch {
      /* ignore */
    }

    await guild.leave().catch((err) => {
      console.error(`Failed to leave guild ${guild.id}:`, err);
    });
  },
};
