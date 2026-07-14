import { PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import { Command } from '../../types/index.js';
import { sendInvoke } from '../../utils/moderation.js';
import { fail } from '../../utils/embeds.js';
import { buildModButtons, buildModEmbed } from '../../utils/modResponse.js';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('softban')
    .setDescription('Ban then unban a user to delete messages')
    .addUserOption((opt) => opt.setName('user').setDescription('Member').setRequired(true))
    .addStringOption((opt) => opt.setName('reason').setDescription('Reason')),
  permissions: [PermissionFlagsBits.BanMembers],
  guildOnly: true,
  async execute(interaction) {
    const user = interaction.options.getUser('user', true);
    const reason = interaction.options.getString('reason') ?? 'No reason provided';
    const member = interaction.guild!.members.cache.get(user.id) ?? null;

    try {
      await interaction.guild!.members.ban(user.id, {
        deleteMessageSeconds: 7 * 86400,
        reason: `Softban: ${reason}`,
      });
      await interaction.guild!.members.unban(user.id, 'Softban complete');
    } catch {
      await interaction.reply({ embeds: [fail(interaction.user, 'Could not softban that user')], ephemeral: true });
      return;
    }

    await sendInvoke(
      { guild: interaction.guild!, action: 'softban', user, moderator: interaction.user, reason },
      null,
    );

    const embed = buildModEmbed({
      action: 'softban',
      target: user,
      moderator: interaction.user,
      reason,
      member,
      botName: interaction.client.user?.username,
    });
    const row = buildModButtons('softban', user.id);
    await interaction.reply({ embeds: [embed], components: row ? [row] : [] });
  },
};

export default command;
