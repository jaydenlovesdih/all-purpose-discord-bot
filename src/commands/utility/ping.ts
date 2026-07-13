import { EmbedBuilder, SlashCommandBuilder } from 'discord.js';
import { Command } from '../../types/index.js';
import { Colors } from '../../utils/embeds.js';

const command: Command = {
  data: new SlashCommandBuilder().setName('ping').setDescription('Check bot latency'),
  async execute(interaction) {
    const sent = await interaction.reply({ content: 'ping...', fetchReply: true });
    const roundtrip = sent.createdTimestamp - interaction.createdTimestamp;
    const ws = interaction.client.ws.ping;

    // Greed-style compact latency box
    await interaction.editReply({
      content: null,
      embeds: [
        new EmbedBuilder()
          .setColor(Colors.log)
          .setDescription(`\`${roundtrip}ms (edit: ${ws}ms)\``),
      ],
    });
  },
};

export default command;
