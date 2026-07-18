import { ChatInputCommandInteraction } from 'discord.js';
import { config } from '../config.js';
import { BotClient } from '../types/index.js';
import { ensureOwner, ensurePermissions } from '../utils/permissions.js';
import { errorEmbed } from '../utils/embeds.js';
import { usageEmbed } from '../utils/modResponse.js';
import { buildUsageLine } from '../utils/usage.js';
import { asSlashInteraction, PrefixCommandInteraction } from '../utils/prefixInteraction.js';
import { getPrefix } from '../utils/setup.js';
import { getGuildConfig } from '../utils/guildConfig.js';
import { isOwner } from '../utils/permissions.js';

type CommandInteractionLike = ChatInputCommandInteraction | PrefixCommandInteraction;

async function sendError(
  interaction: CommandInteractionLike,
  content: string,
): Promise<void> {
  const embed = errorEmbed(content);
  if (interaction.replied) {
    await interaction.followUp({ embeds: [embed] });
  } else {
    await interaction.reply({ embeds: [embed] });
  }
}

export async function runCommand(
  interaction: CommandInteractionLike,
  client: BotClient,
): Promise<void> {
  const command = client.commands.get(interaction.commandName);
  if (!command) return;

  // Silent lock for non-owners (slash path; prefix is also gated in messageCreate)
  if (interaction.guildId) {
    const locked = getGuildConfig(interaction.guildId).botLocked;
    if (locked && !isOwner(interaction.user.id)) return;
  }

  const prefix = getPrefix(interaction.guildId, config.prefix);

  try {
    if (command.ownerOnly && !(await ensureOwner(interaction))) return;

    if (command.guildOnly && !interaction.inGuild()) {
      await sendError(interaction, 'This command can only be used in a server.');
      return;
    }

    if (command.permissions?.length) {
      const allowed = await ensurePermissions(interaction, command.permissions);
      if (!allowed) return;
    }

    await command.execute(asSlashInteraction(interaction), client);
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('Missing required')) {
      const usage = buildUsageLine(interaction.commandName, prefix);
      const embed = usageEmbed(interaction.commandName, usage, prefix);
      if (interaction.replied) {
        await interaction.followUp({ embeds: [embed] });
      } else {
        await interaction.reply({ embeds: [embed] });
      }
      return;
    }

    console.error(`Error executing ${interaction.commandName}:`, error);

    const embed = errorEmbed('An unexpected error occurred while running this command.');
    if (interaction.replied) {
      await interaction.followUp({ embeds: [embed] });
    } else {
      await interaction.reply({ embeds: [embed] });
    }
  }
}
