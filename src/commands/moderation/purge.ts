import {
  PermissionFlagsBits,
  SlashCommandBuilder,
  TextChannel,
} from 'discord.js';
import { Command } from '../../types/index.js';
import { fail } from '../../utils/embeds.js';
import { buildPurgeEmbed } from '../../utils/modResponse.js';
const MAX_AMOUNT = 1000;
const TWO_WEEKS_MS = 14 * 24 * 60 * 60 * 1000;

async function purgeMessages(
  channel: TextChannel,
  amount: number,
  targetUserId?: string,
): Promise<number> {
  let deleted = 0;
  let before: string | undefined;
  let emptyStreak = 0;

  while (deleted < amount) {
    const fetched = await channel.messages.fetch({
      limit: 100,
      ...(before ? { before } : {}),
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
      // Stop if we keep scrolling without finding that user's messages
      if (targetUserId && emptyStreak >= 20) break;
      continue;
    }
    emptyStreak = 0;

    const remaining = amount - deleted;
    candidates = candidates.slice(0, remaining);

    const recent = candidates.filter((msg) => msg.createdTimestamp > cutoff);
    const older = candidates.filter((msg) => msg.createdTimestamp <= cutoff);

    if (recent.length) {
      const bulk = await channel.bulkDelete(recent, true);
      deleted += bulk.size;
    }

    for (const msg of older) {
      if (deleted >= amount) break;
      const ok = await msg.delete().then(() => true).catch(() => false);
      if (ok) deleted += 1;
    }

    if (fetched.size < 100) break;
  }

  return deleted;
}

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('purge')
    .setDescription('Bulk delete messages in this channel (optionally from one user)')
    .addIntegerOption((opt) =>
      opt
        .setName('amount')
        .setDescription('Number of messages (1-1000)')
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

    await interaction.deferReply();

    try {
      const deleted = await purgeMessages(channel as TextChannel, amount, target?.id);
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
