import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  GuildMember,
  User,
} from 'discord.js';

export const MOD_ACCENT = 0xf0b232;

export type ModActionType =
  | 'ban'
  | 'softban'
  | 'hardban'
  | 'kick'
  | 'mute'
  | 'timeout'
  | 'unmute'
  | 'unban'
  | 'jail'
  | 'unjail'
  | 'warn'
  | 'strip';

const TITLES: Record<ModActionType, { emoji: string; title: string; verb: string }> = {
  ban: { emoji: '🔨', title: 'User Banned', verb: 'has been permanently banned.' },
  softban: { emoji: '🔨', title: 'User Softbanned', verb: 'has been softbanned.' },
  hardban: { emoji: '🔨', title: 'User Hardbanned', verb: 'has been hardbanned.' },
  kick: { emoji: '👢', title: 'User Kicked', verb: 'has been kicked.' },
  mute: { emoji: '🔇', title: 'User Muted', verb: 'has been muted.' },
  timeout: { emoji: '⏱️', title: 'User Timed Out', verb: 'has been timed out.' },
  unmute: { emoji: '🔊', title: 'User Unmuted', verb: 'has been unmuted.' },
  unban: { emoji: '🔓', title: 'User Unbanned', verb: 'has been unbanned.' },
  jail: { emoji: '🔒', title: 'User Jailed', verb: 'has been jailed.' },
  unjail: { emoji: '🔓', title: 'User Unjailed', verb: 'has been released from jail.' },
  warn: { emoji: '⚠️', title: 'User Warned', verb: 'has been warned.' },
  strip: { emoji: '🧹', title: 'Roles Stripped', verb: 'had their roles stripped.' },
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
}

export function buildModEmbed(opts: ModEmbedOptions): EmbedBuilder {
  const meta = TITLES[opts.action];
  const boosting = opts.member?.premiumSince ? '✅ Yes' : '❎ No';
  const method = opts.method ?? '🛡️ Staff Permission';
  const display = opts.target.username;

  const description = opts.extraLine
    ? `**${display}** ${meta.verb}\n${opts.extraLine}`
    : `**${display}** ${meta.verb}`;

  return new EmbedBuilder()
    .setColor(MOD_ACCENT)
    .setTitle(`${meta.emoji} ${meta.title}`)
    .setDescription(description)
    .setThumbnail(opts.target.displayAvatarURL({ size: 256 }))
    .addFields(
      { name: '🛡️ Moderator:', value: `${opts.moderator}`, inline: false },
      { name: '📝 Reason:', value: opts.reason || 'No reason provided', inline: false },
      { name: '💎 Boosting:', value: boosting, inline: false },
      { name: '⚙️ Method:', value: method, inline: false },
    )
    .setFooter({
      text: `User ID: ${opts.target.id} | ${opts.botName ?? 'Bot'}`,
    })
    .setTimestamp();
}

export function buildModButtons(action: ModActionType, userId: string): ActionRowBuilder<ButtonBuilder> | null {
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

  if (action === 'kick' || action === 'warn' || action === 'strip') {
    // No reverse action that maps cleanly — still allow edit reason
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
  return new EmbedBuilder()
    .setColor(MOD_ACCENT)
    .setTitle(`❓ How to use \`${prefix}${command}\``)
    .setDescription(
      `That command was used incorrectly.\n\n**Usage**\n\`${usage}\`\n\n**Example**\n\`${prefix}${command}\` with the required arguments.`,
    );
}

export function didYouMeanEmbed(botName: string): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(MOD_ACCENT)
    .setDescription('**Did you mean one of these?**')
    .setFooter({ text: botName });
}
