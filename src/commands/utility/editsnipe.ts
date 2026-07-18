import { EmbedBuilder, PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import { Command } from '../../types/index.js';
import { getEditSnipe } from '../../utils/snipeStore.js';
import { Colors, errorEmbed } from '../../utils/embeds.js';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('editsnipe')
    .setDescription('View recently edited messages')
    .addIntegerOption((opt) => opt.setName('index').setDescription('Index').setMinValue(1).setMaxValue(20)),
  permissions: [PermissionFlagsBits.ManageMessages],
  guildOnly: true,
  async execute(interaction) {
    const index = interaction.options.getInteger('index') ?? 1;
    const channelId = interaction.channelId ?? interaction.channel?.id;
    if (!channelId) {
      await interaction.reply({ embeds: [errorEmbed('No channel to editsnipe from.')], ephemeral: true });
      return;
    }
    const entry = getEditSnipe(channelId, index);
    if (!entry) {
      await interaction.reply({ embeds: [errorEmbed('Nothing to editsnipe.')], ephemeral: true });
      return;
    }

    await interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setColor(Colors.info)
          .setTitle(`Edit snipe #${index}`)
          .addFields(
            { name: 'Before', value: entry.before.slice(0, 1000) },
            { name: 'After', value: entry.after.slice(0, 1000) },
            { name: 'Author', value: entry.authorTag },
          )
          .setTimestamp(entry.editedAt),
      ],
    });
  },
};

export default command;
