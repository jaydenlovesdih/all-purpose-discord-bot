import { EmbedBuilder, PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import { Command } from '../../types/index.js';
import { getWarnings } from '../../utils/warnings.js';
import { Colors } from '../../utils/embeds.js';

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
      .setColor(Colors.warning)
      .setTitle(`Warnings for ${user.tag}`)
      .setDescription(
        warnings
          .map(
            (w, i) =>
              `**#${i + 1}** — <t:${Math.floor(w.timestamp / 1000)}:f>\nMod: <@${w.moderatorId}>\nReason: ${w.reason}`,
          )
          .join('\n\n'),
      )
      .setFooter({ text: `${warnings.length} total warning(s)` });

    await interaction.reply({ embeds: [embed] });
  },
};

export default command;
