import { PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import { Command } from '../../types/index.js';
import { mutateGuildConfig, getGuildConfig } from '../../utils/guildConfig.js';
import { config } from '../../config.js';
import { successEmbed, errorEmbed } from '../../utils/embeds.js';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('prefix')
    .setDescription('View or change the server command prefix')
    .addStringOption((opt) => opt.setName('new_prefix').setDescription('New prefix (1-5 chars)')),
  permissions: [PermissionFlagsBits.ManageGuild],
  guildOnly: true,
  async execute(interaction) {
    const next = interaction.options.getString('new_prefix');
    const current = getGuildConfig(interaction.guildId!).prefix ?? config.prefix;

    if (!next) {
      await interaction.reply({ embeds: [successEmbed(`Current prefix: \`${current}\`\nMention me to see the prefix anytime.`)] });
      return;
    }

    if (next.length > 5) {
      await interaction.reply({ embeds: [errorEmbed('Prefix must be 1-5 characters.')], ephemeral: true });
      return;
    }

    mutateGuildConfig(interaction.guildId!, (c) => {
      c.prefix = next;
    });
    await interaction.reply({ embeds: [successEmbed(`Prefix updated to \`${next}\`\nExample: \`${next}ban @user\``)] });
  },
};

export default command;
