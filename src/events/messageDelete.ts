import { Events } from 'discord.js';
import { BotClient } from '../types/index.js';
import { pushDeleteSnipe } from '../utils/snipeStore.js';
import { sendLog } from '../utils/log.js';
import { blackBolt } from '../utils/emojis.js';

export default {
  name: Events.MessageDelete,
  async execute(
    message: import('discord.js').Message | import('discord.js').PartialMessage,
    _client: BotClient,
  ) {
    let full = message;
    if (message.partial) {
      full = await message.fetch().catch(() => message);
    }

    pushDeleteSnipe(full);
    if (!full.guild || full.author?.bot) return;

    const when = full.createdAt
      ? full.createdAt.toLocaleString('en-US', {
          month: 'long',
          day: 'numeric',
          year: 'numeric',
          hour: 'numeric',
          minute: '2-digit',
        })
      : 'unknown time';

    await sendLog(
      full.guild,
      'messageDelete',
      'Message Deleted',
      `**${full.author?.username ?? 'Unknown'}**'s message was deleted.`,
      undefined,
      {
        emoji: blackBolt(),
        reason: 'Message deleted',
        moderator: 'Unknown / Self',
        detail: { name: '#️⃣ Channel:', value: `<#${full.channel.id}>` },
        target: full.author ?? null,
        content: full.content || undefined,
        contentLabel: '📄 Content:',
        footer: `User ID: ${full.author?.id ?? 'unknown'} · Sent ${when}`,
      },
    );
  },
};
