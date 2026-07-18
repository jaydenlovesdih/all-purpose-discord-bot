import { EmbedBuilder, Events } from 'discord.js';
import { config } from '../config.js';
import { runCommand } from '../handlers/commandRunner.js';
import { rememberSuggestion, suggestionComponents } from '../handlers/components.js';
import { BotClient } from '../types/index.js';
import { runAutoMod } from '../utils/automod.js';
import { getGuildConfig, mutateGuildConfig } from '../utils/guildConfig.js';
import { addMessageXp, canGainXp } from '../utils/levelsStore.js';
import { suggestCommands } from '../utils/fuzzy.js';
import { didYouMeanEmbed, usageEmbed } from '../utils/modResponse.js';
import { Colors } from '../utils/embeds.js';
import { buildUsageLine } from '../utils/usage.js';
import {
  isTextCommandChannel,
  parsePrefixMessage,
  PrefixCommandInteraction,
} from '../utils/prefixInteraction.js';
import { prefixSchemas } from '../utils/prefixSchemas.js';
import { getPrefix } from '../utils/setup.js';
import { ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { BUILTIN_ALIASES, resolveAlias } from '../utils/aliases.js';
import { enforceDnr } from '../utils/dnr.js';
import { isOwner } from '../utils/permissions.js';

export default {
  name: Events.MessageCreate,
  async execute(message: import('discord.js').Message, client: BotClient) {
    if (message.author.bot || !message.guild) return;

    if (await enforceDnr(message, client)) return;

    if (!isTextCommandChannel(message.channel)) return;

    const guildCfg = getGuildConfig(message.guild.id);

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

    // Server bot lock: non-owners get total silence (no replies, no "unknown command")
    if (guildCfg.botLocked && !isOwner(message.author.id)) return;

    const resolved = resolveAlias(parsed.command, guildCfg.aliases);

    const allNames = [
      ...client.commands.keys(),
      ...Object.keys(BUILTIN_ALIASES),
      ...Object.keys(guildCfg.aliases),
    ];
    const uniqueNames = [...new Set(allNames)];

    let command = client.commands.get(resolved);
    if (!command) {
      const suggestions = suggestCommands(parsed.command, uniqueNames)
        .map((name) => resolveAlias(name, guildCfg.aliases))
        .filter((name, index, arr) => client.commands.has(name) && arr.indexOf(name) === index)
        .slice(0, 5);

      if (!suggestions.length) {
        await message.reply({
          embeds: [
            new EmbedBuilder()
              .setColor(Colors.error)
              .setDescription(`Unknown command \`${prefix}${parsed.command}\`\nTry \`${prefix}help\``),
          ],
        });
        return;
      }

      const sent = await message.reply({
        embeds: [didYouMeanEmbed(client.user?.username ?? 'Bot')],
        components: suggestionComponents(suggestions),
      });
      rememberSuggestion(sent.id, message.author.id, parsed.args, prefix, message);
      return;
    }

    // Prefer the resolved command schema so aliases keep full subcommand support
    const schema = prefixSchemas[resolved] ?? prefixSchemas[parsed.command];
    if (schema === undefined) return;

    try {
      const interaction = new PrefixCommandInteraction(message, resolved, parsed.args);
      await runCommand(interaction, client);
    } catch (error) {
      if (error instanceof Error && error.message.startsWith('Missing required')) {
        const usage = buildUsageLine(resolved, prefix);
        await message.reply({
          embeds: [usageEmbed(resolved, usage, prefix)],
          components: [
            new ActionRowBuilder<ButtonBuilder>().addComponents(
              new ButtonBuilder()
                .setCustomId('suggest:no')
                .setLabel('Dismiss')
                .setStyle(ButtonStyle.Secondary),
            ),
          ],
        });
        return;
      }

      console.error(`Prefix command error ${prefix}${resolved}:`, error);
      const usage = buildUsageLine(resolved, prefix);
      await message.reply({
        embeds: [usageEmbed(resolved, usage, prefix)],
      });
    }
  },
};