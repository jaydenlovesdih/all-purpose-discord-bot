import { Events } from 'discord.js';
import { BotClient } from '../types/index.js';
import { pushEditSnipe } from '../utils/snipeStore.js';

export default {
  name: Events.MessageUpdate,
  async execute(
    oldMessage: import('discord.js').Message | import('discord.js').PartialMessage,
    newMessage: import('discord.js').Message | import('discord.js').PartialMessage,
    _client: BotClient,
  ) {
    pushEditSnipe(oldMessage, newMessage);
  },
};
