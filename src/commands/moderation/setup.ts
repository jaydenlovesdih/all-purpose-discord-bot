import { PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import { Command } from '../../types/index.js';
import { runServerSetup } from '../../utils/setup.js';
import { successEmbed, errorEmbed } from '../../utils/embeds.js';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('setup')
    .setDescription('Create jail, logs, mute role, and moderation category'),
  permissions: [PermissionFlagsBits.Administrator],
  guildOnly: true,
  async execute(interaction) {
    await interaction.deferReply();
    try {
      const summary = await runServerSetup(interaction.guild!);
      await interaction.editReply({ embeds: [successEmbed(summary, 'Server Setup Complete')] });
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      await interaction.editReply({ embeds: [errorEmbed(msg)] });
    }
  },
};

export default command;
