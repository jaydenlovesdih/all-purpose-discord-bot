import { AuditLogEvent, Events } from 'discord.js';
import { BotClient } from '../types/index.js';
import { handleAntinuke } from '../utils/antinuke.js';

export default {
  name: Events.GuildBanAdd,
  async execute(ban: import('discord.js').GuildBan, _client: BotClient) {
    await handleAntinuke(ban.guild, 'ban', AuditLogEvent.MemberBanAdd);
  },
};
