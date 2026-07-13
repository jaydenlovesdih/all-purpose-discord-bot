import { EmbedBuilder, Events, TextChannel } from 'discord.js';
import { BotClient } from '../types/index.js';
import { getGuildConfig } from '../utils/guildConfig.js';
import { Colors } from '../utils/embeds.js';

const joinBucket = new Map<string, number[]>();

export default {
  name: Events.GuildMemberAdd,
  async execute(member: import('discord.js').GuildMember, _client: BotClient) {
    const cfg = getGuildConfig(member.guild.id);

    // Hardban enforcement
    if (cfg.hardbans.includes(member.id)) {
      await member.ban({ reason: 'Hardban enforcement' }).catch(() => undefined);
      return;
    }

    // AntiRaid
    if (cfg.antiraid.enabled && !cfg.antiraid.whitelist.includes(member.id)) {
      const now = Date.now();
      const stamps = (joinBucket.get(member.guild.id) ?? []).filter((t) => now - t < 60_000);
      stamps.push(now);
      joinBucket.set(member.guild.id, stamps);

      let punish = false;
      let reason = 'AntiRaid';

      if (stamps.length >= cfg.antiraid.massJoinThreshold) {
        punish = true;
        reason = 'AntiRaid: mass join';
      }

      const ageDays = (Date.now() - member.user.createdTimestamp) / 86_400_000;
      if (cfg.antiraid.minAccountAgeDays > 0 && ageDays < cfg.antiraid.minAccountAgeDays) {
        punish = true;
        reason = 'AntiRaid: account too new';
      }

      if (cfg.antiraid.blockDefaultAvatar && !member.user.avatar) {
        punish = true;
        reason = 'AntiRaid: default avatar';
      }

      if (punish) {
        switch (cfg.antiraid.punishment) {
          case 'ban':
            await member.ban({ reason }).catch(() => undefined);
            break;
          case 'kick':
            await member.kick(reason).catch(() => undefined);
            break;
          case 'timeout':
            await member.timeout(10 * 60_000, reason).catch(() => undefined);
            break;
          case 'jail':
            if (cfg.jailRoleId) {
              await member.roles.set([cfg.jailRoleId], reason).catch(() => undefined);
            }
            break;
        }

        if (cfg.antiraid.logChannelId) {
          const log = member.guild.channels.cache.get(cfg.antiraid.logChannelId);
          if (log?.isTextBased()) {
            await (log as TextChannel)
              .send({ embeds: [new EmbedBuilder().setColor(Colors.error).setTitle('AntiRaid Action').setDescription(`${member} — ${reason}`).setTimestamp()] })
              .catch(() => undefined);
          }
        }
        return;
      }
    }

    // Autoroles
    for (const roleId of cfg.welcome.autoRoleIds) {
      await member.roles.add(roleId).catch(() => undefined);
    }

    // Welcome
    if (cfg.welcome.enabled && cfg.welcome.channelId) {
      const channel = member.guild.channels.cache.get(cfg.welcome.channelId);
      if (channel?.isTextBased() && channel.isSendable()) {
        const text = cfg.welcome.message
          .replaceAll('{user}', member.toString())
          .replaceAll('{user.mention}', member.toString())
          .replaceAll('{user.name}', member.user.username)
          .replaceAll('{guild.name}', member.guild.name);
        await channel.send(text).catch(() => undefined);
      }
    }
  },
};
