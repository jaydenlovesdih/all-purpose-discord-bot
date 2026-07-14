import { PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import { Command } from '../../types/index.js';
import { clearWarnings } from '../../utils/warnings.js';
import { buildModButtons, buildModEmbed } from '../../utils/modResponse.js';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('clearwarnings')
    .setDescription('Clear all warnings for a member')
    .addUserOption((opt) => opt.setName('user').setDescription('Member').setRequired(true))
    .addStringOption((opt) => opt.setName('reason').setDescription('Reason')),
  permissions: [PermissionFlagsBits.ModerateMembers],
  guildOnly: true,
  async execute(interaction) {
    const user = interaction.options.getUser('user', true);
    const reason = interaction.options.getString('reason') ?? 'No reason provided';
    const member = interaction.guild!.members.cache.get(user.id) ?? null;
    const count = clearWarnings(interaction.guildId!, user.id);

    const embed = buildModEmbed({
      action: 'clearwarnings',
      target: user,
      moderator: interaction.user,
      reason,
      member,
      extraLine: `Cleared **${count}** warning(s).`,
      botName: interaction.client.user?.username,
    });
    const row = buildModButtons('clearwarnings', user.id);
    await interaction.reply({ embeds: [embed], components: row ? [row] : [] });
  },
};

export default command;
