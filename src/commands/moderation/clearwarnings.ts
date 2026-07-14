import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  PermissionFlagsBits,
  SlashCommandBuilder,
} from 'discord.js';
import { Command } from '../../types/index.js';
import { clearWarnings } from '../../utils/warnings.js';
import { buildModEmbed } from '../../utils/modResponse.js';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('clearwarnings')
    .setDescription('Clear all warnings for a member')
    .addUserOption((opt) => opt.setName('user').setDescription('Member').setRequired(true)),
  permissions: [PermissionFlagsBits.ModerateMembers],
  guildOnly: true,
  async execute(interaction) {
    const user = interaction.options.getUser('user', true);
    const member = interaction.guild!.members.cache.get(user.id) ?? null;
    const count = clearWarnings(interaction.guildId!, user.id);

    const embed = buildModEmbed({
      action: 'warn',
      target: user,
      moderator: interaction.user,
      reason: `Cleared ${count} warning(s)`,
      member,
      extraLine: `**${user.username}** had **${count}** warning(s) cleared.`,
      botName: interaction.client.user?.username,
    }).setTitle('🧹 Warnings Cleared');

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(`mod:edit:warn:${user.id}`)
        .setLabel('Edit Reason')
        .setEmoji('📝')
        .setStyle(ButtonStyle.Primary),
    );

    await interaction.reply({ embeds: [embed], components: [row] });
  },
};

export default command;
