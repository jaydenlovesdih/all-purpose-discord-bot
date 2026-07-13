import { SlashCommandBuilder } from 'discord.js';
import { config } from '../../config.js';
import { Command } from '../../types/index.js';
import { Colors } from '../../utils/embeds.js';
import { formatUptime } from '../../utils/permissions.js';
import { getPrefix } from '../../utils/setup.js';

const command: Command = {
  data: new SlashCommandBuilder().setName('help').setDescription('List all available commands'),
  async execute(interaction, client) {
    const prefix = getPrefix(interaction.guildId, config.prefix);
    const categories = new Map<string, string[]>();

    for (const cmd of client.commands.values()) {
      const name = cmd.data.name;
      const category =
        ['ban', 'kick', 'mute', 'unmute', 'purge', 'warn', 'warnings', 'clearwarnings', 'role', 'setup', 'jail', 'unjail', 'softban', 'hardban', 'unban', 'strip', 'filter', 'antiraid'].includes(name)
          ? 'Moderation & Security'
          : ['eval', 'say', 'embed', 'invoke', 'prefix'].includes(name)
            ? 'Admin'
            : ['8ball', 'coinflip'].includes(name)
              ? 'Fun'
              : ['welcome', 'levels', 'starboard', 'giveaway', 'afk', 'snipe', 'editsnipe', 'clearsnipe'].includes(name)
                ? 'Server Systems'
                : 'Utility';

      if (!categories.has(category)) categories.set(category, []);
      categories.get(category)!.push(`\`${prefix}${name}\` / \`/${name}\` — ${cmd.data.description}`);
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
            `Prefix: \`${prefix}\` (change with \`${prefix}prefix\`)\n` +
            `Owner bypass ID: \`${config.ownerId}\`\n` +
            `Quick start: \`${prefix}setup\` → \`${prefix}filter setup\` → \`${prefix}welcome enable\``,
          fields,
          footer: { text: `${client.commands.size} commands | Uptime: ${formatUptime(client.uptime ?? 0)}` },
          timestamp: new Date().toISOString(),
        },
      ],
    });
  },
};

export default command;
