import { readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { Collection } from 'discord.js';
import { BotClient, Command } from '../types/index.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

function getSourceExtension(): string {
  return __dirname.includes(`${join('dist', 'handlers')}`) ? '.js' : '.ts';
}

function listModuleFiles(directory: string): string[] {
  const extension = getSourceExtension();
  return readdirSync(directory).filter((file) => file.endsWith(extension));
}

export async function loadCommands(): Promise<Collection<string, Command>> {
  const commands = new Collection<string, Command>();
  const commandsPath = join(__dirname, '../commands');
  const categories = readdirSync(commandsPath, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name);

  for (const category of categories) {
    const categoryPath = join(commandsPath, category);
    const files = listModuleFiles(categoryPath);

    for (const file of files) {
      const filePath = join(categoryPath, file);
      const module = await import(pathToFileURL(filePath).href);
      const command = module.default as Command;
      if (command?.data?.name) {
        commands.set(command.data.name, command);
      }
    }
  }

  return commands;
}

export async function loadEvents(client: BotClient): Promise<void> {
  const eventsPath = join(__dirname, '../events');
  const files = listModuleFiles(eventsPath);

  for (const file of files) {
    const filePath = join(eventsPath, file);
    const module = await import(pathToFileURL(filePath).href);
    const event = module.default;

    if (event.once) {
      client.once(event.name, (...args: unknown[]) => event.execute(...args, client));
    } else {
      client.on(event.name, (...args: unknown[]) => event.execute(...args, client));
    }
  }
}
