import { SlashCommandBuilder } from 'discord.js';
import { config } from '../../config.js';
import { Command } from '../../types/index.js';
import { Colors } from '../../utils/embeds.js';
import { formatUptime } from '../../utils/permissions.js';

const command: Command = {
  data: new SlashCommandBuilder().setName('help').setDescription('List all available commands'),
  async execute(interaction, client) {
    const categories = new Map<string, string[]>();

    for (const cmd of client.commands.values()) {
      const category = cmd.data.name.includes('ban') || cmd.data.name.includes('kick') || cmd.data.name.includes('mute') || cmd.data.name.includes('purge') || cmd.data.name.includes('warn')
        ? 'Moderation'
        : cmd.data.name === 'eval' || cmd.data.name === 'say' || cmd.data.name === 'reload'
          ? 'Admin'
          : cmd.data.name === '8ball' || cmd.data.name === 'coinflip'
            ? 'Fun'
            : 'Utility';

      if (!categories.has(category)) categories.set(category, []);
      categories.get(category)!.push(
        `\`/${cmd.data.name}\` or \`${config.prefix}${cmd.data.name}\` — ${cmd.data.description}`,
      );
    }

    const examples = [
      `\`${config.prefix}ban @user spamming\``,
      `\`${config.prefix}mute @user 30 being loud\``,
      `\`${config.prefix}purge 25\``,
    ];

    const fields = [...categories.entries()].map(([name, cmds]) => ({
      name,
      value: cmds.join('\n'),
    }));

    fields.push({
      name: 'Prefix examples',
      value: examples.slice(0, 3).join('\n'),
    });

    await interaction.reply({
      embeds: [
        {
          color: Colors.primary,
          title: 'Command Help',
          description:
            `Use slash commands or the \`${config.prefix}\` prefix.\n` +
            `Owner bypass is enabled for ID \`${config.ownerId}\`.`,
          fields,
          footer: { text: `${client.commands.size} commands | Uptime: ${formatUptime(client.uptime ?? 0)}` },
          timestamp: new Date().toISOString(),
        },
      ],
    });
  },
};

export default command;
