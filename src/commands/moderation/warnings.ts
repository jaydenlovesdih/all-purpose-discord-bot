import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  PermissionFlagsBits,
  SlashCommandBuilder,
} from 'discord.js';
import { Command } from '../../types/index.js';
import { getWarnings } from '../../utils/warnings.js';
import { MOD_ACCENT } from '../../utils/modResponse.js';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('warnings')
    .setDescription('View warnings for a member')
    .addUserOption((opt) => opt.setName('user').setDescription('Member to check').setRequired(true)),
  permissions: [PermissionFlagsBits.ModerateMembers],
  guildOnly: true,
  async execute(interaction) {
    const user = interaction.options.getUser('user', true);
    const warnings = getWarnings(interaction.guildId!, user.id);

    if (!warnings.length) {
      await interaction.reply({ content: `**${user.tag}** has no warnings.`, ephemeral: true });
      return;
    }

    const embed = new EmbedBuilder()
      .setColor(MOD_ACCENT)
      .setTitle(`⚠️ Warnings for ${user.username}`)
      .setThumbnail(user.displayAvatarURL({ size: 256 }))
      .setDescription(
        warnings
          .map(
            (w, i) =>
              `**#${i + 1}** — <t:${Math.floor(w.timestamp / 1000)}:f>\n🛡️ Mod: <@${w.moderatorId}>\n📝 Reason: ${w.reason}`,
          )
          .join('\n\n'),
      )
      .addFields(
        { name: '🛡️ Moderator:', value: `${interaction.user}`, inline: false },
        { name: '📝 Total:', value: String(warnings.length), inline: false },
      )
      .setFooter({
        text: `User ID: ${user.id} | ${interaction.client.user?.username ?? 'Bot'}`,
      })
      .setTimestamp();

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(`mod:clearwarns:${user.id}`)
        .setLabel('Clear Warnings')
        .setEmoji('🧹')
        .setStyle(ButtonStyle.Danger),
    );

    await interaction.reply({ embeds: [embed], components: [row] });
  },
};

export default command;
