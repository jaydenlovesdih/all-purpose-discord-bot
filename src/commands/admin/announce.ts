import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  SlashCommandBuilder,
} from 'discord.js';
import { Command } from '../../types/index.js';
import { fail, Colors, infoEmbed } from '../../utils/embeds.js';
import { blackBolt, buttonEmoji } from '../../utils/emojis.js';
import { isOwner } from '../../utils/permissions.js';
import {
  getConfiguredDmBotCount,
  getDmBotGuildStatus,
} from '../../utils/dmBots.js';
import {
  cancelAnnounce,
  isAnnounceRunning,
  pendingAnnounces,
} from '../../utils/announceDm.js';

const VARS = '`{user}` `{user.mention}` `{user.name}` `{guild.name}` `{membercount}`';

function canUseAnnounce(userId: string, guildOwnerId: string): boolean {
  return isOwner(userId) || userId === guildOwnerId;
}

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('announce')
    .setDescription('DM all members an important announcement (split across up to 6 bots)')
    .addStringOption((opt) =>
      opt
        .setName('subcommand')
        .setDescription('Action')
        .setRequired(true)
        .addChoices(
          { name: 'dm', value: 'dm' },
          { name: 'bots', value: 'bots' },
          { name: 'cancel', value: 'cancel' },
        ),
    )
    .addStringOption((opt) =>
      opt.setName('message').setDescription('Announcement text (for dm subcommand)'),
    ),
  guildOnly: true,
  async execute(interaction) {
    const guild = interaction.guild!;
    if (!canUseAnnounce(interaction.user.id, guild.ownerId)) {
      await interaction.reply({
        embeds: [fail(interaction.user, 'Only the **server owner** or a **bot owner** can use announce')],
        ephemeral: true,
      });
      return;
    }

    const sub = interaction.options.getString('subcommand', true);

    if (sub === 'bots') {
      const status = await getDmBotGuildStatus(guild.id);
      const inGuild = status.filter((s) => s.inGuild).length;
      const lines = status.map((s) => {
        const mark = s.inGuild ? '✅' : '❌';
        return `${mark} **${s.label}** (\`${s.clientId}\`)\n${s.inviteUrl}`;
      });

      await interaction.reply({
        embeds: [
          infoEmbed(
            [
              `**${inGuild}/${status.length}** DM bots are in this server.`,
              '',
              'Add every bot before running a mass DM — work is split evenly across bots that are present.',
              '',
              lines.join('\n\n'),
              '',
              `_Configure helper tokens with DM_BOT_TOKEN_2…6 and DM_BOT_CLIENT_ID_2…6 in Railway._`,
            ].join('\n'),
            'Announcement DM bots',
          ),
        ],
      });
      return;
    }

    if (sub === 'cancel') {
      if (!isAnnounceRunning(guild.id)) {
        await interaction.reply({
          embeds: [fail(interaction.user, 'No announcement DM job is running in this server')],
          ephemeral: true,
        });
        return;
      }

      cancelAnnounce(guild.id);
      await interaction.reply({
        embeds: [infoEmbed('Stopping the announcement DM job…', 'Announce cancel')],
      });
      return;
    }

    const message = interaction.options.getString('message')?.trim();
    if (!message) {
      await interaction.reply({
        embeds: [
          fail(
            interaction.user,
            `Usage: \`announce dm <message>\`\n\nVariables: ${VARS}`,
          ),
        ],
        ephemeral: true,
      });
      return;
    }

    if (isAnnounceRunning(guild.id)) {
      await interaction.reply({
        embeds: [fail(interaction.user, 'An announcement DM is already running in this server')],
        ephemeral: true,
      });
      return;
    }

    await interaction.deferReply();

    const botStatus = await getDmBotGuildStatus(guild.id);
    const available = botStatus.filter((s) => s.inGuild);
    if (!available.length) {
      await interaction.editReply({
        embeds: [
          fail(
            interaction.user,
            'No DM bots are in this server. Run `announce bots` and invite every bot first.',
          ),
        ],
      });
      return;
    }

    await guild.members.fetch().catch(() => undefined);
    const memberCount = guild.members.cache.filter((m) => !m.user.bot).size;
    if (memberCount === 0) {
      await interaction.editReply({
        embeds: [fail(interaction.user, 'No human members found to DM')],
      });
      return;
    }

    const estSeconds = Math.ceil((memberCount / available.length) * 1.2);
    const estMinutes = Math.max(1, Math.ceil(estSeconds / 60));
    const missing = botStatus.filter((s) => !s.inGuild);

    const embed = new EmbedBuilder()
      .setColor(Colors.error)
      .setTitle(`${blackBolt()} Confirm Announcement DM`)
      .setDescription(
        [
          `This will DM **${memberCount}** member${memberCount === 1 ? '' : 's'}.`,
          '',
          `**Bots sending:** ${available.length}/${getConfiguredDmBotCount()} (${available.map((b) => b.label).join(', ')})`,
          missing.length
            ? `**Missing bots:** ${missing.map((b) => b.label).join(', ')} — run \`announce bots\` for invite links`
            : null,
          '',
          `Paced at ~1.2s per member **per bot** (parallel across bots).`,
          `Estimated time: **~${estMinutes} minute${estMinutes === 1 ? '' : 's'}**.`,
          '',
          '**Preview:**',
          message.length > 500 ? `${message.slice(0, 500)}…` : message,
          '',
          `Variables supported: ${VARS}`,
          '',
          'Users with DMs closed will be skipped. Press **Confirm** to start.',
        ]
          .filter(Boolean)
          .join('\n'),
      )
      .setFooter({ text: `Requested by ${interaction.user.tag}` })
      .setTimestamp();

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId('announce:confirm')
        .setLabel('Confirm')
        .setEmoji(buttonEmoji('blackbolt'))
        .setStyle(ButtonStyle.Danger),
      new ButtonBuilder()
        .setCustomId('announce:cancel')
        .setLabel('Cancel')
        .setStyle(ButtonStyle.Secondary),
    );

    const msg = await interaction.editReply({ embeds: [embed], components: [row] });
    pendingAnnounces.set(msg.id, {
      ownerId: interaction.user.id,
      guildId: guild.id,
      message,
    });
    setTimeout(() => pendingAnnounces.delete(msg.id), 10 * 60_000);
  },
};

export default command;
