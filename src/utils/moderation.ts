import { EmbedBuilder, Guild, GuildMember, TextChannel, User } from 'discord.js';
import { getGuildConfig } from './guildConfig.js';
import { Colors } from './embeds.js';

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

export async function sendModLog(ctx: ModActionContext): Promise<void> {
  const cfg = getGuildConfig(ctx.guild.id);
  if (!cfg.modLogChannelId) return;

  const channel = ctx.guild.channels.cache.get(cfg.modLogChannelId);
  if (!channel?.isTextBased()) return;

  const embed = new EmbedBuilder()
    .setColor(Colors.warning)
    .setTitle(`Moderation · ${ctx.action}`)
    .addFields(
      { name: 'User', value: `${ctx.user.tag} (\`${ctx.user.id}\`)`, inline: true },
      { name: 'Moderator', value: `${ctx.moderator.tag}`, inline: true },
      { name: 'Reason', value: ctx.reason ?? 'No reason provided' },
    )
    .setTimestamp();

  await (channel as TextChannel).send({ embeds: [embed] }).catch(() => undefined);
}

export async function sendInvoke(ctx: ModActionContext, channel?: TextChannel | null): Promise<boolean> {
  const cfg = getGuildConfig(ctx.guild.id);
  const invoke = cfg.invoke[ctx.action];
  let usedCustom = false;

  if (invoke?.channel && channel) {
    usedCustom = true;
    const content = applyVars(invoke.channel, ctx);
    if (content.includes('{embed}')) {
      await channel.send({
        embeds: [
          new EmbedBuilder()
            .setColor(Colors.primary)
            .setDescription(content.replace('{embed}', '').trim())
            .setTimestamp(),
        ],
      }).catch(() => undefined);
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
