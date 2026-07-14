import { REST, Routes } from 'discord.js';
import { config } from './config.js';

/** Slash commands are disabled — prefix-only bot. Clears any previously deployed commands. */
async function deployCommands(): Promise<void> {
  const rest = new REST({ version: '10' }).setToken(config.token);

  console.log('Clearing application commands (prefix-only mode)...');

  await rest.put(Routes.applicationCommands(config.clientId), { body: [] });

  console.log('Slash commands disabled.');
}

deployCommands().catch((error) => {
  console.error('Failed to update application commands:', error);
  process.exit(1);
});
