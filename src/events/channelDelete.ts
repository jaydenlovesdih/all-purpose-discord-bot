import { AuditLogEvent, Events } from 'discord.js';
import { BotClient } from '../types/index.js';
import { handleAntinuke } from '../utils/antinuke.js';
import { isBlazeModChannel, sendLog } from '../utils/log.js';
import { Colors } from '../utils/embeds.js';

export default {
  name: Events.ChannelDelete,
  async execute(channel: import('discord.js').GuildChannel | import('discord.js').DMChannel, _client: BotClient) {
    if (!('guild' in channel) || !channel.guild) return;
    await handleAntinuke(channel.guild, 'channel', AuditLogEvent.ChannelDelete);
    if (isBlazeModChannel(channel)) return;
    await sendLog(
      channel.guild,
      'channel',
      'Channel Deleted',
      `\`${channel.name}\``,
      Colors.error,
      {
        emoji: '📁',
        detail: { name: '#️⃣ Channel:', value: `\`${channel.name}\`` },
        reason: 'Channel deleted',
      },
    );
  },
};
