import { Events } from 'discord.js';
import { config } from '../config.js';
import { runCommand } from '../handlers/commandRunner.js';
import { BotClient } from '../types/index.js';
import { runAutoMod } from '../utils/automod.js';
import { errorEmbed } from '../utils/embeds.js';
import { getGuildConfig, mutateGuildConfig } from '../utils/guildConfig.js';
import { addMessageXp, canGainXp } from '../utils/levelsStore.js';
import {
  buildMissingArgsMessage,
  isTextCommandChannel,
  parsePrefixMessage,
  PrefixCommandInteraction,
} from '../utils/prefixInteraction.js';
import { prefixSchemas } from '../utils/prefixSchemas.js';
import { getPrefix } from '../utils/setup.js';

/** Built-in aliases matching Bleed/Greed muscle memory */
const BUILTIN_ALIASES: Record<string, string> = {
  timeout: 'timeout',
  to: 'timeout',
  mute: 'mute',
  q: 'ban',
  sban: 'softban',
  hban: 'hardban',
  i: 'userinfo',
  ui: 'userinfo',
  si: 'serverinfo',
  av: 'avatar',
  gw: 'giveaway',
  ar: 'autoresponder',
  fp: 'fakepermissions',
  fakeperms: 'fakepermissions',
  an: 'antinuke',
};

export default {
  name: Events.MessageCreate,
  async execute(message: import('discord.js').Message, client: BotClient) {
    if (message.author.bot || !message.guild) return;
    if (!isTextCommandChannel(message.channel)) return;

    if (client.user && message.mentions.has(client.user) && !message.mentions.everyone) {
      const onlyMention =
        message.content.replace(new RegExp(`<@!?${client.user.id}>`, 'g'), '').trim().length === 0;
      if (onlyMention) {
        const prefix = getPrefix(message.guild.id, config.prefix);
        await message.reply(`Prefix: \`${prefix}\` · Try \`${prefix}help\` or \`${prefix}setup\``);
        return;
      }
    }

    const guildCfg = getGuildConfig(message.guild.id);

    // AFK
    if (guildCfg.afk[message.author.id]) {
      mutateGuildConfig(message.guild.id, (c) => {
        delete c.afk[message.author.id];
      });
      const m = await message.reply({ content: `Welcome back ${message.author} — AFK removed.` }).catch(() => null);
      if (m) setTimeout(() => m.delete().catch(() => undefined), 4000);
    }
    for (const user of message.mentions.users.values()) {
      const entry = guildCfg.afk[user.id];
      if (entry) {
        await message
          .reply(`**${user.username}** is AFK: ${entry.reason} (<t:${Math.floor(entry.since / 1000)}:R>)`)
          .catch(() => undefined);
        break;
      }
    }

    // Autoresponder (before commands)
    for (const entry of guildCfg.autoresponders) {
      const content = message.content;
      const hit = entry.exact
        ? content.toLowerCase() === entry.trigger.toLowerCase()
        : content.toLowerCase().includes(entry.trigger.toLowerCase());
      if (hit) {
        if (message.channel.isSendable()) {
          await message.channel.send(entry.response).catch(() => undefined);
        }
        break;
      }
    }

    if (await runAutoMod(message)) return;

    // Levels
    if (guildCfg.levels.enabled && canGainXp(message.guild.id, message.author.id)) {
      const result = addMessageXp(message.guild.id, message.author.id);
      if (result.leveled) {
        const reward = guildCfg.levels.rewards.find((r) => r.level === result.level);
        if (reward && message.member) {
          await message.member.roles.add(reward.roleId).catch(() => undefined);
        }
        const text = guildCfg.levels.message
          .replaceAll('{user}', message.author.toString())
          .replaceAll('{user.mention}', message.author.toString())
          .replaceAll('{user.name}', message.author.username)
          .replaceAll('{level}', String(result.level))
          .replaceAll('{guild.name}', message.guild.name);
        const channel = guildCfg.levels.channelId
          ? message.guild.channels.cache.get(guildCfg.levels.channelId)
          : message.channel;
        if (channel?.isTextBased() && channel.isSendable()) {
          await channel.send(text).catch(() => undefined);
        }
      }
    }

    const prefix = getPrefix(message.guild.id, config.prefix);
    const parsed = parsePrefixMessage(message.content, prefix);
    if (!parsed) return;

    const resolved =
      BUILTIN_ALIASES[parsed.command] ??
      guildCfg.aliases[parsed.command] ??
      parsed.command;

    const command = client.commands.get(resolved);
    if (!command) return;

    const schema = prefixSchemas[resolved] ?? prefixSchemas[parsed.command];
    if (schema === undefined) return;

    try {
      const interaction = new PrefixCommandInteraction(message, resolved, parsed.args);
      await runCommand(interaction, client);
    } catch (error) {
      if (error instanceof Error && error.message.startsWith('Missing required')) {
        await message.reply({
          embeds: [errorEmbed(`${error.message}\n${buildMissingArgsMessage(resolved, prefix)}`)],
        });
        return;
      }

      console.error(`Prefix command error ${prefix}${resolved}:`, error);
      await message.reply({
        embeds: [errorEmbed(`Command failed: ${error instanceof Error ? error.message : 'unknown error'}`)],
      });
    }
  },
};
