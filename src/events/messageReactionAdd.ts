import { EmbedBuilder, Events, TextChannel } from 'discord.js';
import { BotClient } from '../types/index.js';
import { getGuildConfig } from '../utils/guildConfig.js';
import { Colors } from '../utils/embeds.js';

const posted = new Set<string>();

export default {
  name: Events.MessageReactionAdd,
  async execute(
    reaction: import('discord.js').MessageReaction | import('discord.js').PartialMessageReaction,
    user: import('discord.js').User | import('discord.js').PartialUser,
    _client: BotClient,
  ) {
    if (user.bot) return;
    if (reaction.partial) await reaction.fetch().catch(() => undefined);
    if (reaction.message.partial) await reaction.message.fetch().catch(() => undefined);

    const message = reaction.message;
    if (!message.guild) return;

    const cfg = getGuildConfig(message.guild.id).starboard;
    if (!cfg.enabled || !cfg.channelId) return;

    const emoji = reaction.emoji.id ? `<:${reaction.emoji.name}:${reaction.emoji.id}>` : reaction.emoji.name;
    if (emoji !== cfg.emoji && reaction.emoji.name !== cfg.emoji) return;
    if ((reaction.count ?? 0) < cfg.threshold) return;

    const key = `${message.guild.id}:${message.id}`;
    if (posted.has(key)) return;
    posted.add(key);

    const channel = message.guild.channels.cache.get(cfg.channelId);
    if (!channel?.isTextBased()) return;

    const embed = new EmbedBuilder()
      .setColor(Colors.warning)
      .setAuthor({
        name: message.author?.tag ?? 'Unknown',
        iconURL: message.author?.displayAvatarURL(),
      })
      .setDescription(message.content?.slice(0, 4000) || '*No content*')
      .addFields({ name: 'Source', value: `[Jump to message](${message.url})` })
      .setFooter({ text: `${cfg.emoji} ${reaction.count}` })
      .setTimestamp(message.createdAt);

    const image = message.attachments.find((a) => a.contentType?.startsWith('image/'));
    if (image) embed.setImage(image.url);

    await (channel as TextChannel).send({ embeds: [embed] }).catch(() => undefined);
  },
};
