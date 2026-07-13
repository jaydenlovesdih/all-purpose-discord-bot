import { EmbedBuilder, PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import { Command } from '../../types/index.js';
import { mutateGuildConfig, getGuildConfig } from '../../utils/guildConfig.js';
import { Colors, successEmbed, errorEmbed } from '../../utils/embeds.js';

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

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('giveaway')
    .setDescription('Start a giveaway')
    .addStringOption((opt) => opt.setName('duration').setDescription('e.g. 10m, 1h, 1d').setRequired(true))
    .addStringOption((opt) => opt.setName('prize').setDescription('Prize').setRequired(true))
    .addIntegerOption((opt) => opt.setName('winners').setDescription('Winner count').setMinValue(1).setMaxValue(20)),
  permissions: [PermissionFlagsBits.ManageGuild],
  guildOnly: true,
  async execute(interaction) {
    const duration = parseDuration(interaction.options.getString('duration', true));
    const prize = interaction.options.getString('prize', true);
    const winners = interaction.options.getInteger('winners') ?? 1;

    if (!duration || duration < 10_000) {
      await interaction.reply({ embeds: [errorEmbed('Invalid duration. Use like `10m`, `1h`, `1d`.')], ephemeral: true });
      return;
    }

    const endsAt = Date.now() + duration;
    const embed = new EmbedBuilder()
      .setColor(Colors.primary)
      .setTitle('🎉 Giveaway')
      .setDescription(`**Prize:** ${prize}\n**Winners:** ${winners}\n**Ends:** <t:${Math.floor(endsAt / 1000)}:R>\nReact with 🎉 to enter!`)
      .setFooter({ text: `Hosted by ${interaction.user.tag}` })
      .setTimestamp(endsAt);

    const message = await interaction.reply({ embeds: [embed], fetchReply: true });
    await message.react('🎉');

    mutateGuildConfig(interaction.guildId!, (c) => {
      c.giveaways[message.id] = {
        prize,
        endsAt,
        winners,
        channelId: interaction.channelId,
        hostId: interaction.user.id,
        ended: false,
      };
    });

    setTimeout(async () => {
      try {
        const cfg = getGuildConfig(interaction.guildId!);
        const g = cfg.giveaways[message.id];
        if (!g || g.ended) return;
        mutateGuildConfig(interaction.guildId!, (c) => {
          if (c.giveaways[message.id]) c.giveaways[message.id].ended = true;
        });

        const fetched = await message.fetch();
        const reaction = fetched.reactions.cache.get('🎉');
        const users = reaction ? await reaction.users.fetch() : null;
        const entrants = users?.filter((u) => !u.bot).map((u) => u.id) ?? [];

        if (!entrants.length) {
          await fetched.reply('Giveaway ended — no valid entries.');
          return;
        }

        const picked: string[] = [];
        const pool = [...entrants];
        for (let i = 0; i < Math.min(winners, pool.length); i++) {
          const idx = Math.floor(Math.random() * pool.length);
          picked.push(pool.splice(idx, 1)[0]);
        }

        await fetched.reply({
          embeds: [
            successEmbed(
              `**Prize:** ${prize}\n**Winner(s):** ${picked.map((id) => `<@${id}>`).join(', ')}`,
              'Giveaway Ended',
            ),
          ],
        });
      } catch {
        // ignore expired/deleted giveaways
      }
    }, duration);
  },
};

export default command;
