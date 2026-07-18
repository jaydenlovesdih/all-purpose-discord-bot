import { EmbedBuilder, PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import { Command } from '../../types/index.js';
import { getDeleteSnipe } from '../../utils/snipeStore.js';
import { Colors, errorEmbed } from '../../utils/embeds.js';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('snipe')
    .setDescription('View recently deleted messages')
    .addIntegerOption((opt) => opt.setName('index').setDescription('Snipe index (default 1)').setMinValue(1).setMaxValue(20)),
  permissions: [PermissionFlagsBits.ManageMessages],
  guildOnly: true,
  async execute(interaction) {
    const index = interaction.options.getInteger('index') ?? 1;
    const channelId = interaction.channelId ?? interaction.channel?.id;
    if (!channelId) {
      await interaction.reply({ embeds: [errorEmbed('No channel to snipe from.')], ephemeral: true });
      return;
    }
    const entry = getDeleteSnipe(channelId, index);
    if (!entry) {
      await interaction.reply({ embeds: [errorEmbed('Nothing to snipe.')], ephemeral: true });
      return;
    }

    const embed = new EmbedBuilder()
      .setColor(Colors.primary)
      .setAuthor({ name: entry.authorTag, iconURL: entry.authorAvatar })
      .setDescription(entry.content.slice(0, 4000))
      .setFooter({ text: `Deleted snipe #${index}` })
      .setTimestamp(entry.deletedAt);

    if (entry.attachments.length) {
      embed.addFields({ name: 'Attachments', value: entry.attachments.join('\n').slice(0, 1000) });
    }

    await interaction.reply({ embeds: [embed] });
  },
};

export default command;
