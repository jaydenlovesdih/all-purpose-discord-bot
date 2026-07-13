import { ColorResolvable, EmbedBuilder, Guild, TextChannel } from 'discord.js';
import { getGuildConfig } from './guildConfig.js';
import { Colors } from './embeds.js';

export async function sendLog(
  guild: Guild,
  event: keyof ReturnType<typeof getGuildConfig>['logging']['events'],
  title: string,
  description: string,
  color: ColorResolvable = Colors.info,
): Promise<void> {
  const cfg = getGuildConfig(guild.id);
  if (!cfg.logging.enabled || !cfg.logging.events[event]) return;
  const channelId = cfg.logging.channelId ?? cfg.modLogChannelId;
  if (!channelId) return;
  const channel = guild.channels.cache.get(channelId);
  if (!channel?.isTextBased() || !channel.isSendable()) return;

  await (channel as TextChannel)
    .send({
      embeds: [new EmbedBuilder().setColor(color).setTitle(title).setDescription(description).setTimestamp()],
    })
    .catch(() => undefined);
}
