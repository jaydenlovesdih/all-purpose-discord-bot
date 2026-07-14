import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  PermissionFlagsBits,
  SlashCommandBuilder,
} from 'discord.js';
import { Command } from '../../types/index.js';
import { mutateGuildConfig, getGuildConfig } from '../../utils/guildConfig.js';
import { fail } from '../../utils/embeds.js';
import { MOD_ACCENT } from '../../utils/modResponse.js';

function parseDuration(input: string): number | null {
  const match = input.match(/^(\d+)(s|m|h|d)$/i);
  if (!match) return null;
  const n = Number(match[1]);
  const unit = match[2].toLowerCase();
  if (unit === 's') return n * 1000;
  if (unit === 'm') return n * 60_000;
  if (unit === 'h') return n * 3_600_000;
  return n * 86_400_000;
}

export async function endGiveaway(
  guildId: string,
  message: import('discord.js').Message,
): Promise<void> {
  const cfg = getGuildConfig(guildId);
  const g = cfg.giveaways[message.id];
  if (!g || g.ended) return;

  mutateGuildConfig(guildId, (c) => {
    if (c.giveaways[message.id]) c.giveaways[message.id].ended = true;
  });

  const entrants = g.entrants ?? [];
  if (!entrants.length) {
    await message.edit({
      content: 'Giveaway ended — no valid entries.',
      components: [],
    });
    return;
  }

  const picked: string[] = [];
  const pool = [...entrants];
  for (let i = 0; i < Math.min(g.winners, pool.length); i++) {
    const idx = Math.floor(Math.random() * pool.length);
    picked.push(pool.splice(idx, 1)[0]);
  }

  await message.edit({
    embeds: [
      new EmbedBuilder()
        .setColor(MOD_ACCENT)
        .setTitle('🎉 Giveaway Ended')
        .setDescription(
          `**Prize:** ${g.prize}\n**Winner(s):** ${picked.map((id) => `<@${id}>`).join(', ')}`,
        ),
    ],
    components: [],
  });
  await message.reply(`Congratulations ${picked.map((id) => `<@${id}>`).join(', ')}!`);
}

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('giveaway')
    .setDescription('Start a giveaway')
    .addStringOption((opt) => opt.setName('duration').setDescription('e.g. 10m, 1h, 1d').setRequired(true))
    .addStringOption((opt) => opt.setName('prize').setDescription('Prize').setRequired(true))
    .addIntegerOption((opt) =>
      opt.setName('winners').setDescription('Winner count').setMinValue(1).setMaxValue(20),
    ),
  permissions: [PermissionFlagsBits.ManageGuild],
  guildOnly: true,
  async execute(interaction) {
    const duration = parseDuration(interaction.options.getString('duration', true));
    const prize = interaction.options.getString('prize', true);
    const winners = interaction.options.getInteger('winners') ?? 1;

    if (!duration || duration < 10_000) {
      await interaction.reply({
        embeds: [fail(interaction.user, 'Invalid duration. Use like `10m`, `1h`, `1d`')],
        ephemeral: true,
      });
      return;
    }

    const endsAt = Date.now() + duration;
    const embed = new EmbedBuilder()
      .setColor(MOD_ACCENT)
      .setTitle('🎉 Giveaway')
      .setDescription(
        `**Prize:** ${prize}\n**Winners:** ${winners}\n**Ends:** <t:${Math.floor(endsAt / 1000)}:R>\n**Entries:** 0\n\nClick **Enter** to join!`,
      )
      .setFooter({ text: `Hosted by ${interaction.user.tag}` })
      .setTimestamp(endsAt);

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId('gw:enter')
        .setLabel('Enter')
        .setEmoji('🎉')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId('gw:end')
        .setLabel('End Early')
        .setStyle(ButtonStyle.Danger),
    );

    const message = await interaction.reply({ embeds: [embed], components: [row], fetchReply: true });

    mutateGuildConfig(interaction.guildId!, (c) => {
      c.giveaways[message.id] = {
        prize,
        endsAt,
        winners,
        channelId: interaction.channelId,
        hostId: interaction.user.id,
        ended: false,
        entrants: [],
      };
    });

    setTimeout(() => {
      void endGiveaway(interaction.guildId!, message).catch(() => undefined);
    }, duration);
  },
};

export default command;
