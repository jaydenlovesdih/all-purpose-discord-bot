import { ColorResolvable, Guild, TextChannel } from 'discord.js';
import { getGuildConfig } from './guildConfig.js';
import { caseLog, Colors } from './embeds.js';

export async function sendLog(
  guild: Guild,
  event: keyof ReturnType<typeof getGuildConfig>['logging']['events'],
  title: string,
  description: string,
  color: ColorResolvable = Colors.log,
  opts?: { content?: string; contentLabel?: string; footer?: string; iconURL?: string },
): Promise<void> {
  const cfg = getGuildConfig(guild.id);
  if (!cfg.logging.enabled || !cfg.logging.events[event]) return;
  const channelId = cfg.logging.channelId ?? cfg.modLogChannelId;
  if (!channelId) return;
  const channel = guild.channels.cache.get(channelId);
  if (!channel?.isTextBased() || !channel.isSendable()) return;

  const colorNum = typeof color === 'number' ? color : Colors.log;

  await (channel as TextChannel)
    .send({
      embeds: [
        caseLog({
          title,
          description,
          content: opts?.content,
          contentLabel: opts?.contentLabel,
          footer: opts?.footer,
          iconURL: opts?.iconURL,
          color: colorNum,
        }),
      ],
    })
    .catch(() => undefined);
}
