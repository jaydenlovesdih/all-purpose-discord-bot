import { REST, Routes } from 'discord.js';
import { config } from './config.js';
import { loadCommands } from './handlers/loader.js';

async function deployCommands(): Promise<void> {
  const commands = await loadCommands();
  const body = commands.map((cmd) => cmd.data.toJSON());

  const rest = new REST({ version: '10' }).setToken(config.token);

  console.log(`Deploying ${body.length} application commands...`);

  await rest.put(Routes.applicationCommands(config.clientId), { body });

  console.log('Successfully deployed global application commands.');
}

deployCommands().catch((error) => {
  console.error('Failed to deploy commands:', error);
  process.exit(1);
});
