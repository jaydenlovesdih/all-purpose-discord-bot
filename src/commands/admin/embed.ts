import { EmbedBuilder, PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import { Command } from '../../types/index.js';
import { Colors } from '../../utils/embeds.js';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('embed')
    .setDescription('Send a custom embed message')
    .addStringOption((opt) => opt.setName('title').setDescription('Embed title').setRequired(true))
    .addStringOption((opt) => opt.setName('description').setDescription('Embed description').setRequired(true))
    .addStringOption((opt) =>
      opt.setName('color').setDescription('Hex color (e.g. #5865F2)').setRequired(false),
    ),
  permissions: [PermissionFlagsBits.ManageMessages],
  guildOnly: true,
  async execute(interaction) {
    const title = interaction.options.getString('title', true);
    const description = interaction.options.getString('description', true);
    const colorInput = interaction.options.getString('color') ?? '#5865F2';
    const color = parseInt(colorInput.replace('#', ''), 16) || Colors.primary;

    const embed = new EmbedBuilder()
      .setColor(color)
      .setTitle(title)
      .setDescription(description)
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  },
};

export default command;
