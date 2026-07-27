import { Events } from 'discord.js';
import { runCommand } from '../handlers/commandRunner.js';
import { handleComponent } from '../handlers/components.js';
import { BotClient } from '../types/index.js';

export default {
  name: Events.InteractionCreate,
  async execute(interaction: import('discord.js').Interaction, client: BotClient) {
    if (interaction.isAutocomplete()) {
      const command = client.commands.get(interaction.commandName);
      if (command?.autocomplete) {
        try {
          await command.autocomplete(interaction, client);
        } catch (error) {
          console.error(`Autocomplete error for ${interaction.commandName}:`, error);
        }
      }
      return;
    }

    if (await handleComponent(interaction, client)) return;

    if (!interaction.isChatInputCommand()) return;
    await runCommand(interaction, client);
  },
};
