import { Events } from 'discord.js';
import { BotClient } from '../types/index.js';
import { pushDeleteSnipe } from '../utils/snipeStore.js';

export default {
  name: Events.MessageDelete,
  async execute(message: import('discord.js').Message | import('discord.js').PartialMessage, _client: BotClient) {
    pushDeleteSnipe(message);
  },
};
