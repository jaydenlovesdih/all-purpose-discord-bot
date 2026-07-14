import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  ModalBuilder,
  PermissionFlagsBits,
  StringSelectMenuBuilder,
  TextInputBuilder,
  TextInputStyle,
} from 'discord.js';
import { BotClient } from '../types/index.js';
import { runCommand } from './commandRunner.js';
import { getGuildConfig, mutateGuildConfig } from '../utils/guildConfig.js';
import { canBypass } from '../utils/permissions.js';
import { usageEmbed, ModActionType, buildModButtons, buildModEmbed } from '../utils/modResponse.js';
import { ok, fail, Colors } from '../utils/embeds.js';
import { PrefixCommandInteraction } from '../utils/prefixInteraction.js';
import { getPrefix } from '../utils/setup.js';
import { config } from '../config.js';
import { buildUsageExample, buildUsageLine } from '../utils/usage.js';
import {
  buildHelpButtons,
  buildHelpEmbed,
  HelpCategoryId,
  HELP_CATEGORIES,
} from '../utils/helpMenu.js';
import { buildRolesButtons, buildRolesEmbed } from '../utils/rolesList.js';

const pendingSuggestArgs = new Map<
  string,
  { userId: string; args: string; prefix: string; source: import('discord.js').Message }
>();

const pollVotes = new Map<string, { yes: Set<string>; no: Set<string>; ownerId: string }>();

export function rememberSuggestion(
  messageId: string,
  userId: string,
  args: string,
  prefix: string,
  source: import('discord.js').Message,
): void {
  pendingSuggestArgs.set(messageId, { userId, args, prefix, source });
  setTimeout(() => pendingSuggestArgs.delete(messageId), 5 * 60_000);
}

async function ensureMod(
  interaction:
    | import('discord.js').ButtonInteraction
    | import('discord.js').ModalSubmitInteraction,
): Promise<boolean> {
  if (canBypass(interaction.user.id)) return true;
  const member =
    interaction.guild?.members.cache.get(interaction.user.id) ??
    (await interaction.guild?.members.fetch(interaction.user.id).catch(() => null));
  if (
    !member?.permissions.any([
      PermissionFlagsBits.BanMembers,
      PermissionFlagsBits.ModerateMembers,
      PermissionFlagsBits.KickMembers,
      PermissionFlagsBits.ManageRoles,
    ])
  ) {
    await interaction.reply({
      embeds: [fail(interaction.user, 'You do not have permission to use this')],
      ephemeral: true,
    });
    return false;
  }
  return true;
}

export function suggestionComponents(
  commands: string[],
): ActionRowBuilder<StringSelectMenuBuilder | ButtonBuilder>[] {
  const select = new StringSelectMenuBuilder()
    .setCustomId('suggest:pick')
    .setPlaceholder('Pick the command to run...')
    .addOptions(
      commands.slice(0, 25).map((name) => ({
        label: name,
        value: name,
        description: `Use ${name}`,
      })),
    );

  return [
    new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(select),
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId('suggest:no').setLabel('No').setStyle(ButtonStyle.Secondary),
    ),
  ];
}

