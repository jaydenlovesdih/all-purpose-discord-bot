import { SlashCommandBuilder } from 'discord.js';
import { Command } from '../../types/index.js';
import { mutateGuildConfig } from '../../utils/guildConfig.js';
import { successEmbed } from '../../utils/embeds.js';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('afk')
    .setDescription('Set yourself AFK')
    .addStringOption((opt) => opt.setName('reason').setDescription('AFK reason')),
  guildOnly: true,
  async execute(interaction) {
    const reason = interaction.options.getString('reason') ?? 'AFK';
    mutateGuildConfig(interaction.guildId!, (c) => {
      c.afk[interaction.user.id] = { reason, since: Date.now() };
    });
    await interaction.reply({ embeds: [successEmbed(`You're now AFK: ${reason}`)] });
  },
};

export default command;
