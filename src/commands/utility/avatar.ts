import { EmbedBuilder, SlashCommandBuilder } from 'discord.js';
import { Command } from '../../types/index.js';
import { Colors } from '../../utils/embeds.js';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('avatar')
    .setDescription('Show a user avatar')
    .addUserOption((opt) => opt.setName('user').setDescription('The user')),
  async execute(interaction) {
    const user = interaction.options.getUser('user') ?? interaction.user;

    const embed = new EmbedBuilder()
      .setColor(Colors.primary)
      .setTitle(`${user.tag}'s Avatar`)
      .setImage(user.displayAvatarURL({ size: 1024 }))
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  },
};

export default command;
