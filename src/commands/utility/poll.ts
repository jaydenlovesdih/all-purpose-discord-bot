import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  PermissionFlagsBits,
  SlashCommandBuilder,
} from 'discord.js';
import { Command } from '../../types/index.js';
import { MOD_ACCENT } from '../../utils/modResponse.js';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('poll')
    .setDescription('Create a quick yes/no poll')
    .addStringOption((opt) => opt.setName('question').setDescription('Poll question').setRequired(true)),
  permissions: [PermissionFlagsBits.SendMessages],
  guildOnly: true,
  async execute(interaction) {
    const question = interaction.options.getString('question', true);

    const embed = new EmbedBuilder()
      .setColor(MOD_ACCENT)
      .setTitle('📊 Poll')
      .setDescription(`**${question}**\n\n✅ Yes: **0**\n❌ No: **0**`)
      .setFooter({ text: `Poll by ${interaction.user.tag}` })
      .setTimestamp();

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId('poll:yes')
        .setLabel('Yes (0)')
        .setEmoji('✅')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId('poll:no')
        .setLabel('No (0)')
        .setEmoji('❌')
        .setStyle(ButtonStyle.Danger),
      new ButtonBuilder()
        .setCustomId(`poll:end:${interaction.user.id}`)
        .setLabel('End Poll')
        .setStyle(ButtonStyle.Secondary),
    );

    await interaction.reply({ embeds: [embed], components: [row] });
  },
};

export default command;