export async function handleComponent(
  interaction: import('discord.js').Interaction,
  client: BotClient,
): Promise<boolean> {
  if (interaction.isButton() && interaction.customId.startsWith('help:')) {
    const parts = interaction.customId.split(':');
    const kind = parts[1];
    const ownerId = parts.at(-1);
    if (ownerId && ownerId !== interaction.user.id) {
      await interaction.reply({
        embeds: [fail(interaction.user, 'Only the person who ran help can use these buttons')],
        ephemeral: true,
      });
      return true;
    }

    const prefix = getPrefix(interaction.guildId, config.prefix);
    let category: HelpCategoryId = 'info';
    let page = 0;

    if (kind === 'cat') {
      category = parts[2] as HelpCategoryId;
      if (!HELP_CATEGORIES.some((c) => c.id === category)) category = 'info';
      page = 0;
    } else if (kind === 'page') {
      const dir = parts[2];
      category = parts[3] as HelpCategoryId;
      page = Number(parts[4]) || 0;
      if (dir === 'prev') page -= 1;
      if (dir === 'next') page += 1;
    }

    const { embed, page: safePage, totalPages } = buildHelpEmbed(client, prefix, category, page);
    await interaction.update({
      embeds: [embed],
      components: buildHelpButtons(category, safePage, totalPages, interaction.user.id),
    });
    return true;
  }

  if (interaction.isButton() && interaction.customId.startsWith('roles:')) {
    const parts = interaction.customId.split(':');
    const ownerId = parts.at(-1);
    if (ownerId && ownerId !== interaction.user.id) {
      await interaction.reply({
        embeds: [fail(interaction.user, 'Only the person who ran roles can use these buttons')],
        ephemeral: true,
      });
      return true;
    }
    if (!interaction.guild) return true;

    let page = Number(parts[3]) || 0;
    const dir = parts[2];
    if (dir === 'prev') page -= 1;
    if (dir === 'next') page += 1;

    const { embed, page: safePage, totalPages } = buildRolesEmbed(interaction.guild, page);
    await interaction.update({
      embeds: [embed],
      components: buildRolesButtons(safePage, totalPages, interaction.user.id),
    });
    return true;
  }

  if (interaction.isButton() && interaction.customId === 'suggest:no') {
    await interaction.update({ content: 'Cancelled.', embeds: [], components: [] });
    return true;
  }

  if (interaction.isStringSelectMenu() && interaction.customId === 'suggest:pick') {
    const chosen = interaction.values[0];
    const pending = pendingSuggestArgs.get(interaction.message.id);
    if (pending && pending.userId !== interaction.user.id) {
      await interaction.reply({ content: 'Only the command author can use this menu.', ephemeral: true });
      return true;
    }

    const prefix =
      pending?.prefix ?? getPrefix(interaction.guildId ?? undefined, config.prefix);
    const command = client.commands.get(chosen);
    pendingSuggestArgs.delete(interaction.message.id);

    await interaction.update({
      embeds: [
        new EmbedBuilder()
          .setColor(Colors.success)
          .setDescription(`Running **${prefix}${chosen}**…`),
      ],
      components: [],
    });

    if (pending?.source && command) {
      try {
        const fake = new PrefixCommandInteraction(pending.source, chosen, pending.args);
        await runCommand(fake, client);
        await interaction.message.delete().catch(() => undefined);
        return true;
      } catch (error) {
        if (error instanceof Error && error.message.startsWith('Missing required')) {
          await interaction.editReply({
            embeds: [
              usageEmbed(chosen, buildUsageLine(chosen, prefix), prefix),
            ],
            components: [
              new ActionRowBuilder<ButtonBuilder>().addComponents(
                new ButtonBuilder()
                  .setCustomId('suggest:no')
                  .setLabel('Dismiss')
                  .setStyle(ButtonStyle.Secondary),
              ),
            ],
          });
          return true;
        }
      }
    }

    await interaction.editReply({
      embeds: [
        new EmbedBuilder()
          .setColor(Colors.error)
          .setTitle(`Selected \`${prefix}${chosen}\``)
          .setDescription(
            `${command?.data.description ?? 'Command'}\n\n**Usage**\n\`${buildUsageLine(chosen, prefix)}\`\n\n**Example**\n\`${buildUsageExample(chosen, prefix)}\``,
          ),
      ],
      components: [
        new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder().setCustomId('suggest:no').setLabel('Dismiss').setStyle(ButtonStyle.Secondary),
        ),
      ],
    });
    return true;
  }

  if (interaction.isButton() && interaction.customId.startsWith('mod:')) {
    if (!interaction.inGuild() || !(await ensureMod(interaction))) return true;
    const parts = interaction.customId.split(':');
    const action = parts[1];
    const guild = interaction.guild!;

    if (action === 'unban') {
      const userId = parts[2];
      try {
        const user = await interaction.client.users.fetch(userId);
        await guild.members.unban(userId, `Unbanned by ${interaction.user.tag}`);
        mutateGuildConfig(guild.id, (c) => {
          c.hardbans = c.hardbans.filter((id) => id !== userId);
        });
        const embed = buildModEmbed({
          action: 'unban',
          target: user,
          moderator: interaction.user,
          reason: `Unbanned by ${interaction.user.tag}`,
          botName: interaction.client.user?.username,
        });
        const row = buildModButtons('unban', userId);
        await interaction.update({
          embeds: [embed],
          components: row ? [row] : [],
        });
      } catch {
        await interaction.reply({ embeds: [fail(interaction.user, 'Could not unban that user')], ephemeral: true });
      }
      return true;
    }

    if (action === 'ban') {
      const userId = parts[2];
      try {
        const user = await interaction.client.users.fetch(userId);
        await guild.members.ban(userId, { reason: `Banned by ${interaction.user.tag}` });
        const embed = buildModEmbed({
          action: 'ban',
          target: user,
          moderator: interaction.user,
          reason: `Banned by ${interaction.user.tag}`,
          botName: interaction.client.user?.username,
        });
        const row = buildModButtons('ban', userId);
        await interaction.update({
          embeds: [embed],
          components: row ? [row] : [],
        });
      } catch {
        await interaction.reply({ embeds: [fail(interaction.user, 'Could not ban that user')], ephemeral: true });
      }
      return true;
    }

    if (action === 'unmute') {
      const userId = parts[2];
      const member = await guild.members.fetch(userId).catch(() => null);
      if (!member) {
        await interaction.reply({ embeds: [fail(interaction.user, 'Member not found')], ephemeral: true });
        return true;
      }
      await member.timeout(null, `Unmuted by ${interaction.user.tag}`);
      const embed = buildModEmbed({
        action: 'unmute',
        target: member.user,
        moderator: interaction.user,
        reason: `Unmuted by ${interaction.user.tag}`,
        member,
        botName: interaction.client.user?.username,
      });
      const row = buildModButtons('unmute', userId);
      await interaction.update({
        embeds: [embed],
        components: row ? [row] : [],
      });
      return true;
    }

    if (action === 'unjail') {
      const userId = parts[2];
      const cfg = getGuildConfig(guild.id);
      const member = await guild.members.fetch(userId).catch(() => null);
      if (!member || !cfg.jailRoleId) {
        await interaction.reply({ embeds: [fail(interaction.user, 'Could not unjail member')], ephemeral: true });
        return true;
      }
      const previous = cfg.jailedRoles[userId] ?? [];
      await member.roles.remove(cfg.jailRoleId, 'Unjail button');
      if (previous.length) await member.roles.add(previous).catch(() => undefined);
      mutateGuildConfig(guild.id, (c) => {
        delete c.jailedRoles[userId];
      });
      const embed = buildModEmbed({
        action: 'unjail',
        target: member.user,
        moderator: interaction.user,
        reason: `Unjailed by ${interaction.user.tag}`,
        member,
        botName: interaction.client.user?.username,
      });
      const row = buildModButtons('unjail', userId);
      await interaction.update({
        embeds: [embed],
        components: row ? [row] : [],
      });
      return true;
    }

    if (action === 'edit') {
      const modAction = parts[2] as ModActionType;
      const userId = parts[3];
      const modal = new ModalBuilder()
        .setCustomId(`modaledit:${modAction}:${userId}`)
        .setTitle('Edit Reason')
        .addComponents(
          new ActionRowBuilder<TextInputBuilder>().addComponents(
            new TextInputBuilder()
              .setCustomId('reason')
              .setLabel('New reason')
              .setStyle(TextInputStyle.Paragraph)
              .setRequired(true)
              .setMaxLength(500),
          ),
        );
      await interaction.showModal(modal);
      return true;
    }

    if (action === 'clearwarns') {
      const userId = parts[2];
      const { clearWarnings } = await import('../utils/warnings.js');
      const count = clearWarnings(guild.id, userId);
      const user = await interaction.client.users.fetch(userId).catch(() => null);
      if (!user) {
        await interaction.reply({ embeds: [fail(interaction.user, 'User not found')], ephemeral: true });
        return true;
      }
      const member = await guild.members.fetch(userId).catch(() => null);
      const embed = buildModEmbed({
        action: 'clearwarnings',
        target: user,
        moderator: interaction.user,
        reason: `Cleared by ${interaction.user.tag}`,
        member,
        extraLine: `Cleared **${count}** warning(s).`,
        botName: interaction.client.user?.username,
      });
      const row = buildModButtons('clearwarnings', userId);
      await interaction.update({
        embeds: [embed],
        components: row ? [row] : [],
      });
      return true;
    }
  }

  if (interaction.isButton() && interaction.customId.startsWith('poll:')) {
    const parts = interaction.customId.split(':');
    const vote = parts[1];
    const msgId = interaction.message.id;
    if (!pollVotes.has(msgId)) {
      pollVotes.set(msgId, {
        yes: new Set(),
        no: new Set(),
        ownerId: parts[2] ?? interaction.message.interactionMetadata?.user?.id ?? '',
      });
    }
    const state = pollVotes.get(msgId)!;
    if (parts[2] && !state.ownerId) state.ownerId = parts[2];

    if (vote === 'end') {
      const ownerId = parts[2] || state.ownerId;
      const canEnd =
        canBypass(interaction.user.id) ||
        interaction.user.id === ownerId ||
        interaction.memberPermissions?.has(PermissionFlagsBits.ManageMessages);
      if (!canEnd) {
        await interaction.reply({ embeds: [fail(interaction.user, 'Only the poll author can end this')], ephemeral: true });
        return true;
      }
      await interaction.update({
        components: [],
        embeds: [
          EmbedBuilder.from(interaction.message.embeds[0]).setFooter({
            text: `Poll ended • Yes ${state.yes.size} / No ${state.no.size}`,
          }),
        ],
      });
      pollVotes.delete(msgId);
      return true;
    }

    state.yes.delete(interaction.user.id);
    state.no.delete(interaction.user.id);
    if (vote === 'yes') state.yes.add(interaction.user.id);
    if (vote === 'no') state.no.add(interaction.user.id);

    const base = interaction.message.embeds[0];
    const question = base?.description?.split('\n')[0]?.replace(/\*\*/g, '') ?? 'Poll';
    const embed = EmbedBuilder.from(base ?? {}).setDescription(
      `**${question}**\n\n✅ Yes: **${state.yes.size}**\n❌ No: **${state.no.size}**`,
    );

    const endCustomId = `poll:end:${state.ownerId || 'unknown'}`;

    await interaction.update({
      embeds: [embed],
      components: [
        new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder()
            .setCustomId('poll:yes')
            .setLabel(`Yes (${state.yes.size})`)
            .setEmoji('✅')
            .setStyle(ButtonStyle.Success),
          new ButtonBuilder()
            .setCustomId('poll:no')
            .setLabel(`No (${state.no.size})`)
            .setEmoji('❌')
            .setStyle(ButtonStyle.Danger),
          new ButtonBuilder()
            .setCustomId(endCustomId)
            .setLabel('End Poll')
            .setStyle(ButtonStyle.Secondary),
        ),
      ],
    });
    return true;
  }

  if (interaction.isButton() && interaction.customId.startsWith('gw:')) {
    const action = interaction.customId.split(':')[1];
    const guildId = interaction.guildId;
    if (!guildId) return true;
    const cfg = getGuildConfig(guildId);
    const g = cfg.giveaways[interaction.message.id];
    if (!g || g.ended) {
      await interaction.reply({ embeds: [fail(interaction.user, 'This giveaway has ended')], ephemeral: true });
      return true;
    }

    if (action === 'end') {
      if (interaction.user.id !== g.hostId && !canBypass(interaction.user.id)) {
        await interaction.reply({ embeds: [fail(interaction.user, 'Only the host can end this')], ephemeral: true });
        return true;
      }
      const { endGiveaway } = await import('../commands/utility/giveaway.js');
      await endGiveaway(guildId, interaction.message);
      await interaction.deferUpdate();
      return true;
    }

    if (action === 'enter') {
      const entrants = g.entrants ?? [];
      if (entrants.includes(interaction.user.id)) {
        await interaction.reply({ embeds: [fail(interaction.user, 'You already entered')], ephemeral: true });
        return true;
      }
      mutateGuildConfig(guildId, (c) => {
        const entry = c.giveaways[interaction.message.id];
        if (!entry) return;
        if (!entry.entrants) entry.entrants = [];
        entry.entrants.push(interaction.user.id);
      });
      const count = (getGuildConfig(guildId).giveaways[interaction.message.id].entrants ?? []).length;
      const embed = EmbedBuilder.from(interaction.message.embeds[0]);
      const desc = embed.data.description ?? '';
      embed.setDescription(desc.replace(/\*\*Entries:\*\* \d+/, `**Entries:** ${count}`));
      await interaction.update({ embeds: [embed] });
      return true;
    }
  }

  if (interaction.isModalSubmit() && interaction.customId.startsWith('modaledit:')) {
    if (!(await ensureMod(interaction))) return true;
    const [, modAction, userId] = interaction.customId.split(':');
    const reason = interaction.fields.getTextInputValue('reason');
    const message = interaction.message;

    if (message && 'edit' in message && message.embeds[0]) {
      const builder = EmbedBuilder.from(message.embeds[0]);
      const fields = message.embeds[0].fields.map((f) =>
        f.name.includes('Reason') ? { ...f, value: reason } : f,
      );
      builder.setFields(fields);
      await message.edit({ embeds: [builder] });
    }

    await interaction.reply({
      embeds: [ok(interaction.user, `updated **${modAction}** reason for <@${userId}>`)],
      ephemeral: true,
    });
    return true;
  }

  return false;
}
