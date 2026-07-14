import {
  Attachment,
  Guild,
  Message,
  TextChannel,
} from 'discord.js';

export interface PendingRoleReaction {
  ownerId: string;
  roleId: string;
  guildId: string;
  channelId: string;
  userIds: string[];
  imageCount: number;
}

export const pendingRoleReactions = new Map<string, PendingRoleReaction>();

function isImageAttachment(att: Attachment): boolean {
  if (att.contentType?.startsWith('image/')) return true;
  return /\.(png|jpe?g|gif|webp|bmp)$/i.test(att.url);
}

export function messageHasImage(msg: Message): boolean {
  if (msg.attachments.some(isImageAttachment)) return true;
  return msg.embeds.some((e) => !!e.image?.url || !!e.thumbnail?.url);
}

/** Collect unique non-bot users who reacted to any image message in the channel. */
export async function collectImageReactionUsers(
  channel: TextChannel,
): Promise<{ userIds: string[]; imageCount: number }> {
  const userIds = new Set<string>();
  let imageCount = 0;
  let before: string | undefined;

  for (;;) {
    const batch = await channel.messages.fetch({ limit: 100, before });
    if (!batch.size) break;

    for (const msg of batch.values()) {
      if (!messageHasImage(msg)) continue;
      imageCount++;

      if (!msg.reactions.cache.size) continue;

      for (const reaction of msg.reactions.cache.values()) {
        const users = await reaction.users.fetch().catch(() => null);
        if (!users) continue;
        for (const user of users.values()) {
          if (!user.bot) userIds.add(user.id);
        }
      }
    }

    before = batch.last()?.id;
    if (batch.size < 100) break;
  }

  return { userIds: [...userIds], imageCount };
}

export async function applyRoleReaction(
  guild: Guild,
  roleId: string,
  userIds: string[],
): Promise<{ success: number; failed: number; skipped: number }> {
  const role = guild.roles.cache.get(roleId);
  if (!role) return { success: 0, failed: userIds.length, skipped: 0 };

  let success = 0;
  let failed = 0;
  let skipped = 0;

  for (const userId of userIds) {
    const member = await guild.members.fetch(userId).catch(() => null);
    if (!member) {
      skipped++;
      continue;
    }
    if (member.roles.cache.has(roleId)) {
      skipped++;
      continue;
    }
    if (!member.manageable) {
      failed++;
      continue;
    }

    const ok = await member.roles.add(role, 'rolereaction').then(() => true).catch(() => false);
    if (ok) success++;
    else failed++;
  }

  return { success, failed, skipped };
}
