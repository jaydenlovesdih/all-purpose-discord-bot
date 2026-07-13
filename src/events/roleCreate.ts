import { AuditLogEvent, Events } from 'discord.js';
import { BotClient } from '../types/index.js';
import { handleAntinuke } from '../utils/antinuke.js';
import { sendLog } from '../utils/log.js';
import { Colors } from '../utils/embeds.js';

export default {
  name: Events.GuildRoleCreate,
  async execute(role: import('discord.js').Role, _client: BotClient) {
    await handleAntinuke(role.guild, 'role', AuditLogEvent.RoleCreate);
    await sendLog(role.guild, 'role', 'Role Created', `**${role.name}**`, Colors.success);
  },
};
