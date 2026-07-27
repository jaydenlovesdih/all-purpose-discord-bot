import { REST, Routes, ApplicationIntegrationType, PermissionFlagsBits } from 'discord.js';
import { config } from './config.js';
import { loadCommands } from './handlers/loader.js';

/**
 * Deploy slash commands that support user-install ("Add to My Apps").
 * Other bot features stay prefix-only.
 */
async function deployCommands(): Promise<void> {
  const rest = new REST({ version: '10' }).setToken(config.token);
  const commands = await loadCommands();

  const body = [...commands.values()]
    .filter((cmd) => cmd.userInstall)
    .map((cmd) => cmd.data.toJSON());

  console.log(`Configuring application for User Install + Guild Install…`);
  try {
    await rest.patch(Routes.currentApplication(), {
      body: {
        integration_types_config: {
          [ApplicationIntegrationType.GuildInstall]: {
            oauth2_install_params: {
              scopes: ['bot', 'applications.commands'],
              permissions: PermissionFlagsBits.Administrator.toString(),
            },
          },
          [ApplicationIntegrationType.UserInstall]: {
            oauth2_install_params: {
              scopes: ['applications.commands'],
            },
          },
        },
      },
    });
    console.log('Application install contexts updated.');
  } catch (error) {
    console.warn(
      'Could not auto-update install contexts (set User Install in Developer Portal → Installation):',
      error,
    );
  }

  console.log(`Deploying ${body.length} user-install slash command(s)…`);
  for (const cmd of body) {
    console.log(`  /${cmd.name}`);
  }

  await rest.put(Routes.applicationCommands(config.clientId), { body });
  console.log('Slash commands deployed.');
}

deployCommands().catch((error) => {
  console.error('Failed to update application commands:', error);
  process.exit(1);
});
