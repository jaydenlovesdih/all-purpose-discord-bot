import { GuildMember, Message, PermissionFlagsBits } from 'discord.js';
import { getGuildConfig, mutateGuildConfig } from './guildConfig.js';
import { canBypass } from './permissions.js';

const recentMessages = new Map<string, number[]>();

function isWhitelisted(message: Message, member: GuildMember | null): boolean {
  const cfg = getGuildConfig(message.guildId!).automod;
  if (cfg.whitelistChannels.includes(message.channel.id)) return true;
  if (cfg.whitelistUsers.includes(message.author.id)) return true;
  if (member && member.roles.cache.some((r) => cfg.whitelistRoles.includes(r.id))) return true;
  if (canBypass(message.author.id)) return true;
  if (member?.permissions.has(PermissionFlagsBits.ManageMessages)) return true;
  return false;
}

function countCapsPercent(text: string): number {
  const letters = text.replace(/[^a-zA-Z]/g, '');
  if (letters.length < 8) return 0;
  const caps = letters.replace(/[^A-Z]/g, '').length;
  return (caps / letters.length) * 100;
}

function emojiCount(text: string): number {
  const matches = text.match(/\p{Extended_Pictographic}/gu);
  return matches?.length ?? 0;
}

export async function runAutoMod(message: Message): Promise<boolean> {
  if (!message.guild || message.author.bot || !message.member) return false;
  const cfg = getGuildConfig(message.guild.id).automod;
  if (!cfg.enabled) return false;
  if (isWhitelisted(message, message.member)) return false;

  const content = message.content;
  let hit: string | null = null;

  if (cfg.words.length && cfg.words.some((w) => content.toLowerCase().includes(w.toLowerCase()))) {
    hit = 'filtered word';
  }

  if (!hit && cfg.invites && /(discord\.gg|discord\.com\/invite)\//i.test(content)) {
    hit = 'invite link';
  }

  if (!hit && cfg.links && /https?:\/\//i.test(content) && !/(discord\.gg|discord\.com\/invite)\//i.test(content)) {
    hit = 'link';
  }

  if (!hit && cfg.caps && countCapsPercent(content) >= cfg.capsThreshold) {
    hit = 'excessive caps';
  }

  if (!hit && cfg.massMention && message.mentions.users.size >= cfg.mentionThreshold) {
    hit = 'mass mention';
  }

  if (!hit && cfg.emojis && emojiCount(content) >= cfg.emojiThreshold) {
    hit = 'emoji spam';
  }

  if (!hit && cfg.spam) {
    const key = `${message.guild.id}:${message.author.id}`;
    const now = Date.now();
    const stamps = (recentMessages.get(key) ?? []).filter((t) => now - t < 7000);
    stamps.push(now);
    recentMessages.set(key, stamps);
    if (stamps.length >= cfg.spamThreshold) {
      hit = 'spam';
    }
  }

  if (!hit) return false;

  await message.delete().catch(() => undefined);

  const member = message.member;
  const reason = `AutoMod: ${hit}`;

  switch (cfg.punishment) {
    case 'timeout':
      await member.timeout(cfg.timeoutSeconds * 1000, reason).catch(() => undefined);
      break;
    case 'kick':
      await member.kick(reason).catch(() => undefined);
      break;
    case 'ban':
      await member.ban({ reason }).catch(() => undefined);
      break;
    case 'jail': {
      const guildCfg = getGuildConfig(message.guild.id);
      if (guildCfg.jailRoleId) {
        const roles = member.roles.cache.filter((r) => r.id !== message.guild!.id).map((r) => r.id);
        mutateGuildConfig(message.guild.id, (c) => {
          c.jailedRoles[member.id] = roles;
        });
        await member.roles.set([guildCfg.jailRoleId], reason).catch(() => undefined);
      }
      break;
    }
    default:
      break;
  }

  if (message.channel.isTextBased() && message.channel.isSendable()) {
    await message.channel
      .send({ content: `${message.author}, message removed (**${hit}**).` })
      .then((m: import('discord.js').Message) => setTimeout(() => m.delete().catch(() => undefined), 5000))
      .catch(() => undefined);
  }

  return true;
}
