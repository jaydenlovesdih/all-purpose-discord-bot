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
import {
  buildCommandHelpEmbed,
  buildCommandHelpSelect,
  extractSubcommands,
} from '../utils/commandHelp.js';
import { buildRolesButtons, buildRolesEmbed } from '../utils/rolesList.js';
import { closeTicket, openTicket } from '../utils/tickets.js';
import {
  applyRoleReaction,
  pendingRoleReactions,
} from '../utils/rolereaction.js';
import {
  buildNukeDoneEmbed,
  executeNuke,
  pendingNukes,
} from '../utils/nuke.js';

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

  if (interaction.isStringSelectMenu() && interaction.customId.startsWith('help:sub:')) {
    const parts = interaction.customId.split(':');
    // help:sub:<command>:<ownerId>
    const commandName = parts[2];
    const ownerId = parts[3];
    if (ownerId && ownerId !== interaction.user.id) {
      await interaction.reply({
        embeds: [fail(interaction.user, 'Only the person who ran help can use this menu')],
        ephemeral: true,
      });
      return true;
    }

    const command = client.commands.get(commandName);
    if (!command) {
      await interaction.reply({ embeds: [fail(interaction.user, 'Command not found')], ephemeral: true });
      return true;
    }

    const prefix = getPrefix(interaction.guildId, config.prefix);
    const sub = interaction.values[0];
    const embed = buildCommandHelpEmbed(command, prefix, {
      sub,
      botName: interaction.client.user?.username,
    });
    const select = buildCommandHelpSelect(command.data.name, extractSubcommands(command), interaction.user.id);

    await interaction.update({
      embeds: [embed],
      components: select ? [select] : [],
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

  if (interaction.isButton() && interaction.customId.startsWith('rolereaction:')) {
    if (!interaction.inGuild()) return true;

    const pending = pendingRoleReactions.get(interaction.message.id);
    if (!pending) {
      await interaction.reply({
        embeds: [fail(interaction.user, 'This confirmation expired — run the command again')],
        ephemeral: true,
      });
      return true;
    }

    if (!canBypass(interaction.user.id) || interaction.user.id !== pending.ownerId) {
      await interaction.reply({
        embeds: [fail(interaction.user, 'Only the bot owner who ran this command can confirm it')],
        ephemeral: true,
      });
      return true;
    }

    if (interaction.customId === 'rolereaction:cancel') {
      pendingRoleReactions.delete(interaction.message.id);
      await interaction.update({
        embeds: [
          EmbedBuilder.from(interaction.message.embeds[0] ?? {}).setDescription(
            '❌ **Cancelled** — no roles were assigned.',
          ),
        ],
        components: [],
      });
      return true;
    }

    if (interaction.customId === 'rolereaction:confirm') {
      await interaction.deferUpdate();
      pendingRoleReactions.delete(interaction.message.id);

      const guild = interaction.guild!;
      const role = guild.roles.cache.get(pending.roleId);
      if (!role) {
        await interaction.editReply({
          embeds: [fail(interaction.user, 'Role no longer exists')],
          components: [],
        });
        return true;
      }

      await interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setColor(Colors.success)
            .setTitle('🎭 Role Reaction')
            .setDescription('Assigning roles… this can take a few minutes for large lists.')
            .setTimestamp(),
        ],
        components: [],
      });

      const result = await applyRoleReaction(
        guild,
        pending.roleId,
        pending.userIds,
        async ({ processed, total, success, failed, skipped }) => {
          await interaction.editReply({
            embeds: [
              new EmbedBuilder()
                .setColor(Colors.success)
                .setTitle('🎭 Role Reaction In Progress')
                .setDescription(
                  [
                    `Assigning ${role}…`,
                    '',
                    `**Progress:** ${processed}/${total}`,
                    `✅ Added so far: **${success}**`,
                    `⏭️ Skipped: **${skipped}**`,
                    `❌ Failed so far: **${failed}**`,
                  ].join('\n'),
                )
                .setTimestamp(),
            ],
            components: [],
          });
        },
      );

      await interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setColor(Colors.success)
            .setTitle('🎭 Role Reaction Complete')
            .setDescription(
              [
                `Assigned ${role} to reactors on image messages in <#${pending.channelId}>.`,
                '',
                `✅ **Added:** ${result.success}`,
                `⏭️ **Already had / left:** ${result.skipped}`,
                `❌ **Failed:** ${result.failed}`,
                '',
                `**Image messages scanned:** ${pending.imageCount}`,
                `**Unique reactors:** ${pending.userIds.length}`,
              ].join('\n'),
            )
            .setTimestamp(),
        ],
        components: [],
      });
      return true;
    }
  }

  if (interaction.isButton() && interaction.customId.startsWith('nuke:')) {
    if (!interaction.inGuild()) return true;

    const pending = pendingNukes.get(interaction.message.id);
    if (!pending) {
      await interaction.reply({
        embeds: [fail(interaction.user, 'This nuke confirmation expired — run the command again')],
        ephemeral: true,
      });
      return true;
    }

    if (!canBypass(interaction.user.id) || interaction.user.id !== pending.ownerId) {
      await interaction.reply({
        embeds: [fail(interaction.user, 'Only the bot owner who ran this command can use these buttons')],
        ephemeral: true,
      });
      return true;
    }

    if (interaction.customId === 'nuke:cancel') {
      pending.cancelled = true;
      if (pending.timer) clearInterval(pending.timer as ReturnType<typeof setInterval>);
      pendingNukes.delete(interaction.message.id);

      await interaction.update({
        embeds: [
          new EmbedBuilder()
            .setColor(Colors.error)
            .setTitle('💣 Nuke Cancelled')
            .setDescription(`Cancelled — **#${pending.channelName}** was not nuked.`),
        ],
        components: [],
      });
      return true;
    }

    if (interaction.customId === 'nuke:confirm') {
      if (pending.timer) {
        await interaction.reply({
          embeds: [fail(interaction.user, 'Countdown already started')],
          ephemeral: true,
        });
        return true;
      }

      let secondsLeft = 3;

      const countdownEmbed = (secs: number) =>
        new EmbedBuilder()
          .setColor(Colors.error)
          .setTitle('💣 Nuking in…')
          .setDescription(
            [
              `Channel: <#${pending.channelId}> (\`#${pending.channelName}\`)`,
              '',
              `**${secs}** second${secs === 1 ? '' : 's'} remaining`,
              '',
              'Press **Cancel** to abort.',
            ].join('\n'),
          )
          .setTimestamp();

      const cancelRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId('nuke:cancel')
          .setLabel('Cancel')
          .setEmoji('❌')
          .setStyle(ButtonStyle.Secondary),
      );

      await interaction.update({
        embeds: [countdownEmbed(secondsLeft)],
        components: [cancelRow],
      });

      const messageId = interaction.message.id;
      const guild = interaction.guild!;

      pending.timer = setInterval(async () => {
        const state = pendingNukes.get(messageId);
        if (!state || state.cancelled) {
          if (state?.timer) clearInterval(state.timer as ReturnType<typeof setInterval>);
          pendingNukes.delete(messageId);
          return;
        }

        secondsLeft -= 1;

        if (secondsLeft > 0) {
          await interaction.message
            .edit({
              embeds: [countdownEmbed(secondsLeft)],
              components: [cancelRow],
            })
            .catch(() => undefined);
          return;
        }

        clearInterval(state.timer as ReturnType<typeof setInterval>);
        pendingNukes.delete(messageId);

        if (state.cancelled) return;

        await interaction.message
          .edit({
            embeds: [
              new EmbedBuilder()
                .setColor(Colors.error)
                .setTitle('💣 Nuking…')
                .setDescription(`Deleting and recreating **#${state.channelName}**…`),
            ],
            components: [],
          })
          .catch(() => undefined);

        try {
          const result = await executeNuke(guild, state.channelId, interaction.user);
          if ('error' in result) {
            await interaction.message
              .edit({
                embeds: [fail(interaction.user, result.error)],
                components: [],
              })
              .catch(() => undefined);
            return;
          }

          const done = buildNukeDoneEmbed(
            result.name,
            result.parentId,
            result.overwriteCount,
            interaction.user,
          );

          if (result.channel.isTextBased() && result.channel.isSendable()) {
            await result.channel.send({ embeds: [done] }).catch(() => undefined);
          }

          // Original confirm message dies with the channel if nuking current channel
          await interaction.message
            .edit({
              embeds: [ok(interaction.user, `nuked and recreated <#${result.channel.id}>`)],
              components: [],
            })
            .catch(() => undefined);
        } catch (error) {
          const msg = error instanceof Error ? error.message : 'Unknown error';
          await interaction.message
            .edit({
              embeds: [fail(interaction.user, `Nuke failed: ${msg}`)],
              components: [],
            })
            .catch(() => undefined);
        }
      }, 1000);

      return true;
    }
  }

  if (interaction.isButton() && interaction.customId.startsWith('ticket:')) {
    if (!interaction.inGuild()) return true;
    const parts = interaction.customId.split(':');
    const action = parts[1];
    const guild = interaction.guild!;

    if (action === 'open') {
      await interaction.deferReply({ ephemeral: true });
      const result = await openTicket(guild, interaction.user);
      if ('error' in result) {
        await interaction.editReply({ embeds: [fail(interaction.user, result.error)] });
        return true;
      }
      await interaction.editReply({
        embeds: [ok(interaction.user, `your ticket was created: ${result.channel}`)],
      });
      return true;
    }

    if (action === 'close') {
      const channelId = parts[2];
      const channel = guild.channels.cache.get(channelId);
      if (!channel?.isTextBased() || channel.isDMBased()) {
        await interaction.reply({ embeds: [fail(interaction.user, 'Ticket channel not found')], ephemeral: true });
        return true;
      }

      const result = await closeTicket(channel as import('discord.js').TextChannel, interaction.user);
      if ('error' in result) {
        await interaction.reply({ embeds: [fail(interaction.user, result.error)], ephemeral: true });
        return true;
      }

      await interaction.reply({ embeds: [ok(interaction.user, 'closing ticket…')], ephemeral: true });
      return true;
    }
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
      if (modAction === 'dnr' || modAction === 'undnr') {
        const protectorId = parts[3];
        const targetId = parts[4];
        const modal = new ModalBuilder()
          .setCustomId(`modaledit:${modAction}:${protectorId}:${targetId}`)
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

    if (action === 'undnr') {
      const protectorId = parts[2];
      const targetId = parts[3];
      const { removeDnr, getDnr } = await import('../utils/dnr.js');
      const existing = getDnr(guild.id, protectorId, targetId);
      if (!existing) {
        await interaction.reply({ embeds: [fail(interaction.user, 'No active DNR found')], ephemeral: true });
        return true;
      }
      // Only the protector (or bypass) can remove their DNR via button
      if (interaction.user.id !== protectorId && !canBypass(interaction.user.id)) {
        await interaction.reply({
          embeds: [fail(interaction.user, 'Only the person who set this DNR can remove it')],
          ephemeral: true,
        });
        return true;
      }
      removeDnr(guild.id, protectorId, targetId);
      const user = await interaction.client.users.fetch(targetId).catch(() => null);
      if (!user) {
        await interaction.reply({ embeds: [fail(interaction.user, 'User not found')], ephemeral: true });
        return true;
      }
      const member = await guild.members.fetch(targetId).catch(() => null);
      const embed = buildModEmbed({
        action: 'undnr',
        target: user,
        moderator: interaction.user,
        reason: `Removed by ${interaction.user.tag}`,
        member,
        botName: interaction.client.user?.username,
        detail: { name: '🚫 Was protecting:', value: `<@${protectorId}>` },
      });
      const row = buildModButtons('undnr', targetId, { protectorId });
      await interaction.update({
        embeds: [embed],
        components: row ? [row] : [],
      });
      return true;
    }

    if (action === 'dnr') {
      const protectorId = parts[2];
      const targetId = parts[3];
      if (interaction.user.id !== protectorId && !canBypass(interaction.user.id)) {
        await interaction.reply({
          embeds: [fail(interaction.user, 'Only the protected user can re-apply this DNR')],
          ephemeral: true,
        });
        return true;
      }
      const { setDnr } = await import('../utils/dnr.js');
      const reasonField = interaction.message.embeds[0]?.fields?.find((f) => f.name.includes('Reason'));
      const reason = reasonField?.value ?? 'No reason provided';
      setDnr(guild.id, protectorId, targetId, reason, interaction.user.id);
      const user = await interaction.client.users.fetch(targetId).catch(() => null);
      if (!user) {
        await interaction.reply({ embeds: [fail(interaction.user, 'User not found')], ephemeral: true });
        return true;
      }
      const member = await guild.members.fetch(targetId).catch(() => null);
      const embed = buildModEmbed({
        action: 'dnr',
        target: user,
        moderator: interaction.user,
        reason,
        member,
        botName: interaction.client.user?.username,
        detail: { name: '🚫 Protecting:', value: `<@${protectorId}>` },
      });
      const row = buildModButtons('dnr', targetId, { protectorId });
      await interaction.update({
        embeds: [embed],
        components: row ? [row] : [],
      });
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
    const parts = interaction.customId.split(':');
    const modAction = parts[1];
    const reason = interaction.fields.getTextInputValue('reason');
    const message = interaction.message;

    if (modAction === 'dnr' || modAction === 'undnr') {
      const protectorId = parts[2];
      const targetId = parts[3];
      if (modAction === 'dnr') {
        const { updateDnrReason } = await import('../utils/dnr.js');
        updateDnrReason(interaction.guildId!, protectorId, targetId, reason);
      }
      if (message && 'edit' in message && message.embeds[0]) {
        const builder = EmbedBuilder.from(message.embeds[0]);
        const fields = message.embeds[0].fields.map((f) =>
          f.name.includes('Reason') ? { ...f, value: reason } : f,
        );
        builder.setFields(fields);
        await message.edit({ embeds: [builder] });
      }
      await interaction.reply({
        embeds: [ok(interaction.user, `updated **${modAction}** reason for <@${targetId}>`)],
        ephemeral: true,
      });
      return true;
    }

    const userId = parts[2];
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
