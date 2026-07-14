import { EmbedBuilder, PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import { Command } from '../../types/index.js';
import { runServerSetup } from '../../utils/setup.js';
import { Colors, fail } from '../../utils/embeds.js';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('setup')
    .setDescription('Create Blaze mod category, dedicated log channels, jail, and mute role'),
  permissions: [PermissionFlagsBits.Administrator],
  guildOnly: true,
  async execute(interaction) {
    await interaction.deferReply();
    try {
      const summary = await runServerSetup(interaction.guild!);
      await interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setColor(Colors.success)
            .setTitle('⚙️ Setup Complete')
            .setDescription(summary)
            .setFooter({ text: interaction.client.user?.username ?? 'Blaze' })
            .setTimestamp(),
        ],
      });
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      await interaction.editReply({ embeds: [fail(interaction.user, msg)] });
    }
  },
};

export default command;
