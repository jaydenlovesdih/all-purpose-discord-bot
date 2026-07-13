import { SlashCommandBuilder } from 'discord.js';
import { Command } from '../../types/index.js';
import { infoEmbed } from '../../utils/embeds.js';
import { formatUptime } from '../../utils/permissions.js';

const command: Command = {
  data: new SlashCommandBuilder().setName('botinfo').setDescription('Display bot statistics'),
  async execute(interaction, client) {
    const embed = infoEmbed(
      [
        `**Servers:** ${client.guilds.cache.size}`,
        `**Users:** ${client.guilds.cache.reduce((a, g) => a + g.memberCount, 0)}`,
        `**Commands:** ${client.commands.size}`,
        `**Uptime:** ${formatUptime(client.uptime ?? 0)}`,
        `**Ping:** ${client.ws.ping}ms`,
        `**Node.js:** ${process.version}`,
      ].join('\n'),
      'Bot Information',
    )
      .setThumbnail(client.user?.displayAvatarURL() ?? null)
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  },
};

export default command;
