import { AuditLogEvent, Events } from 'discord.js';
import { BotClient } from '../types/index.js';
import { handleAntinuke } from '../utils/antinuke.js';
import { isBlazeModChannel, sendLog } from '../utils/log.js';
import { Colors } from '../utils/embeds.js';

export default {
  name: Events.ChannelCreate,
  async execute(channel: import('discord.js').GuildChannel, _client: BotClient) {
    if (!channel.guild) return;
    await handleAntinuke(channel.guild, 'channel', AuditLogEvent.ChannelCreate);
    if (isBlazeModChannel(channel)) return;
    await sendLog(
      channel.guild,
      'channel',
      'Channel Created',
      `${channel} (\`${channel.name}\`)`,
      Colors.success,
      {
        emoji: '📁',
        detail: { name: '#️⃣ Channel:', value: `${channel}` },
        reason: 'Channel created',
      },
    );
  },
};
