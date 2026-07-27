import { SlashCommandBuilder } from 'discord.js';
import { Command } from '../../types/index.js';
import { fail } from '../../utils/embeds.js';
import {
  buildRoleInfoEmbed,
  buildRoleInfoText,
  buildRolePermComponents,
  rememberRolePermView,
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

    const roleOpt = interaction.options.getRole('role', false);
    const query = interaction.options.getString('query', false);
    const role = await resolveRoleFromInteraction(interaction);

    // No role yet — still send the dropdown (same idea as /permissionroles)
    if (!role && !roleOpt && !query?.trim()) {
      const guildName =
        interaction.guild?.name ??
        interaction.client.guilds.cache.get(interaction.guildId!)?.name ??
        'this server';
      const prompt = [
        `**Role permissions — ${guildName}**`,
        '',
        'Pick a role from the dropdown to see its permissions.',
      ].join('\n');

      const components = buildRolePermComponents(interaction.user.id, 'danger', {
        includeFilter: false,
        pickPlaceholder: 'Select a role…',
      });

      if (plain) {
        await interaction.reply({ content: prompt, embeds: [], components, ephemeral });
      } else {
        await interaction.reply({
          embeds: [fail(interaction.user, 'Pick a role from the dropdown to see its permissions.')],
          components,
          ephemeral,
        });
      }

      const message = await interaction.fetchReply();
      rememberRolePermView(message.id, {
        ownerId: interaction.user.id,
        role: null,
        guildName,
        plain,
        mode: 'danger',
      });
      return;
    }

    if (!role) {
      const attempted = query ?? 'that';
      const tip = [
        `No role matched \`${attempted}\`.`,
        '• Use the **role picker** below (works even if the bot is not in this server)',
        '• Or pass a role ID / name when the bot is in the server',
      ].join('\n');

      const components = buildRolePermComponents(interaction.user.id, 'danger', {
        includeFilter: false,
        pickPlaceholder: 'Select a role…',
      });

      if (plain) {
        await interaction.reply({ content: tip, embeds: [], components, ephemeral });
      } else {
        await interaction.reply({
          embeds: [fail(interaction.user, tip)],
          components,
          ephemeral,
        });
      }

      const message = await interaction.fetchReply();
      rememberRolePermView(message.id, {
        ownerId: interaction.user.id,
        role: null,
        guildName:
          interaction.guild?.name ??
          interaction.client.guilds.cache.get(interaction.guildId!)?.name ??
          undefined,
        plain,
        mode: 'danger',
      });
      return;
    }

    const guildName =
      interaction.guild?.name ??
      interaction.client.guilds.cache.get(interaction.guildId!)?.name ??
      undefined;

    const components = buildRolePermComponents(interaction.user.id, 'danger');

    if (plain) {
      await interaction.reply({
        content: buildRoleInfoText(role, guildName, 'danger'),
        embeds: [],
        components,
        ephemeral,
      });
    } else {
      await interaction.reply({
        embeds: [buildRoleInfoEmbed(role, guildName, 'danger')],
        components,
        ephemeral,
      });
    }

    const message = await interaction.fetchReply();
    rememberRolePermView(message.id, {
      ownerId: interaction.user.id,
      role,
      guildName,
      plain,
      mode: 'danger',
    });
  },
};

export default command;
