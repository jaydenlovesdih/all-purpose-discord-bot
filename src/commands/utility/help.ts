import { SlashCommandBuilder } from 'discord.js';
import { config } from '../../config.js';
import { Command } from '../../types/index.js';
import { Colors } from '../../utils/embeds.js';
import { formatUptime } from '../../utils/permissions.js';
import { getPrefix } from '../../utils/setup.js';

function categorize(name: string): string {
  if (
    [
      'ban', 'kick', 'mute', 'timeout', 'unmute', 'purge', 'warn', 'warnings', 'clearwarnings', 'role',
      'setup', 'jail', 'unjail', 'softban', 'hardban', 'unban', 'strip', 'filter', 'antiraid', 'antinuke',
    ].includes(name)
  ) {
    return 'Moderation & Security';
  }
  if (['eval', 'say', 'embed', 'invoke', 'prefix', 'fakepermissions', 'alias', 'autoresponder', 'logging'].includes(name)) {
    return 'Admin';
  }
  if (['8ball', 'coinflip'].includes(name)) return 'Fun';
  if (['welcome', 'levels', 'starboard', 'giveaway', 'afk', 'snipe', 'editsnipe', 'clearsnipe'].includes(name)) {
    return 'Server Systems';
  }
  return 'Utility';
}

const command: Command = {
  data: new SlashCommandBuilder().setName('help').setDescription('List all available commands'),
  async execute(interaction, client) {
    const prefix = getPrefix(interaction.guildId, config.prefix);
    const categories = new Map<string, string[]>();

    for (const cmd of client.commands.values()) {
      const name = cmd.data.name;
      const category = categorize(name);
      if (!categories.has(category)) categories.set(category, []);
      categories.get(category)!.push(`\`${prefix}${name}\` — ${cmd.data.description}`);
    }

    const fields = [...categories.entries()].map(([name, cmds]) => ({
      name,
      value: cmds.join('\n').slice(0, 1024),
    }));

    await interaction.reply({
      embeds: [
        {
          color: Colors.primary,
          title: 'Command Help',
          description:
            `Prefix: \`${prefix}\` · Change: \`${prefix}prefix\`\n` +
            `Owner bypass: \`${config.ownerId}\`\n` +
            `**Quick start:** \`${prefix}setup\` → \`${prefix}filter setup\` → \`${prefix}antinuke toggle\` → \`${prefix}logging enable\``,
          fields,
          footer: { text: `${client.commands.size} commands | Uptime: ${formatUptime(client.uptime ?? 0)}` },
          timestamp: new Date().toISOString(),
        },
      ],
    });
  },
};

export default command;
