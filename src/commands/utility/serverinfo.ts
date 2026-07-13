import { EmbedBuilder, SlashCommandBuilder } from 'discord.js';
import { Command } from '../../types/index.js';
import { Colors } from '../../utils/embeds.js';

const command: Command = {
  data: new SlashCommandBuilder().setName('serverinfo').setDescription('Display information about this server'),
  guildOnly: true,
  async execute(interaction) {
    const guild = interaction.guild!;
    await guild.fetch();

    const embed = new EmbedBuilder()
      .setColor(Colors.primary)
      .setTitle(guild.name)
      .setThumbnail(guild.iconURL({ size: 256 }))
      .addFields(
        { name: 'Owner', value: `<@${guild.ownerId}>`, inline: true },
        { name: 'Members', value: `${guild.memberCount}`, inline: true },
        { name: 'Channels', value: `${guild.channels.cache.size}`, inline: true },
        { name: 'Roles', value: `${guild.roles.cache.size}`, inline: true },
        { name: 'Created', value: `<t:${Math.floor(guild.createdTimestamp / 1000)}:R>`, inline: true },
        { name: 'Boost Level', value: `${guild.premiumTier}`, inline: true },
      )
      .setTimestamp();

    if (guild.description) embed.setDescription(guild.description);

    await interaction.reply({ embeds: [embed] });
  },
};

export default command;
