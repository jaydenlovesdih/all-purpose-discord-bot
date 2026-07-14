import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  Guild,
} from 'discord.js';
import { Colors } from './embeds.js';

export const ROLES_PER_PAGE = 10;

export function getSortedRoles(guild: Guild) {
  return [...guild.roles.cache.values()].sort((a, b) => b.position - a.position);
}

export function buildRolesEmbed(
  guild: Guild,
  page: number,
): { embed: EmbedBuilder; page: number; totalPages: number } {
  const roles = getSortedRoles(guild);
  const totalPages = Math.max(1, Math.ceil(roles.length / ROLES_PER_PAGE));
  const safePage = Math.min(Math.max(0, page), totalPages - 1);
  const slice = roles.slice(safePage * ROLES_PER_PAGE, safePage * ROLES_PER_PAGE + ROLES_PER_PAGE);

  const list = slice.length
    ? slice
        .map((role, i) => {
          const n = safePage * ROLES_PER_PAGE + i + 1;
          const members = role.members.size;
          const color = role.hexColor === '#000000' ? 'default' : role.hexColor;
          return `**${n}.** ${role} — \`${role.id}\`\n┗ ${members} member${members === 1 ? '' : 's'} · ${color}`;
        })
        .join('\n')
    : '_No roles._';

  const embed = new EmbedBuilder()
    .setColor(Colors.success)
    .setTitle(`🎭 Roles — ${guild.name}`)
    .setDescription(list)
    .setThumbnail(guild.iconURL({ size: 256 }) ?? null)
    .setFooter({
      text: `Page ${safePage + 1} of ${totalPages} • Total: ${roles.length} roles`,
    })
    .setTimestamp();

  return { embed, page: safePage, totalPages };
}

export function buildRolesButtons(
  page: number,
  totalPages: number,
  ownerId: string,
): ActionRowBuilder<ButtonBuilder>[] {
  return [
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(`roles:page:prev:${page}:${ownerId}`)
        .setLabel('Prev')
        .setEmoji('⬅️')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(page <= 0),
      new ButtonBuilder()
        .setCustomId(`roles:page:next:${page}:${ownerId}`)
        .setLabel('Next')
        .setEmoji('➡️')
        .setStyle(ButtonStyle.Success)
        .setDisabled(page >= totalPages - 1),
    ),
  ];
}
