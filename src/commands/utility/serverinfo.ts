import {
  ChannelType,
  EmbedBuilder,
  GuildMember,
  SlashCommandBuilder,
} from 'discord.js';
import { Command } from '../../types/index.js';

const ACCENT = 0xf0b232; // gold bar like the example

function pct(part: number, whole: number): string {
  if (!whole) return '0.0%';
  return `${((part / whole) * 100).toFixed(1)}%`;
}

function dayKey(ts: number): string {
  const d = new Date(ts);
  return `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()}`;
}

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('serverinfo')
    .setDescription('Detailed server information and growth stats'),
  guildOnly: true,
  async execute(interaction) {
    await interaction.deferReply();

    const guild = await interaction.client.guilds.fetch({
      guild: interaction.guildId!,
      withCounts: true,
      force: true,
    });

    // Prefer live cached guild for channels/roles/afk
    const live = interaction.guild!;
    await live.roles.fetch().catch(() => undefined);
    await live.channels.fetch().catch(() => undefined);

    let members: GuildMember[] = [];
    try {
      const fetched = await live.members.fetch();
      members = [...fetched.values()];
    } catch {
      members = [...live.members.cache.values()];
    }

    const totalMembers = guild.approximateMemberCount ?? live.memberCount;
    const onlineMembers =
      guild.approximatePresenceCount ??
      members.filter((m) => m.presence && m.presence.status !== 'offline').length;
    const bots = members.filter((m) => m.user.bot).length;

    const textChannels = live.channels.cache.filter(
      (c) => c.type === ChannelType.GuildText || c.type === ChannelType.GuildAnnouncement,
    ).size;
    const voiceChannels = live.channels.cache.filter(
      (c) => c.type === ChannelType.GuildVoice || c.type === ChannelType.GuildStageVoice,
    ).size;
    const totalChannels = live.channels.cache.size;

    const now = Date.now();
    const day = 86_400_000;
    const humans = members.filter((m) => !m.user.bot && m.joinedTimestamp);

    const joined24h = humans.filter((m) => now - (m.joinedTimestamp ?? 0) <= day).length;
    const joined7d = humans.filter((m) => now - (m.joinedTimestamp ?? 0) <= 7 * day).length;
    const joined30d = humans.filter((m) => now - (m.joinedTimestamp ?? 0) <= 30 * day).length;
    const joinedPrev7d = humans.filter((m) => {
      const age = now - (m.joinedTimestamp ?? 0);
      return age > 7 * day && age <= 14 * day;
    }).length;

    const avgPerDay = Number((joined30d / 30).toFixed(1));

    const dayCounts = new Map<string, number>();
    for (const m of humans) {
      const ts = m.joinedTimestamp!;
      if (now - ts > 30 * day) continue;
      const key = dayKey(ts);
      dayCounts.set(key, (dayCounts.get(key) ?? 0) + 1);
    }
    const topDays = [...dayCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([date, count]) => `${date} (${count} joins)`);

    const weekGrowth =
      joinedPrev7d === 0
        ? joined7d > 0
          ? '+∞%'
          : '0.0%'
        : `${(((joined7d - joinedPrev7d) / joinedPrev7d) * 100).toFixed(1)}%`;
    const weekGrowthSigned =
      joinedPrev7d === 0
        ? weekGrowth
        : `${joined7d - joinedPrev7d >= 0 ? '+' : ''}${(((joined7d - joinedPrev7d) / joinedPrev7d) * 100).toFixed(1)}%`;

    const topRoles = [...live.roles.cache.values()]
      .filter((r) => r.id !== live.id)
      .map((r) => ({
        name: r.name,
        count: members.filter((m) => m.roles.cache.has(r.id)).length || r.members.size,
      }))
      .filter((r) => r.count > 0)
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    const owner = await live.fetchOwner().catch(() => null);
    const afkChannel = live.afkChannel;
    const afkTimeoutMin = Math.floor((live.afkTimeout || 0) / 60);
    const vanity = live.vanityURLCode ? `https://discord.gg/${live.vanityURLCode}` : null;

    const boostTier: Record<number, string> = {
      0: 'None',
      1: 'Tier 1',
      2: 'Tier 2',
      3: 'Tier 3',
    };

    const embed = new EmbedBuilder()
      .setColor(ACCENT)
      .setTitle(`🌐 ${live.name} Info`)
      .setThumbnail(live.iconURL({ size: 256 }))
      .addFields(
        {
          name: 'Owner',
          value: owner ? owner.user.username : `<@${live.ownerId}>`,
          inline: true,
        },
        {
          name: 'Created',
          value: `<t:${Math.floor(live.createdTimestamp / 1000)}:R>`,
          inline: true,
        },
        {
          name: 'Region / Locale',
          value: live.preferredLocale || 'Unknown',
          inline: true,
        },
        { name: 'Total Members', value: `${totalMembers}`, inline: true },
        { name: 'Online Members', value: `${onlineMembers}`, inline: true },
        { name: 'Bots', value: `${bots}`, inline: true },
        { name: 'Roles Count', value: `${live.roles.cache.size}`, inline: true },
        { name: 'Channels (Total)', value: `${totalChannels}`, inline: true },
        { name: 'Text Channels', value: `${textChannels}`, inline: true },
        { name: 'Voice Channels', value: `${voiceChannels}`, inline: true },
        { name: 'Boosts', value: `${live.premiumSubscriptionCount ?? 0}`, inline: true },
        {
          name: 'Boost Level',
          value: boostTier[live.premiumTier] ?? `Tier ${live.premiumTier}`,
          inline: true,
        },
        { name: 'Emojis', value: `${live.emojis.cache.size}`, inline: true },
        {
          name: 'AFK Channel',
          value: afkChannel ? `${afkChannel}` : 'None',
          inline: true,
        },
        {
          name: 'AFK Timeout',
          value: afkTimeoutMin ? `${afkTimeoutMin} min` : 'None',
          inline: true,
        },
      );

    if (vanity) {
      embed.addFields({ name: 'Vanity URL', value: vanity });
    }

    embed.addFields(
      {
        name: 'Joined Last 24h',
        value: `${joined24h} (${pct(joined24h, totalMembers)})`,
        inline: true,
      },
      {
        name: 'Joined Last 7d',
        value: `${joined7d} (${pct(joined7d, totalMembers)})`,
        inline: true,
      },
      {
        name: 'Joined Last 30d',
        value: `${joined30d.toLocaleString()} (${pct(joined30d, totalMembers)})`,
        inline: true,
      },
      { name: 'Avg Per Day (30d)', value: `${avgPerDay}` },
      {
        name: 'Top 3 Join Days (30d)',
        value: topDays.length ? topDays.join('\n') : 'No join data',
      },
      {
        name: 'Growth This Week vs Last',
        value: `${weekGrowthSigned} (${joined7d} vs ${joinedPrev7d})`,
      },
      {
        name: 'Top Roles by Members',
        value: topRoles.length
          ? topRoles.map((r) => `${r.name}: ${r.count}`).join('\n')
          : 'No role data',
      },
    );

    await interaction.editReply({ embeds: [embed] });
  },
};

export default command;
