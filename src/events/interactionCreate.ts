import { Events } from 'discord.js';
import { BotClient } from '../types/index.js';
import { ensureOwner, ensurePermissions } from '../utils/permissions.js';
import { errorEmbed } from '../utils/embeds.js';

export default {
  name: Events.InteractionCreate,
  async execute(interaction: import('discord.js').Interaction, client: BotClient) {
    if (!interaction.isChatInputCommand()) return;

    const command = client.commands.get(interaction.commandName);
    if (!command) return;

    try {
      if (command.ownerOnly && !(await ensureOwner(interaction))) return;

      if (command.guildOnly && !interaction.inGuild()) {
        await interaction.reply({ content: 'This command can only be used in a server.', ephemeral: true });
        return;
      }

      if (command.permissions?.length) {
        const allowed = await ensurePermissions(interaction, command.permissions);
        if (!allowed) return;
      }

      await command.execute(interaction, client);
    } catch (error) {
      console.error(`Error executing /${interaction.commandName}:`, error);

      const embed = errorEmbed('An unexpected error occurred while running this command.');
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp({ embeds: [embed], ephemeral: true });
      } else {
        await interaction.reply({ embeds: [embed], ephemeral: true });
      }
    }
  },
};
