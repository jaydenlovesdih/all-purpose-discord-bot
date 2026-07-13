import { PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import { Command } from '../../types/index.js';
import { getGuildConfig, mutateGuildConfig } from '../../utils/guildConfig.js';
import { successEmbed, errorEmbed, infoEmbed } from '../../utils/embeds.js';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('alias')
    .setDescription('Create command aliases')
    .addStringOption((opt) =>
      opt
        .setName('subcommand')
        .setDescription('Action')
        .setRequired(true)
        .addChoices(
          { name: 'add', value: 'add' },
          { name: 'remove', value: 'remove' },
          { name: 'list', value: 'list' },
        ),
    )
    .addStringOption((opt) => opt.setName('alias').setDescription('Alias name'))
    .addStringOption((opt) => opt.setName('command').setDescription('Target command name')),
  permissions: [PermissionFlagsBits.ManageGuild],
  guildOnly: true,
  async execute(interaction, client) {
    const sub = interaction.options.getString('subcommand', true);
    const alias = interaction.options.getString('alias')?.toLowerCase();
    const target = interaction.options.getString('command')?.toLowerCase();
    const guildId = interaction.guildId!;

    if (sub === 'list') {
      const aliases = getGuildConfig(guildId).aliases;
      const lines = Object.entries(aliases).map(([a, c]) => `\`${a}\` → \`${c}\``);
      await interaction.reply({
        embeds: [infoEmbed(lines.length ? lines.join('\n') : 'No aliases.', 'Aliases')],
      });
      return;
    }

    if (!alias) {
      await interaction.reply({ embeds: [errorEmbed('Provide an alias.')], ephemeral: true });
      return;
    }

    if (sub === 'remove') {
      mutateGuildConfig(guildId, (c) => {
        delete c.aliases[alias];
      });
      await interaction.reply({ embeds: [successEmbed(`Removed alias \`${alias}\``)] });
      return;
    }

    if (!target || !client.commands.has(target)) {
      await interaction.reply({ embeds: [errorEmbed('Provide a valid target command name.')], ephemeral: true });
      return;
    }

    mutateGuildConfig(guildId, (c) => {
      c.aliases[alias] = target;
    });
    await interaction.reply({ embeds: [successEmbed(`Alias \`${alias}\` → \`${target}\``)] });
  },
};

export default command;
