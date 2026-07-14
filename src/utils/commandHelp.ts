import {
  ActionRowBuilder,
  ApplicationCommandOptionType,
  EmbedBuilder,
  StringSelectMenuBuilder,
} from 'discord.js';
import { BotClient, Command } from '../types/index.js';
import { Colors } from './embeds.js';
import { resolveAlias } from './aliases.js';
import { buildUsageExample, buildUsageLine } from './usage.js';
import { prefixSchemas } from './prefixSchemas.js';

export interface HelpSubcommand {
  name: string;
  label: string;
}

/** Extra descriptions for subcommands (auto-lists still come from slash choices) */
const SUB_DETAILS: Record<string, Record<string, string>> = {
  antinuke: {
    toggle: 'Enable or disable AntiNuke (`on` / `off`). When enabled, all modules turn on.',
    ban: 'Configure mass-ban protection. Optional: `on`/`off`, punishment, threshold.',
    kick: 'Configure mass-kick protection.',
    role: 'Configure mass role create/delete protection.',
    channel: 'Configure mass channel create/delete protection.',
    webhook: 'Configure webhook spam protection.',
    emoji: 'Configure emoji steal/spam protection.',
    botadd: 'Configure unauthorized bot-add protection.',
    guild: 'Configure dangerous guild update protection.',
    whitelist: 'Add/remove a user from the AntiNuke whitelist. Usage: `whitelist @user`',
    admin: 'Add/remove an AntiNuke admin (owner only). Usage: `admin @user`',
    config: 'Show the current AntiNuke configuration.',
    list: 'List whitelist / related AntiNuke entries.',
  },
  filter: {
    setup: 'Enable AutoMod with common defaults (invites, spam, mass-mention).',
    add: 'Add a filtered word. Usage: `add <word>`',
    remove: 'Remove a filtered word. Usage: `remove <word>`',
    list: 'List filtered words.',
    clear: 'Clear all filtered words.',
    invites: 'Toggle Discord invite filtering (`on` / `off`).',
    links: 'Toggle link filtering.',
    spam: 'Toggle spam filtering (optional threshold).',
    caps: 'Toggle caps filtering (optional threshold).',
    massmention: 'Toggle mass-mention filtering (optional threshold).',
    emojis: 'Toggle emoji spam filtering.',
    punishment: 'Set punishment: `timeout`, `kick`, `ban`, `jail`, `delete`.',
    timeout: 'Set AutoMod timeout duration (e.g. `60s`, `5m`).',
    view: 'View current filter settings.',
  },
  antiraid: {
    toggle: 'Enable or disable AntiRaid.',
    massjoin: 'Mass-join protection / threshold (joins per 60s).',
    newaccounts: 'Block accounts newer than N days.',
    avatar: 'Toggle default-avatar join blocking.',
    punishment: 'Set raid punishment: `ban`, `kick`, `timeout`, `jail`.',
    lockdown: 'Enable/disable lockdown mode.',
    setlogchannel: 'Set the AntiRaid log channel.',
    view: 'View AntiRaid settings.',
  },
  welcome: {
    enable: 'Enable channel welcome messages.',
    disable: 'Disable channel welcome messages.',
    channel: 'Set the welcome channel.',
    message: 'Set the channel welcome message template.',
    dm: 'Toggle DM welcome messages.',
    dmmessage: 'Set the DM welcome message (enables DMs).',
    dmtest: 'Send yourself a test welcome DM.',
    leave: 'Toggle leave messages.',
    leavechannel: 'Set the leave channel.',
    leavemessage: 'Set the leave message template.',
    autorole: 'Toggle an autorole on join.',
    view: 'View welcome / leave / DM settings.',
  },
  levels: {
    toggle: 'Enable or disable the level system.',
    channel: 'Set the level-up announcement channel.',
    message: 'Set the level-up message template.',
    reward: 'Add/update a level reward role.',
    rewards: 'List level rewards.',
    view: 'View level settings.',
    leaderboard: 'Show the XP leaderboard.',
    rank: 'Show a member’s rank.',
  },
  logging: {
    enable: 'Enable event logging.',
    disable: 'Disable event logging.',
    channel: 'Set a fallback logging channel.',
    view: 'View logging status and dedicated log channels.',
  },
  alias: {
    add: 'Create an alias. Usage: `add <alias> <command>`',
    remove: 'Remove an alias. Usage: `remove <alias>`',
    list: 'List custom aliases.',
  },
};

