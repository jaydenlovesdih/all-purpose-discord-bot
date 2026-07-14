import { EmbedBuilder, GuildMember } from 'discord.js';
import { Colors } from './embeds.js';

export function formatWelcomeText(
  template: string,
  member: GuildMember,
): string {
  return template
    .replaceAll('{user}', member.toString())
    .replaceAll('{user.mention}', member.toString())
    .replaceAll('{user.name}', member.user.username)
    .replaceAll('{user.tag}', member.user.tag)
    .replaceAll('{guild}', member.guild.name)
    .replaceAll('{guild.name}', member.guild.name)
    .replaceAll('{membercount}', String(member.guild.memberCount));
}

export function buildWelcomeDmEmbed(member: GuildMember, message: string): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(Colors.success)
    .setTitle(`Welcome to ${member.guild.name}`)
    .setDescription(message)
    .setThumbnail(member.guild.iconURL({ size: 256 }) ?? null)
    .setFooter({ text: member.guild.name })
    .setTimestamp();
}
