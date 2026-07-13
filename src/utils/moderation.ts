import { EmbedBuilder, Guild, GuildMember, TextChannel, User } from 'discord.js';
import { getGuildConfig, mutateGuildConfig } from './guildConfig.js';
import { caseLog, Colors, ok } from './embeds.js';

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

export async function sendModLog(ctx: ModActionContext): Promise<number> {
  const cfg = getGuildConfig(ctx.guild.id);
  const caseId = nextCaseId(ctx.guild.id);
  if (!cfg.modLogChannelId) return caseId;

  const channel = ctx.guild.channels.cache.get(cfg.modLogChannelId);
  if (!channel?.isTextBased() || !('send' in channel)) return caseId;

  const actionLabel = ctx.action.charAt(0).toUpperCase() + ctx.action.slice(1);
  const embed = caseLog({
    title: `Case #${caseId} · ${actionLabel}`,
    iconURL: ctx.user.displayAvatarURL(),
    description:
      `${ctx.user} was **${ctx.action}ed** by ${ctx.moderator}\n` +
      `**Reason:** ${ctx.reason ?? 'No reason provided'}`,
    footer: `User ID: ${ctx.user.id}`,
    color: Colors.log,
  });

  await (channel as TextChannel).send({ embeds: [embed] }).catch(() => undefined);
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
              .setColor(Colors.log)
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

/** Bleed default mod confirm: just 👍 when no custom invoke message */
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
  // Bleed default is thumbs up; also send a compact ok line for clarity
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
