import { SlashCommandBuilder } from 'discord.js';
import { Command } from '../../types/index.js';
import { infoEmbed } from '../../utils/embeds.js';

const command: Command = {
  data: new SlashCommandBuilder().setName('ping').setDescription('Check bot latency and API response time'),
  async execute(interaction) {
    const sent = await interaction.reply({ content: 'Pinging...', fetchReply: true });
    const roundtrip = sent.createdTimestamp - interaction.createdTimestamp;
    const ws = interaction.client.ws.ping;

    const embed = infoEmbed(
      `**Roundtrip:** ${roundtrip}ms\n**WebSocket:** ${ws}ms`,
      'Pong!',
    ).setTimestamp();

    await interaction.editReply({ content: null, embeds: [embed] });
  },
};

export default command;
