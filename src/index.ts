import { createClient } from './client.js';
import { config } from './config.js';
import { loadCommands, loadEvents } from './handlers/loader.js';

async function main(): Promise<void> {
  const client = createClient();
  client.commands = await loadCommands();
  await loadEvents(client);

  client.login(config.token);
}

main().catch((error) => {
  console.error('Fatal error starting bot:', error);
  process.exit(1);
});
