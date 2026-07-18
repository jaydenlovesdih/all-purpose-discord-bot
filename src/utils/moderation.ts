import { EmbedBuilder, Guild, GuildMember, TextChannel, User } from 'discord.js';
import { getGuildConfig, mutateGuildConfig } from './guildConfig.js';
import { Colors, ok } from './embeds.js';
import {
  buildServerLogEmbed,
  logChannelForAction,
  sendToLogChannel,
} from './log.js';
import { blackBolt, bolt } from './emojis.js';

export interface ModActionContext {
  guild: Guild;
  action: string;
  user: User;
  moderator: User;
  reason?: string;
  extra?: Record<string, string | number>;
}

function applyVars(template: string, ctx: ModActionContext): string {
  const vars: Record<string, string> = {
    '{user}': ctx.user.toString(),
    '{user.mention}': ctx.user.toString(),
    '{user.name}': ctx.user.username,
    '{user.id}': ctx.user.id,
    '{user.tag}': ctx.user.tag,
    '{moderator}': ctx.moderator.toString(),
    '{moderator.mention}': ctx.moderator.toString(),
    '{moderator.name}': ctx.moderator.username,
    '{moderator.id}': ctx.moderator.id,
    '{reason}': ctx.reason ?? 'No reason provided',
    '{guild.name}': ctx.guild.name,
    '{guild.id}': ctx.guild.id,
    '{action}': ctx.action,
  };

  if (ctx.extra) {
    for (const [key, value] of Object.entries(ctx.extra)) {
      vars[`{${key}}`] = String(value);
    }
  }

  let out = template;
  for (const [key, value] of Object.entries(vars)) {
    out = out.split(key).join(value);
  }
  return out;
}

function nextCaseId(guildId: string): number {
  let id = 1;
  mutateGuildConfig(guildId, (c) => {
    const current = (c as { caseId?: number }).caseId ?? 0;
    id = current + 1;
    (c as { caseId?: number }).caseId = id;
  });
  return id;
}

function actionMeta(action: string): { emoji: string; title: string; verb: string } {
  const map: Record<string, { emoji: string; title: string; verb: string }> = {
    ban: { emoji: blackBolt(), title: 'User Banned', verb: 'has been permanently banned.' },
    softban: { emoji: blackBolt(), title: 'User Softbanned', verb: 'has been softbanned.' },
    hardban: { emoji: blackBolt(), title: 'User Hardbanned', verb: 'has been hardbanned.' },
    unhardban: { emoji: bolt(), title: 'Hardban Removed', verb: 'is no longer hardbanned.' },
    unban: { emoji: bolt(), title: 'User Unbanned', verb: 'has been unbanned.' },
    kick: { emoji: blackBolt(), title: 'User Kicked', verb: 'has been kicked.' },
    mute: { emoji: blackBolt(), title: 'User Muted', verb: 'has been muted.' },
    timeout: { emoji: blackBolt(), title: 'User Timed Out', verb: 'has been timed out.' },
    unmute: { emoji: bolt(), title: 'User Unmuted', verb: 'has been unmuted.' },
    untimeout: { emoji: bolt(), title: 'User Unmuted', verb: 'has been unmuted.' },
    jail: { emoji: blackBolt(), title: 'User Jailed', verb: 'has been jailed.' },
    unjail: { emoji: bolt(), title: 'User Unjailed', verb: 'has been released from jail.' },
    purge: { emoji: blackBolt(), title: 'Messages Purged', verb: 'messages were purged.' },
    strip: { emoji: blackBolt(), title: 'Roles Stripped', verb: 'had their roles stripped.' },
    roleadd: { emoji: bolt(), title: 'Role Added', verb: 'received a role.' },
    roleremove: { emoji: blackBolt(), title: 'Role Removed', verb: 'had a role removed.' },
    warn: { emoji: bolt(), title: 'User Warned', verb: 'has been warned.' },
    dnr: { emoji: blackBolt(), title: 'Do Not Reply', verb: 'must not reply to your messages.' },
    undnr: { emoji: bolt(), title: 'DNR Removed', verb: 'may reply to you again.' },
  };
  return (
    map[action] ?? {
      emoji: bolt(),
      title: action,
      verb: `was ${action}ed.`,
    }
  );
}

export async function sendModLog(ctx: ModActionContext): Promise<number> {
  const caseId = nextCaseId(ctx.guild.id);
  const meta = actionMeta(ctx.action);

  const embed = buildServerLogEmbed({
    emoji: meta.emoji,
    title: `${meta.title} · Case #${caseId}`,
    description: `**${ctx.user.username}** ${meta.verb}`,
    moderator: ctx.moderator,
    reason: ctx.reason,
    target: ctx.user,
    footer: `User ID: ${ctx.user.id} | Case #${caseId}`,
    detail: ctx.extra?.duration
      ? { name: '⏱️ Duration:', value: String(ctx.extra.duration) }
      : ctx.extra?.roles_removed != null
        ? { name: '🧹 Removed:', value: String(ctx.extra.roles_removed) }
        : ctx.extra?.amount != null
          ? { name: '#️⃣ Amount:', value: String(ctx.extra.amount) }
          : ctx.extra?.role
            ? { name: '🎭 Role:', value: String(ctx.extra.role) }
            : undefined,
  });

  // resolveLogChannelId rediscovers blaze-mod channels after Railway wipe
  await sendToLogChannel(ctx.guild, logChannelForAction(ctx.action), embed);
  return caseId;
}

export async function sendInvoke(ctx: ModActionContext, channel?: TextChannel | null): Promise<boolean> {
  const cfg = getGuildConfig(ctx.guild.id);
  const invoke = cfg.invoke[ctx.action];
  let usedCustom = false;

  if (invoke?.channel && channel) {
    usedCustom = true;
    const content = applyVars(invoke.channel, ctx);
    if (content.includes('{embed}')) {
      await channel
        .send({
          embeds: [
            new EmbedBuilder()
              .setColor(Colors.success)
              .setDescription(content.replace('{embed}', '').replaceAll('$v', '\n').trim()),
          ],
        })
        .catch(() => undefined);
    } else {
      await channel.send(content).catch(() => undefined);
    }
  }

  if (invoke?.dm) {
    usedCustom = true;
    const content = applyVars(invoke.dm, ctx);
    await ctx.user.send(content).catch(() => undefined);
  }

  await sendModLog(ctx);
  return usedCustom;
}

export async function modConfirm(
  reply: (payload: { content?: string; embeds?: EmbedBuilder[] }) => Promise<unknown>,
  ctx: ModActionContext,
  usedInvoke: boolean,
  successText: string,
): Promise<void> {
  if (usedInvoke) {
    await reply({ content: '👍' });
    return;
  }
  await reply({ content: '👍', embeds: [ok(ctx.moderator, successText)] });
}

export async function stripRoles(member: GuildMember, keepId?: string): Promise<string[]> {
  const removable = member.roles.cache.filter(
    (role) => role.editable && role.id !== member.guild.id && role.id !== keepId,
  );
  const ids = removable.map((r) => r.id);
  if (ids.length) {
    await member.roles.set(keepId ? [keepId] : [], 'Strip roles');
  }
  return ids;
}
