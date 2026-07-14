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
  | 'purge';

const TITLES: Record<ModActionType, { emoji: string; title: string; verb: string }> = {
  ban: { emoji: '🔨', title: 'User Banned', verb: 'has been permanently banned.' },
  softban: { emoji: '🔨', title: 'User Softbanned', verb: 'has been softbanned.' },
  hardban: { emoji: '🔨', title: 'User Hardbanned', verb: 'has been hardbanned.' },
  unhardban: { emoji: '🔓', title: 'Hardban Removed', verb: 'is no longer hardbanned.' },
  kick: { emoji: '👢', title: 'User Kicked', verb: 'has been kicked.' },
  mute: { emoji: '🔇', title: 'User Muted', verb: 'has been muted.' },
  timeout: { emoji: '⏱️', title: 'User Timed Out', verb: 'has been timed out.' },
  unmute: { emoji: '🔊', title: 'User Unmuted', verb: 'has been unmuted.' },
  unban: { emoji: '🔓', title: 'User Unbanned', verb: 'has been unbanned.' },
  jail: { emoji: '🔒', title: 'User Jailed', verb: 'has been jailed.' },
  unjail: { emoji: '🔓', title: 'User Unjailed', verb: 'has been released from jail.' },
  warn: { emoji: '⚠️', title: 'User Warned', verb: 'has been warned.' },
  clearwarnings: { emoji: '🧹', title: 'Warnings Cleared', verb: 'had their warnings cleared.' },
  strip: { emoji: '🧹', title: 'Roles Stripped', verb: 'had their roles stripped.' },
  roleadd: { emoji: '➕', title: 'Role Added', verb: 'received a role.' },
  roleremove: { emoji: '➖', title: 'Role Removed', verb: 'had a role removed.' },
  purge: { emoji: '🗑️', title: 'Messages Purged', verb: 'messages were deleted.' },
};

export interface ModEmbedOptions {
  action: ModActionType;
  target: User;
  moderator: User;
  reason: string;
  member?: GuildMember | null;
  extraLine?: string;
  method?: string;
  botName?: string;
  /** Replaces Boosting row when set (e.g. role name / purge count) */
  detail?: { name: string; value: string };
}

export function buildModEmbed(opts: ModEmbedOptions): EmbedBuilder {
  const meta = TITLES[opts.action];
  const method = opts.method ?? '🛡️ Staff Permission';
  const display = opts.target.username;

  const description = opts.extraLine
    ? `**${display}** ${meta.verb}\n${opts.extraLine}`
    : `**${display}** ${meta.verb}`;

  const detail = opts.detail ?? {
    name: '💎 Boosting:',
    value:
      opts.member == null
        ? '❎ N/A'
        : opts.member.premiumSince
          ? '✅ Yes'
          : '❎ No',
  };

  return new EmbedBuilder()
    .setColor(Colors.success)
    .setTitle(`${meta.emoji} ${meta.title}`)
    .setDescription(description)
    .setThumbnail(opts.target.displayAvatarURL({ size: 256 }))
    .addFields(
      { name: '🛡️ Moderator:', value: `${opts.moderator}`, inline: false },
      { name: '📝 Reason:', value: opts.reason || 'No reason provided', inline: false },
      { name: detail.name, value: detail.value, inline: false },
      { name: '⚙️ Method:', value: method, inline: false },
    )
    .setFooter({
      text: `User ID: ${opts.target.id} | ${opts.botName ?? 'Bot'}`,
    })
    .setTimestamp();
}

/** Purge embed — same field layout as other mod cases */
export function buildPurgeEmbed(opts: {
  moderator: User;
  amount: number;
  channelMention: string;
  botName?: string;
  target?: User;
}): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setColor(Colors.success)
    .setTitle('🗑️ Messages Purged')
    .setDescription(
      opts.target
        ? `Deleted **${opts.amount}** message(s) from **${opts.target.username}**.`
        : `**${opts.amount}** message(s) have been deleted.`,
    )
    .addFields(
      { name: '🛡️ Moderator:', value: `${opts.moderator}`, inline: false },
      {
        name: '📝 Reason:',
        value: opts.target ? `User purge (${opts.target})` : 'Bulk delete',
        inline: false,
      },
      { name: '#️⃣ Channel:', value: opts.channelMention, inline: false },
      { name: '⚙️ Method:', value: '🛡️ Staff Permission', inline: false },
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
): ActionRowBuilder<ButtonBuilder> | null {
  if (action === 'purge') return null;

  const row = new ActionRowBuilder<ButtonBuilder>();

  if (action === 'ban' || action === 'softban' || action === 'hardban') {
    row.addComponents(
      new ButtonBuilder()
        .setCustomId(`mod:unban:${userId}`)
        .setLabel('Unban')
        .setEmoji('🔓')
        .setStyle(ButtonStyle.Success),
    );
  }

  if (action === 'mute' || action === 'timeout') {
    row.addComponents(
      new ButtonBuilder()
        .setCustomId(`mod:unmute:${userId}`)
        .setLabel('Unmute')
        .setEmoji('🔊')
        .setStyle(ButtonStyle.Success),
    );
  }

  if (action === 'jail') {
    row.addComponents(
      new ButtonBuilder()
        .setCustomId(`mod:unjail:${userId}`)
        .setLabel('Unjail')
        .setEmoji('🔓')
        .setStyle(ButtonStyle.Success),
    );
  }

  if (action === 'warn') {
    row.addComponents(
      new ButtonBuilder()
        .setCustomId(`mod:clearwarns:${userId}`)
        .setLabel('Clear Warnings')
        .setEmoji('🧹')
        .setStyle(ButtonStyle.Danger),
    );
  }

  if (action === 'unban') {
    row.addComponents(
      new ButtonBuilder()
        .setCustomId(`mod:ban:${userId}`)
        .setLabel('Ban')
        .setEmoji('🔨')
        .setStyle(ButtonStyle.Danger),
    );
  }

  row.addComponents(
    new ButtonBuilder()
      .setCustomId(`mod:edit:${action}:${userId}`)
      .setLabel('Edit Reason')
      .setEmoji('📝')
      .setStyle(ButtonStyle.Primary),
  );

  return row.components.length ? row : null;
}

export function usageEmbed(command: string, usage: string, prefix: string): EmbedBuilder {
  const syntax = usage || buildUsageLine(command, prefix);
  const example = buildUsageExample(command, prefix);

  return new EmbedBuilder()
    .setColor(Colors.error)
    .setTitle(`❓ How to use \`${prefix}${command}\``)
    .setDescription(
      `That command was used incorrectly.\n\n**Usage**\n\`${syntax}\`\n\n**Example**\n\`${example}\``,
    );
}

export function didYouMeanEmbed(botName: string): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(Colors.error)
    .setDescription('**Did you mean one of these?**')
    .setFooter({ text: botName });
}
