import { Events } from 'discord.js';
import { BotClient } from '../types/index.js';
import { getGuildConfig } from '../utils/guildConfig.js';
import { sendLog } from '../utils/log.js';
import { Colors } from '../utils/embeds.js';

export default {
  name: Events.GuildMemberRemove,
  async execute(member: import('discord.js').GuildMember | import('discord.js').PartialGuildMember, _client: BotClient) {
    const guild = member.guild;
    const cfg = getGuildConfig(guild.id);

    await sendLog(
      guild,
      'memberLeave',
      'Member Left',
      `${member.user?.tag ?? member.id} (\`${member.id}\`)`,
      Colors.warning,
    );

    if (cfg.welcome.leaveEnabled && cfg.welcome.leaveChannelId) {
      const channel = guild.channels.cache.get(cfg.welcome.leaveChannelId);
      if (channel?.isTextBased() && channel.isSendable()) {
        const text = cfg.welcome.leaveMessage
          .replaceAll('{user}', `<@${member.id}>`)
          .replaceAll('{user.mention}', `<@${member.id}>`)
          .replaceAll('{user.name}', member.user?.username ?? 'Unknown')
          .replaceAll('{guild.name}', guild.name);
        await channel.send(text).catch(() => undefined);
      }
    }
  },
};
