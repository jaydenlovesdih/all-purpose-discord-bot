import { EmbedBuilder, SlashCommandBuilder } from 'discord.js';
import { Command } from '../../types/index.js';
import { Colors } from '../../utils/embeds.js';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('userinfo')
    .setDescription('Display information about a user')
    .addUserOption((opt) => opt.setName('user').setDescription('The user to inspect')),
  async execute(interaction) {
    const user = interaction.options.getUser('user') ?? interaction.user;
    const member = interaction.guild?.members.cache.get(user.id);

    const embed = new EmbedBuilder()
      .setColor(Colors.primary)
      .setTitle(user.tag)
      .setThumbnail(user.displayAvatarURL({ size: 256 }))
      .addFields(
        { name: 'ID', value: user.id, inline: true },
        { name: 'Bot', value: user.bot ? 'Yes' : 'No', inline: true },
        { name: 'Created', value: `<t:${Math.floor(user.createdTimestamp / 1000)}:R>`, inline: true },
      )
      .setTimestamp();

    if (member) {
      embed.addFields(
        { name: 'Nickname', value: member.nickname ?? 'None', inline: true },
        { name: 'Joined', value: `<t:${Math.floor((member.joinedTimestamp ?? 0) / 1000)}:R>`, inline: true },
        {
          name: 'Roles',
          value: member.roles.cache
            .filter((r) => r.id !== interaction.guildId)
            .map((r) => r.toString())
            .join(', ') || 'None',
        },
      );
    }

    await interaction.reply({ embeds: [embed] });
  },
};

export default command;
