import { Events } from 'discord.js';
import { BotClient } from '../types/index.js';
import { pushDeleteSnipe } from '../utils/snipeStore.js';
import { sendLog } from '../utils/log.js';
import { Colors } from '../utils/embeds.js';

export default {
  name: Events.MessageDelete,
  async execute(message: import('discord.js').Message | import('discord.js').PartialMessage, _client: BotClient) {
    pushDeleteSnipe(message);
    if (message.guild && !message.author?.bot) {
      await sendLog(
        message.guild,
        'messageDelete',
        'Message Deleted',
        `**Author:** ${message.author?.tag ?? 'Unknown'}\n**Channel:** <#${message.channel.id}>\n${(message.content || '*empty*').slice(0, 900)}`,
        Colors.error,
      );
    }
  },
};
