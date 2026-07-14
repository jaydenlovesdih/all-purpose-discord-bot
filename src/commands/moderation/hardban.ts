import { PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import { Command } from '../../types/index.js';
import { mutateGuildConfig, getGuildConfig } from '../../utils/guildConfig.js';
import { sendInvoke } from '../../utils/moderation.js';
import { ok } from '../../utils/embeds.js';
import { buildModButtons, buildModEmbed } from '../../utils/modResponse.js';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('hardban')
    .setDescription('Ban a user and auto-ban them if they rejoin')
    .addUserOption((opt) => opt.setName('user').setDescription('User').setRequired(true))
    .addStringOption((opt) => opt.setName('reason').setDescription('Reason')),
  permissions: [PermissionFlagsBits.BanMembers],
  guildOnly: true,
  async execute(interaction) {
    const user = interaction.options.getUser('user', true);
    const reason = interaction.options.getString('reason') ?? 'No reason provided';
    const cfg = getGuildConfig(interaction.guildId!);
    const already = cfg.hardbans.includes(user.id);
    const member = interaction.guild!.members.cache.get(user.id) ?? null;

    if (already) {
      mutateGuildConfig(interaction.guildId!, (c) => {
        c.hardbans = c.hardbans.filter((id) => id !== user.id);
      });
      await interaction.reply({ embeds: [ok(interaction.user, `removed hardban for **${user.tag}**`)] });
      return;
    }

    await interaction.guild!.members.ban(user.id, { reason: `Hardban: ${reason}` }).catch(() => undefined);
    mutateGuildConfig(interaction.guildId!, (c) => {
      if (!c.hardbans.includes(user.id)) c.hardbans.push(user.id);
    });

    await sendInvoke(
      { guild: interaction.guild!, action: 'hardban', user, moderator: interaction.user, reason },
      null,
    );

    const embed = buildModEmbed({
      action: 'hardban',
      target: user,
      moderator: interaction.user,
      reason,
      member,
      botName: interaction.client.user?.username,
    });
    const row = buildModButtons('hardban', user.id);
    await interaction.reply({ embeds: [embed], components: row ? [row] : [] });
  },
};

export default command;
