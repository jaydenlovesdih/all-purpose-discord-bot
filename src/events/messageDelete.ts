import { Events } from 'discord.js';
import { BotClient } from '../types/index.js';
import { pushDeleteSnipe } from '../utils/snipeStore.js';
import { sendLog } from '../utils/log.js';

export default {
  name: Events.MessageDelete,
  async execute(message: import('discord.js').Message | import('discord.js').PartialMessage, _client: BotClient) {
    pushDeleteSnipe(message);
    if (!message.guild || message.author?.bot) return;

    const when = message.createdAt
      ? message.createdAt.toLocaleString('en-US', {
          month: 'long',
          day: 'numeric',
          year: 'numeric',
          hour: 'numeric',
          minute: '2-digit',
        })
      : 'unknown time';

    await sendLog(
      message.guild,
      'messageDelete',
      'Message Deleted',
      `**${message.author?.username ?? 'Unknown'}**'s message was deleted.`,
      undefined,
      {
        emoji: '🗑️',
        reason: 'Message deleted',
        moderator: 'Unknown / Self',
        detail: { name: '#️⃣ Channel:', value: `<#${message.channel.id}>` },
        target: message.author ?? null,
        content: message.content || undefined,
        contentLabel: '📄 Content:',
        footer: `User ID: ${message.author?.id ?? 'unknown'} · Sent ${when}`,
      },
    );
  },
};
