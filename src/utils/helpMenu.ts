import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
} from 'discord.js';
import { BotClient } from '../types/index.js';
import { MOD_ACCENT } from './modResponse.js';

export const HELP_CATEGORIES = [
  { id: 'mod', label: 'Moderation' },
  { id: 'fun', label: 'Fun' },
  { id: 'admin', label: 'Admin' },
  { id: 'info', label: 'Info' },
  { id: 'systems', label: 'Systems' },
  { id: 'rest', label: 'The Rest' },
] as const;

export type HelpCategoryId = (typeof HELP_CATEGORIES)[number]['id'];

const PER_PAGE = 10;

const MOD_CMDS = new Set([
  'ban',
  'kick',
  'mute',
  'timeout',
  'unmute',
  'purge',
  'warn',
  'warnings',
  'clearwarnings',
  'role',
  'setup',
  'jail',
  'unjail',
  'softban',
  'hardban',
  'unban',
  'strip',
  'filter',
  'antiraid',
  'antinuke',
]);

const FUN_CMDS = new Set(['8ball', 'coinflip']);

const ADMIN_CMDS = new Set([
  'eval',
  'say',
  'embed',
  'invoke',
  'prefix',
  'fakepermissions',
  'alias',
  'autoresponder',
  'logging',
]);

const INFO_CMDS = new Set(['help', 'ping', 'botinfo', 'avatar', 'userinfo', 'serverinfo']);

const SYSTEMS_CMDS = new Set([
  'welcome',
  'levels',
  'starboard',
  'giveaway',
  'afk',
  'snipe',
  'editsnipe',
  'clearsnipe',
  'poll',
]);

export function categorizeCommand(name: string): HelpCategoryId {
  if (MOD_CMDS.has(name)) return 'mod';
  if (FUN_CMDS.has(name)) return 'fun';
  if (ADMIN_CMDS.has(name)) return 'admin';
  if (INFO_CMDS.has(name)) return 'info';
  if (SYSTEMS_CMDS.has(name)) return 'systems';
  return 'rest';
}

export function categoryLabel(id: HelpCategoryId): string {
  return HELP_CATEGORIES.find((c) => c.id === id)?.label ?? id;
}

function commandsForCategory(client: BotClient, category: HelpCategoryId) {
  return [...client.commands.values()]
    .filter((cmd) => categorizeCommand(cmd.data.name) === category)
    .sort((a, b) => a.data.name.localeCompare(b.data.name));
}

export function buildHelpEmbed(
  client: BotClient,
  prefix: string,
  category: HelpCategoryId,
  page: number,
): { embed: EmbedBuilder; page: number; totalPages: number; total: number } {
  const cmds = commandsForCategory(client, category);
  const totalPages = Math.max(1, Math.ceil(cmds.length / PER_PAGE));
  const safePage = Math.min(Math.max(0, page), totalPages - 1);
  const slice = cmds.slice(safePage * PER_PAGE, safePage * PER_PAGE + PER_PAGE);

  const list = slice.length
    ? slice.map((cmd) => `\`${cmd.data.name}\` -> ${cmd.data.description}`).join('\n')
    : '_No commands in this category._';

  const embed = new EmbedBuilder()
    .setColor(MOD_ACCENT)
    .setTitle(`📚 Help: ${categoryLabel(category)}`)
    .setDescription(
      `Use \`${prefix}[command]\` to interact with the bot.\n\n**Commands:**\n${list}`,
    )
    .setFooter({
      text: `Page ${safePage + 1} of ${totalPages} • Total: ${cmds.length} commands`,
    });

  return { embed, page: safePage, totalPages, total: cmds.length };
}

export function buildHelpButtons(
  category: HelpCategoryId,
  page: number,
  totalPages: number,
  ownerId: string,
): ActionRowBuilder<ButtonBuilder>[] {
  const cats = HELP_CATEGORIES;
  const row1 = new ActionRowBuilder<ButtonBuilder>().addComponents(
    ...cats.slice(0, 5).map((c) =>
      new ButtonBuilder()
        .setCustomId(`help:cat:${c.id}:${ownerId}`)
        .setLabel(c.label)
        .setStyle(c.id === category ? ButtonStyle.Primary : ButtonStyle.Secondary),
    ),
  );

  const row2 = new ActionRowBuilder<ButtonBuilder>().addComponents(
    ...cats.slice(5).map((c) =>
      new ButtonBuilder()
        .setCustomId(`help:cat:${c.id}:${ownerId}`)
        .setLabel(c.label)
        .setStyle(c.id === category ? ButtonStyle.Primary : ButtonStyle.Secondary),
    ),
  );

  const rowNav = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`help:page:prev:${category}:${page}:${ownerId}`)
      .setLabel('Prev')
      .setEmoji('⬅️')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(page <= 0),
    new ButtonBuilder()
      .setCustomId(`help:page:next:${category}:${page}:${ownerId}`)
      .setLabel('Next')
      .setEmoji('➡️')
      .setStyle(ButtonStyle.Success)
      .setDisabled(page >= totalPages - 1),
  );

  return row2.components.length ? [row1, row2, rowNav] : [row1, rowNav];
}
