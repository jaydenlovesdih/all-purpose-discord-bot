import { SlashCommandBuilder } from 'discord.js';
import { Command } from '../../types/index.js';
import { fail, infoEmbed, ok } from '../../utils/embeds.js';
import {
  addGuildToWhitelist,
  getWhitelistedGuildIds,
  removeGuildFromWhitelist,
} from '../../utils/guildWhitelist.js';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('allowserver')
    .setDescription('Whitelist which servers the bot may join (bot owner only)')
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
    .addStringOption((opt) =>
      opt.setName('value').setDescription('Server (guild) ID for add / remove'),
    ),
  ownerOnly: true,
  async execute(interaction) {
    const sub = interaction.options.getString('subcommand', true);
    const value = interaction.options.getString('value')?.trim();

    if (sub === 'list') {
      const ids = getWhitelistedGuildIds();
      if (!ids.length) {
        await interaction.reply({
          embeds: [
            infoEmbed(
              'No servers whitelisted yet.\nExisting servers are auto-added on bot startup.\nAdd one: `allowserver add <guildId>`',
              'Server whitelist',
            ),
          ],
        });
        return;
      }

      const lines = ids.map((id, i) => {
        const g = interaction.client.guilds.cache.get(id);
        return `**${i + 1}.** \`${id}\`${g ? ` — **${g.name}**` : ' — _(not currently in)_'}`;
      });

      await interaction.reply({
        embeds: [infoEmbed(lines.join('\n'), `Server whitelist (${ids.length})`)],
      });
      return;
    }

    if (!value || !/^\d{17,20}$/.test(value)) {
      await interaction.reply({
        embeds: [
          fail(
            interaction.user,
            `Usage: \`allowserver ${sub} <guildId>\`\nCopy the server ID (Developer Mode → right-click server → Copy Server ID)`,
          ),
        ],
        ephemeral: true,
      });
      return;
    }

    if (sub === 'add') {
      const added = addGuildToWhitelist(value);
      if (!added) {
        await interaction.reply({
          embeds: [fail(interaction.user, `Server \`${value}\` is already whitelisted (or invalid)`)],
          ephemeral: true,
        });
        return;
      }
      await interaction.reply({
        embeds: [
          ok(
            interaction.user,
            `whitelisted server \`${value}\` — the bot can join/stay there now`,
          ),
        ],
      });
      return;
    }

    if (sub === 'remove') {
      const removed = removeGuildFromWhitelist(value);
      if (!removed) {
        await interaction.reply({
          embeds: [fail(interaction.user, `Server \`${value}\` was not on the whitelist`)],
          ephemeral: true,
        });
        return;
      }

      const guild = interaction.client.guilds.cache.get(value);
      let leftNote = '';
      if (guild) {
        await guild.leave().catch(() => undefined);
        leftNote = ` and left **${guild.name}**`;
      }

      await interaction.reply({
        embeds: [
          ok(interaction.user, `removed \`${value}\` from the whitelist${leftNote}`),
        ],
      });
    }
  },
};

export default command;
