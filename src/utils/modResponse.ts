import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  GuildMember,
  User,
} from 'discord.js';
import { Colors } from './embeds.js';
import { buildUsageExample, buildUsageLine } from './usage.js';
import { blackBolt, bolt, buttonEmoji } from './emojis.js';

/** @deprecated prefer Colors.success / Colors.error */
export const MOD_ACCENT = Colors.success;

export type ModActionType =
  | 'ban'
  | 'softban'
  | 'hardban'
  | 'unhardban'
  | 'kick'
  | 'mute'
  | 'timeout'
  | 'unmute'
  | 'unban'
  | 'jail'
  | 'unjail'
  | 'warn'
  | 'clearwarnings'
  | 'strip'
  | 'roleadd'
  | 'roleremove'
  | 'purge'
  | 'dnr'
  | 'undnr';

function titles(): Record<ModActionType, { emoji: string; title: string; verb: string }> {
  return {
    ban: { emoji: bolt(), title: 'User Banned', verb: 'has been permanently banned.' },
    softban: { emoji: bolt(), title: 'User Softbanned', verb: 'has been softbanned.' },
    hardban: { emoji: blackBolt(), title: 'User Hardbanned', verb: 'has been hardbanned.' },
    unhardban: { emoji: bolt(), title: 'Hardban Removed', verb: 'is no longer hardbanned.' },
    kick: { emoji: bolt(), title: 'User Kicked', verb: 'has been kicked.' },
    mute: { emoji: blackBolt(), title: 'User Muted', verb: 'has been muted.' },
    timeout: { emoji: blackBolt(), title: 'User Timed Out', verb: 'has been timed out.' },
    unmute: { emoji: bolt(), title: 'User Unmuted', verb: 'has been unmuted.' },
    unban: { emoji: bolt(), title: 'User Unbanned', verb: 'has been unbanned.' },
    jail: { emoji: blackBolt(), title: 'User Jailed', verb: 'has been jailed.' },
    unjail: { emoji: bolt(), title: 'User Unjailed', verb: 'has been released from jail.' },
    warn: { emoji: bolt(), title: 'User Warned', verb: 'has been warned.' },
    clearwarnings: { emoji: bolt(), title: 'Warnings Cleared', verb: 'had their warnings cleared.' },
    strip: { emoji: blackBolt(), title: 'Roles Stripped', verb: 'had their roles stripped.' },
    roleadd: { emoji: bolt(), title: 'Role Added', verb: 'received a role.' },
    roleremove: { emoji: blackBolt(), title: 'Role Removed', verb: 'had a role removed.' },
    purge: { emoji: blackBolt(), title: 'Messages Purged', verb: 'messages were deleted.' },
    dnr: { emoji: blackBolt(), title: 'Do Not Reply', verb: 'must not reply to your messages.' },
    undnr: { emoji: bolt(), title: 'DNR Removed', verb: 'may reply to you again.' },
  };
}

export interface ModEmbedOptions {
  action: ModActionType;
  target: User;
  moderator: User;
  reason: string;
  member?: GuildMember | null;
  extraLine?: string;
  method?: string;
  botName?: string;
  /** Optional third field (e.g. role name / duration) */
  detail?: { name: string; value: string };
}

export function buildModEmbed(opts: ModEmbedOptions): EmbedBuilder {
  const meta = titles()[opts.action];
  const display = opts.target.username;

  const description = opts.extraLine
    ? `**${display}** ${meta.verb}\n${opts.extraLine}`
    : `**${display}** ${meta.verb}`;

  const fields = [
    { name: '🛡️ Moderator:', value: `${opts.moderator}`, inline: true },
    { name: '📝 Reason:', value: opts.reason || 'No reason provided', inline: true },
  ];

  if (opts.detail) {
    fields.push({ name: opts.detail.name, value: opts.detail.value, inline: true });
  }

  return new EmbedBuilder()
    .setColor(Colors.success)
    .setTitle(`${meta.emoji} ${meta.title}`)
    .setDescription(description)
    .setThumbnail(opts.target.displayAvatarURL({ size: 256 }))
    .addFields(fields)
    .setFooter({
      text: `User ID: ${opts.target.id} | ${opts.botName ?? 'Bot'}`,
    })
    .setTimestamp();
}

