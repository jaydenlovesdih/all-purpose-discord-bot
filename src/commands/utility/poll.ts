import { EmbedBuilder, PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import { Command } from '../../types/index.js';
import { Colors } from '../../utils/embeds.js';

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
      .setColor(Colors.primary)
      .setTitle('📊 Poll')
      .setDescription(question)
      .setFooter({ text: `Poll by ${interaction.user.tag}` })
      .setTimestamp();

    const message = await interaction.reply({ embeds: [embed], fetchReply: true });
    await message.react('✅');
    await message.react('❌');
  },
};

export default command;
