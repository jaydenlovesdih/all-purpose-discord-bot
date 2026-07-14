import { createClient } from './client.js';
import { config } from './config.js';
import { loadCommands, loadEvents } from './handlers/loader.js';
import { flushStore, initStore } from './utils/store.js';

async function main(): Promise<void> {
  await initStore();

  const client = createClient();
  client.commands = await loadCommands();
  await loadEvents(client);

  const shutdown = async () => {
    await flushStore().catch(() => undefined);
    process.exit(0);
  };
  process.once('SIGINT', () => void shutdown());
  process.once('SIGTERM', () => void shutdown());

  client.login(config.token);
}

main().catch((error) => {
  console.error('Fatal error starting bot:', error);
  process.exit(1);
});
