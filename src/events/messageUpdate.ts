import { Events } from 'discord.js';
import { BotClient } from '../types/index.js';
import { pushEditSnipe } from '../utils/snipeStore.js';
import { sendLog } from '../utils/log.js';
import { Colors } from '../utils/embeds.js';

export default {
  name: Events.MessageUpdate,
  async execute(
    oldMessage: import('discord.js').Message | import('discord.js').PartialMessage,
    newMessage: import('discord.js').Message | import('discord.js').PartialMessage,
    _client: BotClient,
  ) {
    pushEditSnipe(oldMessage, newMessage);
    if (oldMessage.guild && !oldMessage.author?.bot && (oldMessage.content ?? '') !== (newMessage.content ?? '')) {
      await sendLog(
        oldMessage.guild,
        'messageEdit',
        'Message Edited',
        `**Author:** ${oldMessage.author?.tag ?? 'Unknown'}\n**Channel:** <#${oldMessage.channel?.id}>\n**Before:** ${(oldMessage.content || '*empty*').slice(0, 400)}\n**After:** ${(newMessage.content || '*empty*').slice(0, 400)}`,
        Colors.warning,
      );
    }
  },
};
