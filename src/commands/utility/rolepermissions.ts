import { SlashCommandBuilder } from 'discord.js';
import { Command } from '../../types/index.js';
import { fail } from '../../utils/embeds.js';
import {
  buildRoleInfoEmbed,
  buildRoleInfoText,
  resolveRoleFromInteraction,
  wantsPlainRoleReply,
  withUserInstall,
} from '../../utils/userInstall.js';

const command: Command = {
  data: withUserInstall(
    new SlashCommandBuilder()
      .setName('rolepermissions')
      .setDescription("Show a role's permissions (only you can see this)")
      .addRoleOption((opt) =>
        opt
          .setName('role')
          .setDescription('Pick a role (works in any server via Add to My Apps)')
          .setRequired(false),
      )
      .addStringOption((opt) =>
        opt
          .setName('query')
          .setDescription('Or type a role ID / name (closest match) when the bot is in the server')
          .setRequired(false),
      ),
  ),
  guildOnly: true,
  userInstall: true,
  bypassBotLock: true,
  async execute(interaction) {
    const isPrefix = 'commandMessage' in interaction;
    const ephemeral = !isPrefix;
    const plain = wantsPlainRoleReply(interaction);

    const role = await resolveRoleFromInteraction(interaction);

    if (!role) {
      const attempted =
        interaction.options.getString('query', false) ??
        interaction.options.getString('role', false) ??
        'that';
      const tip = [
        `No role matched \`${attempted}\`.`,
        '• Use the **role picker** (works even if the bot is not in this server)',
        '• Or pass a role ID / name when the bot is in the server',
      ].join('\n');

      if (plain) {
        await interaction.reply({ content: tip, embeds: [], ephemeral });
        return;
      }

      await interaction.reply({
        embeds: [fail(interaction.user, tip)],
        ephemeral,
      });
      return;
    }

    const guildName =
      interaction.guild?.name ??
      interaction.client.guilds.cache.get(interaction.guildId!)?.name ??
      undefined;

    if (plain) {
      await interaction.reply({
        content: buildRoleInfoText(role, guildName),
        embeds: [],
        ephemeral,
      });
      return;
    }

    await interaction.reply({
      embeds: [buildRoleInfoEmbed(role, guildName)],
      ephemeral,
    });
  },
};

export default command;
