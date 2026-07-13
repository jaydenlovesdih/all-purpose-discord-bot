import { PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import { Command } from '../../types/index.js';
import { getGuildConfig, mutateGuildConfig } from '../../utils/guildConfig.js';
import { successEmbed, errorEmbed, infoEmbed } from '../../utils/embeds.js';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('autoresponder')
    .setDescription('Auto-respond to message triggers')
    .addStringOption((opt) =>
      opt
        .setName('subcommand')
        .setDescription('Action')
        .setRequired(true)
        .addChoices(
          { name: 'add', value: 'add' },
          { name: 'remove', value: 'remove' },
          { name: 'list', value: 'list' },
          { name: 'clear', value: 'clear' },
        ),
    )
    .addStringOption((opt) => opt.setName('trigger').setDescription('Trigger text'))
    .addStringOption((opt) => opt.setName('response').setDescription('Response text'))
    .addBooleanOption((opt) => opt.setName('exact').setDescription('Require exact match')),
  permissions: [PermissionFlagsBits.ManageGuild],
  guildOnly: true,
  async execute(interaction) {
    const sub = interaction.options.getString('subcommand', true);
    const trigger = interaction.options.getString('trigger');
    const response = interaction.options.getString('response');
    const exact = interaction.options.getBoolean('exact') ?? false;
    const guildId = interaction.guildId!;

    if (sub === 'list') {
      const list = getGuildConfig(guildId).autoresponders;
      await interaction.reply({
        embeds: [
          infoEmbed(
            list.length
              ? list.map((e, i) => `**#${i + 1}** \`${e.trigger}\` → ${e.response} (${e.exact ? 'exact' : 'includes'})`).join('\n')
              : 'No autoresponders.',
            'Autoresponders',
          ),
        ],
      });
      return;
    }

    if (sub === 'clear') {
      mutateGuildConfig(guildId, (c) => {
        c.autoresponders = [];
      });
      await interaction.reply({ embeds: [successEmbed('Cleared autoresponders.')] });
      return;
    }

    if (sub === 'remove') {
      if (!trigger) {
        await interaction.reply({ embeds: [errorEmbed('Provide trigger to remove.')], ephemeral: true });
        return;
      }
      mutateGuildConfig(guildId, (c) => {
        c.autoresponders = c.autoresponders.filter((e) => e.trigger.toLowerCase() !== trigger.toLowerCase());
      });
      await interaction.reply({ embeds: [successEmbed(`Removed trigger \`${trigger}\``)] });
      return;
    }

    if (!trigger || !response) {
      await interaction.reply({ embeds: [errorEmbed('Provide trigger and response.')], ephemeral: true });
      return;
    }

    mutateGuildConfig(guildId, (c) => {
      c.autoresponders = c.autoresponders.filter((e) => e.trigger.toLowerCase() !== trigger.toLowerCase());
      c.autoresponders.push({ trigger, response, exact });
    });
    await interaction.reply({ embeds: [successEmbed(`Autoresponder set for \`${trigger}\``)] });
  },
};

export default command;
