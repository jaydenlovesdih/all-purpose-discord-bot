import { inspect } from 'node:util';
import { SlashCommandBuilder } from 'discord.js';
import { Command } from '../../types/index.js';
import { truncate } from '../../utils/permissions.js';
import { infoEmbed, errorEmbed } from '../../utils/embeds.js';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('eval')
    .setDescription('Evaluate JavaScript code (owner only)')
    .addStringOption((opt) => opt.setName('code').setDescription('Code to evaluate').setRequired(true)),
  ownerOnly: true,
  async execute(interaction) {
    const code = interaction.options.getString('code', true);

    await interaction.deferReply({ ephemeral: true });

    try {
      let result: unknown = eval(code);
      if (result instanceof Promise) result = await result;

      const output = truncate(
        typeof result === 'string' ? result : inspect(result, { depth: 1 }),
        1900,
      );

      await interaction.editReply({
        embeds: [infoEmbed(`\`\`\`js\n${output}\n\`\`\``, 'Eval Result')],
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await interaction.editReply({ embeds: [errorEmbed(`\`\`\`\n${message}\n\`\`\``)] });
    }
  },
};

export default command;
