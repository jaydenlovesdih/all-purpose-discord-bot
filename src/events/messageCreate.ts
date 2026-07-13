import { Events } from 'discord.js';
import { config } from '../config.js';
import { runCommand } from '../handlers/commandRunner.js';
import { BotClient } from '../types/index.js';
import { errorEmbed } from '../utils/embeds.js';
import {
  buildMissingArgsMessage,
  isTextCommandChannel,
  parsePrefixMessage,
  PrefixCommandInteraction,
} from '../utils/prefixInteraction.js';
import { prefixSchemas } from '../utils/prefixSchemas.js';

export default {
  name: Events.MessageCreate,
  async execute(message: import('discord.js').Message, client: BotClient) {
    if (message.author.bot || !message.guild) return;
    if (!isTextCommandChannel(message.channel)) return;

    const parsed = parsePrefixMessage(message.content, config.prefix);
    if (!parsed) return;

    const command = client.commands.get(parsed.command);
    if (!command) return;

    const schema = prefixSchemas[parsed.command];
    if (schema === undefined) return;

    try {
      const interaction = new PrefixCommandInteraction(message, parsed.command, parsed.args);
      await runCommand(interaction, client);
    } catch (error) {
      if (error instanceof Error && error.message.startsWith('Missing required')) {
        await message.reply({
          embeds: [
            errorEmbed(
              `${error.message}\n${buildMissingArgsMessage(parsed.command)}`,
            ),
          ],
        });
        return;
      }

      console.error(`Prefix command error .${parsed.command}:`, error);
      await message.reply({
        embeds: [errorEmbed('An unexpected error occurred while running this command.')],
      });
    }
  },
};
