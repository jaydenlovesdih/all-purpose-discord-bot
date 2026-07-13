import { ChannelType, PermissionFlagsBits, SlashCommandBuilder, TextChannel } from 'discord.js';
import { Command } from '../../types/index.js';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('say')
    .setDescription('Make the bot say something')
    .addStringOption((opt) => opt.setName('message').setDescription('Message to send').setRequired(true))
    .addChannelOption((opt) =>
      opt.setName('channel').setDescription('Channel to send in').addChannelTypes(ChannelType.GuildText),
    ),
  permissions: [PermissionFlagsBits.ManageMessages],
  guildOnly: true,
  async execute(interaction) {
    const message = interaction.options.getString('message', true);
    const channelOption = interaction.options.getChannel('channel') ?? interaction.channel;

    if (!channelOption || channelOption.type !== ChannelType.GuildText) {
      await interaction.reply({ content: 'Invalid text channel.', ephemeral: true });
      return;
    }

    const channel = channelOption as TextChannel;
    await channel.send(message);
    await interaction.reply({ content: 'Message sent.', ephemeral: true });
  },
};

export default command;