/** Purge embed — Reason + Channel side by side */
export function buildPurgeEmbed(opts: {
  moderator: User;
  amount: number;
  channelMention: string;
  botName?: string;
  target?: User;
}): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setColor(Colors.success)
    .setTitle(`${blackBolt()} Messages Purged`)
    .setDescription(
      opts.target
        ? `Deleted **${opts.amount}** message(s) from **${opts.target.username}**.`
        : `**${opts.amount}** message(s) have been deleted.`,
    )
    .addFields(
      { name: '🛡️ Moderator:', value: `${opts.moderator}`, inline: true },
      {
        name: '📝 Reason:',
        value: opts.target ? `User purge (${opts.target})` : 'Bulk delete',
        inline: true,
      },
      { name: '#️⃣ Channel:', value: opts.channelMention, inline: true },
    )
    .setFooter({ text: opts.botName ?? 'Bot' })
    .setTimestamp();

  if (opts.target) {
    embed.setThumbnail(opts.target.displayAvatarURL({ size: 256 }));
  }

  return embed;
}

export function buildModButtons(
  action: ModActionType,
  userId: string,
  opts?: { protectorId?: string },
): ActionRowBuilder<ButtonBuilder> | null {
  if (action === 'purge') return null;

  const row = new ActionRowBuilder<ButtonBuilder>();

  if (action === 'ban' || action === 'softban' || action === 'hardban') {
    row.addComponents(
      new ButtonBuilder()
        .setCustomId(`mod:unban:${userId}`)
        .setLabel('Unban')
        .setEmoji(buttonEmoji('animatedbolt'))
        .setStyle(ButtonStyle.Success),
    );
  }

  if (action === 'mute' || action === 'timeout') {
    row.addComponents(
      new ButtonBuilder()
        .setCustomId(`mod:unmute:${userId}`)
        .setLabel('Unmute')
        .setEmoji(buttonEmoji('animatedbolt'))
        .setStyle(ButtonStyle.Success),
    );
  }

  if (action === 'jail') {
    row.addComponents(
      new ButtonBuilder()
        .setCustomId(`mod:unjail:${userId}`)
        .setLabel('Unjail')
        .setEmoji(buttonEmoji('animatedbolt'))
        .setStyle(ButtonStyle.Success),
    );
  }

  if (action === 'warn') {
    row.addComponents(
      new ButtonBuilder()
        .setCustomId(`mod:clearwarns:${userId}`)
        .setLabel('Clear Warnings')
        .setEmoji(buttonEmoji('blackbolt'))
        .setStyle(ButtonStyle.Danger),
    );
  }

  if (action === 'unban') {
    row.addComponents(
      new ButtonBuilder()
        .setCustomId(`mod:ban:${userId}`)
        .setLabel('Ban')
        .setEmoji(buttonEmoji('blackbolt'))
        .setStyle(ButtonStyle.Danger),
    );
  }

  if (action === 'dnr' && opts?.protectorId) {
    row.addComponents(
      new ButtonBuilder()
        .setCustomId(`mod:undnr:${opts.protectorId}:${userId}`)
        .setLabel('Undnr')
        .setEmoji(buttonEmoji('animatedbolt'))
        .setStyle(ButtonStyle.Success),
    );
  }

  if (action === 'undnr' && opts?.protectorId) {
    row.addComponents(
      new ButtonBuilder()
        .setCustomId(`mod:dnr:${opts.protectorId}:${userId}`)
        .setLabel('DNR')
        .setEmoji(buttonEmoji('blackbolt'))
        .setStyle(ButtonStyle.Danger),
    );
  }

  const editId =
    (action === 'dnr' || action === 'undnr') && opts?.protectorId
      ? `mod:edit:${action}:${opts.protectorId}:${userId}`
      : `mod:edit:${action}:${userId}`;

  row.addComponents(
    new ButtonBuilder()
      .setCustomId(editId)
      .setLabel('Edit Reason')
      .setEmoji(buttonEmoji('animatedbolt'))
      .setStyle(ButtonStyle.Primary),
  );

  return row.components.length ? row : null;
}

export function usageEmbed(command: string, usage: string, prefix: string): EmbedBuilder {
  const syntax = usage || buildUsageLine(command, prefix);
  const example = buildUsageExample(command, prefix);

  return new EmbedBuilder()
    .setColor(Colors.error)
    .setTitle(`${blackBolt()} How to use \`${prefix}${command}\``)
    .setDescription(
      `That command was used incorrectly.\n\n**Usage**\n\`${syntax}\`\n\n**Example**\n\`${example}\``,
    );
}

export function didYouMeanEmbed(botName: string): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(Colors.error)
    .setDescription(`**${blackBolt()} Did you mean one of these?**`)
    .setFooter({ text: botName });
}
