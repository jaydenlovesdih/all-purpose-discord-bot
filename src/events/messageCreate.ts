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

export default {
  name: Events.MessageCreate,
  async execute(message: import('discord.js').Message, client: BotClient) {
    if (message.author.bot || !message.guild) return;
    if (!isTextCommandChannel(message.channel)) return;

    // Mention bot → show prefix
    if (message.mentions.has(client.user!) && !message.mentions.everyone) {
      const onlyMention =
        message.content.replace(new RegExp(`<@!?${client.user!.id}>`, 'g'), '').trim().length === 0;
      if (onlyMention) {
        const prefix = getPrefix(message.guild.id, config.prefix);
        await message.reply(`My prefix here is \`${prefix}\` — try \`${prefix}help\`.`);
        return;
      }
    }

    // AFK clear / mention
    const afkCfg = getGuildConfig(message.guild.id).afk;
    if (afkCfg[message.author.id]) {
      mutateGuildConfig(message.guild.id, (c) => {
        delete c.afk[message.author.id];
      });
      await message.reply({ content: `Welcome back, ${message.author} — AFK removed.` }).then((m) => {
        setTimeout(() => m.delete().catch(() => undefined), 5000);
      });
    }

    for (const user of message.mentions.users.values()) {
      const entry = afkCfg[user.id];
      if (entry) {
        await message.reply({
          content: `**${user.tag}** is AFK: ${entry.reason} (<t:${Math.floor(entry.since / 1000)}:R>)`,
        });
        break;
      }
    }

    // AutoMod
    if (await runAutoMod(message)) return;

    // Levels XP
    const levels = getGuildConfig(message.guild.id).levels;
    if (levels.enabled && canGainXp(message.guild.id, message.author.id)) {
      const result = addMessageXp(message.guild.id, message.author.id);
      if (result.leveled) {
        const reward = levels.rewards.find((r) => r.level === result.level);
        if (reward && message.member) {
          await message.member.roles.add(reward.roleId).catch(() => undefined);
        }
        const text = levels.message
          .replaceAll('{user}', message.author.toString())
          .replaceAll('{user.mention}', message.author.toString())
          .replaceAll('{user.name}', message.author.username)
          .replaceAll('{level}', String(result.level))
          .replaceAll('{guild.name}', message.guild.name);
        const channel = levels.channelId
          ? message.guild.channels.cache.get(levels.channelId)
          : message.channel;
        if (channel?.isTextBased() && channel.isSendable()) {
          await channel.send(text).catch(() => undefined);
        }
      }
    }

    const prefix = getPrefix(message.guild.id, config.prefix);
    const parsed = parsePrefixMessage(message.content, prefix);
    if (!parsed) return;

    const command = client.commands.get(parsed.command);
    if (!command) return;

    const schema = prefixSchemas[parsed.command];
    if (schema === undefined) return;

    try {
      const interaction = new PrefixCommandInteraction(message, parsed.command, parsed.args);
      await runCommand(interaction, client);
    } catch (error) {
      if (error instanceof Error && error.message.startsWith('Missing required')) {
        await message.reply({
          embeds: [errorEmbed(`${error.message}\n${buildMissingArgsMessage(parsed.command, prefix)}`)],
        });
        return;
      }

      console.error(`Prefix command error ${prefix}${parsed.command}:`, error);
      await message.reply({
        embeds: [errorEmbed('An unexpected error occurred while running this command.')],
      });
    }
  },
};
