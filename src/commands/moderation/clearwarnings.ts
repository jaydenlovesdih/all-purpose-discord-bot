import { PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import { Command } from '../../types/index.js';
import { clearWarnings } from '../../utils/warnings.js';
import { successEmbed } from '../../utils/embeds.js';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('clearwarnings')
    .setDescription('Clear all warnings for a member')
    .addUserOption((opt) => opt.setName('user').setDescription('Member').setRequired(true)),
  permissions: [PermissionFlagsBits.ModerateMembers],
  guildOnly: true,
  async execute(interaction) {
    const user = interaction.options.getUser('user', true);
    const count = clearWarnings(interaction.guildId!, user.id);

    await interaction.reply({
      embeds: [successEmbed(`Cleared **${count}** warning(s) for **${user.tag}**.`)],
    });
  },
};

export default command;
