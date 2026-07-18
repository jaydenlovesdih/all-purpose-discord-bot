import { Events } from 'discord.js';
import { BotClient } from '../types/index.js';
import { pushEditSnipe } from '../utils/snipeStore.js';
import { sendLog } from '../utils/log.js';
import { bolt } from '../utils/emojis.js';

export default {
  name: Events.MessageUpdate,
  async execute(
    oldMessage: import('discord.js').Message | import('discord.js').PartialMessage,
    newMessage: import('discord.js').Message | import('discord.js').PartialMessage,
    _client: BotClient,
  ) {
    let before = oldMessage;
    let after = newMessage;

    if (oldMessage.partial) {
      before = await oldMessage.fetch().catch(() => oldMessage);
    }
    if (newMessage.partial) {
      after = await newMessage.fetch().catch(() => newMessage);
    }

    pushEditSnipe(before, after);

    if (
      !before.guild ||
      before.author?.bot ||
      (before.content ?? '') === (after.content ?? '')
    ) {
      return;
    }

    await sendLog(
      before.guild,
      'messageEdit',
      'Message Edited',
      `**${before.author?.username ?? 'Unknown'}** edited a message.`,
      undefined,
      {
        emoji: bolt(),
        reason: 'Message edited',
        moderator: before.author ?? null,
        detail: { name: '#️⃣ Channel:', value: `<#${before.channel?.id}>` },
        target: before.author ?? null,
        content: `**Before:**\n${(before.content || '*empty*').slice(0, 450)}\n\n**After:**\n${(after.content || '*empty*').slice(0, 450)}`,
        contentLabel: '📄 Edit:',
        footer: `User ID: ${before.author?.id ?? 'unknown'}`,
      },
    );
  },
};
