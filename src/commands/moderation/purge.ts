import {
  Message,
  PermissionFlagsBits,
  SlashCommandBuilder,
  TextChannel,
} from 'discord.js';
import { Command } from '../../types/index.js';
import { fail } from '../../utils/embeds.js';
import { buildPurgeEmbed } from '../../utils/modResponse.js';
import { sendModLog } from '../../utils/moderation.js';
import { sendPurgeMessageHistory, type PurgedMessageSnapshot } from '../../utils/log.js';
import { PrefixCommandInteraction } from '../../utils/prefixInteraction.js';

const MAX_AMOUNT = 1000;
const TWO_WEEKS_MS = 14 * 24 * 60 * 60 * 1000;

function snapshotMessage(msg: Message): PurgedMessageSnapshot {
  return {
    authorId: msg.author.id,
    authorTag: msg.author.tag,
    content: msg.content || '',
    createdTimestamp: msg.createdTimestamp,
    attachments: [...msg.attachments.values()].map((a) => a.url),
    channelId: msg.channel.id,
  };
}

/**
 * Purge `amount` messages strictly older than `beforeMessageId`
 * (so the invoke command / bot reply are not counted).
 */
async function purgeMessages(
  channel: TextChannel,
  amount: number,
  beforeMessageId: string,
  targetUserId?: string,
): Promise<{ deleted: number; snapshots: PurgedMessageSnapshot[] }> {
  let deleted = 0;
  let before: string | undefined = beforeMessageId;
  let emptyStreak = 0;
  const snapshots: PurgedMessageSnapshot[] = [];

  while (deleted < amount) {
    const fetched: import('discord.js').Collection<string, Message> = await channel.messages.fetch({
      limit: 100,
      before,
    });

    if (!fetched.size) break;

    before = fetched.last()?.id;
    const cutoff = Date.now() - TWO_WEEKS_MS;

    let candidates = [...fetched.values()].filter((msg) => !msg.pinned);
    if (targetUserId) {
      candidates = candidates.filter((msg) => msg.author.id === targetUserId);
    }

    if (!candidates.length) {
      emptyStreak += 1;
      if (targetUserId && emptyStreak >= 20) break;
      continue;
    }
    emptyStreak = 0;

    const remaining = amount - deleted;
    candidates = candidates.slice(0, remaining);

    const recent = candidates.filter((msg) => msg.createdTimestamp > cutoff);
    const older = candidates.filter((msg) => msg.createdTimestamp <= cutoff);

    if (recent.length) {
      for (const msg of recent) snapshots.push(snapshotMessage(msg));
      const bulk = await channel.bulkDelete(recent, true);
      deleted += bulk.size;
    }

    for (const msg of older) {
      if (deleted >= amount) break;
      snapshots.push(snapshotMessage(msg));
      const ok = await msg.delete().then(() => true).catch(() => false);
      if (ok) deleted += 1;
      else snapshots.pop();
    }

    if (fetched.size < 100) break;
  }

  snapshots.sort((a, b) => a.createdTimestamp - b.createdTimestamp);
  return { deleted, snapshots };
}

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('purge')
    .setDescription('Bulk delete messages in this channel (optionally from one user)')
    .addIntegerOption((opt) =>
      opt
        .setName('amount')
        .setDescription('Number of messages (1-1000) before this command')
        .setRequired(true)
        .setMinValue(1)
        .setMaxValue(MAX_AMOUNT),
    )
    .addUserOption((opt) =>
      opt.setName('user').setDescription('Only delete this user’s messages'),
    ),
  permissions: [PermissionFlagsBits.ManageMessages],
  guildOnly: true,
  async execute(interaction) {
    const amount = interaction.options.getInteger('amount', true);
    const target = interaction.options.getUser('user');
    const channel = interaction.channel;

    if (!channel || !channel.isTextBased() || channel.isDMBased()) {
      await interaction.reply({ embeds: [fail(interaction.user, 'Cannot purge here')], ephemeral: true });
      return;
    }

    if (amount < 1 || amount > MAX_AMOUNT) {
      await interaction.reply({
        embeds: [fail(interaction.user, `Amount must be between 1 and ${MAX_AMOUNT}`)],
        ephemeral: true,
      });
      return;
    }

    const prefix = interaction instanceof PrefixCommandInteraction ? interaction : null;
    // Cursor snowflake: start counting from messages older than the command (prefix)
    // or older than the bot reply (slash). Command/reply are deleted separately and not counted.
    const beforeMessageId = prefix?.commandMessage.id;

    await interaction.deferReply();

    const reply = await interaction.fetchReply();
    const cursorId = beforeMessageId ?? reply.id;

    try {
      const { deleted, snapshots } = await purgeMessages(
        channel as TextChannel,
        amount,
        cursorId,
        target?.id,
      );

      // Cleanup: remove the user's ,purge message (not counted in amount)
      if (prefix) {
        await prefix.commandMessage.delete().catch(() => undefined);
      }

      await sendModLog({
        guild: interaction.guild!,
        action: 'purge',
        user: target ?? interaction.user,
        moderator: interaction.user,
        reason: target ? `User purge (${target.tag})` : 'Bulk delete',
        extra: { amount: deleted },
      });

      await sendPurgeMessageHistory(interaction.guild!, snapshots, {
        moderator: interaction.user,
        channelMention: `${channel}`,
      });

      await interaction.editReply({
        embeds: [
          buildPurgeEmbed({
            moderator: interaction.user,
            amount: deleted,
            channelMention: `${channel}`,
            botName: interaction.client.user?.username,
            target: target ?? undefined,
          }),
        ],
      });
      setTimeout(() => {
        void interaction.deleteReply().catch(() => undefined);
      }, 5_000);
    } catch {
      await interaction.editReply({
        embeds: [fail(interaction.user, 'Could not delete some messages (check permissions / age)')],
      });
      setTimeout(() => {
        void interaction.deleteReply().catch(() => undefined);
      }, 5_000);
    }
  },
};

export default command;