/** Pull subcommand choices from the slash command definition (stays up to date automatically) */
export function extractSubcommands(command: Command): HelpSubcommand[] {
  const json = command.data.toJSON() as {
    options?: Array<{
      name: string;
      type: number;
      choices?: Array<{ name: string; value: string }>;
    }>;
  };

  const option = json.options?.find(
    (opt) =>
      opt.type === ApplicationCommandOptionType.String &&
      Array.isArray(opt.choices) &&
      opt.choices.length > 0 &&
      (opt.name === 'subcommand' || opt.name === 'action'),
  );

  if (!option?.choices?.length) return [];

  return option.choices.map((c) => ({
    name: c.value,
    label: c.name,
  }));
}

export function buildCommandHelpEmbed(
  command: Command,
  prefix: string,
  opts?: { sub?: string; botName?: string },
): EmbedBuilder {
  const name = command.data.name;
  const subs = extractSubcommands(command);
  const usage = buildUsageLine(name, prefix);
  const example = buildUsageExample(name, prefix);
  const schema = prefixSchemas[name] ?? [];

  const argLines = schema.length
    ? schema
        .map((arg) => {
          const req = arg.required ? 'required' : 'optional';
          return `• \`${arg.name}\` (${arg.type}, ${req})`;
        })
        .join('\n')
    : '• _No arguments_';

  let description =
    `${command.data.description}\n\n` +
    `**Usage**\n\`${usage}\`\n\n` +
    `**Example**\n\`${example}\`\n\n` +
    `**Arguments**\n${argLines}`;

  if (subs.length) {
    description += `\n\n**Subcommands** (${subs.length})\n`;
    description += subs.map((s) => `• \`${s.name}\``).join('\n');
    description += `\n\nUse the dropdown below for details on each subcommand.`;
  }

  if (opts?.sub) {
    const detail =
      SUB_DETAILS[name]?.[opts.sub] ??
      `Run \`${prefix}${name} ${opts.sub}\` with any optional values this subcommand accepts.`;
    const subExample = `${prefix}${name} ${opts.sub}`;
    description =
      `**Subcommand:** \`${opts.sub}\`\n\n${detail}\n\n` +
      `**Try**\n\`${subExample}\`\n\n` +
      `**Parent command**\n\`${usage}\`\n**Example:** \`${example}\``;
  }

  return new EmbedBuilder()
    .setColor(Colors.success)
    .setTitle(opts?.sub ? `❓ Help: ${prefix}${name} ${opts.sub}` : `❓ Help: ${prefix}${name}`)
    .setDescription(description.slice(0, 4000))
    .setFooter({ text: opts?.botName ?? 'Blaze' })
    .setTimestamp();
}

export function buildCommandHelpSelect(
  commandName: string,
  subs: HelpSubcommand[],
  ownerId: string,
): ActionRowBuilder<StringSelectMenuBuilder> | null {
  if (!subs.length) return null;

  return new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId(`help:sub:${commandName}:${ownerId}`)
      .setPlaceholder('Pick a subcommand for more help...')
      .addOptions(
        subs.slice(0, 25).map((s) => ({
          label: s.label.slice(0, 100),
          value: s.name.slice(0, 100),
          description: `Help for ${commandName} ${s.name}`.slice(0, 100),
        })),
      ),
  );
}

export function resolveHelpTarget(
  query: string,
  client: BotClient,
  guildAliases: Record<string, string> = {},
): Command | null {
  const resolved = resolveAlias(query.trim().split(/\s+/)[0]!.toLowerCase(), guildAliases);
  return client.commands.get(resolved) ?? null;
}
