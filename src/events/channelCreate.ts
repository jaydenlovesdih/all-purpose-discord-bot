import { AuditLogEvent, Events } from 'discord.js';
import { BotClient } from '../types/index.js';
import { handleAntinuke } from '../utils/antinuke.js';
import { sendLog } from '../utils/log.js';
import { Colors } from '../utils/embeds.js';

export default {
  name: Events.ChannelCreate,
  async execute(channel: import('discord.js').GuildChannel, _client: BotClient) {
    if (!channel.guild) return;
    await handleAntinuke(channel.guild, 'channel', AuditLogEvent.ChannelCreate);
    await sendLog(channel.guild, 'channel', 'Channel Created', `${channel} (\`${channel.name}\`)`, Colors.success);
  },
};
