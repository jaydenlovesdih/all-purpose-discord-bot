import { Events } from 'discord.js';
import { runCommand } from '../handlers/commandRunner.js';
import { handleComponent } from '../handlers/components.js';
import { BotClient } from '../types/index.js';

export default {
  name: Events.InteractionCreate,
  async execute(interaction: import('discord.js').Interaction, client: BotClient) {
    if (await handleComponent(interaction, client)) return;

    if (!interaction.isChatInputCommand()) return;
    await runCommand(interaction, client);
  },
};
