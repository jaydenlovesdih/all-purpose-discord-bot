import { PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import { Command } from '../../types/index.js';
import { fail, ok } from '../../utils/embeds.js';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('vanity')
    .setDescription('View this server\'s vanity invite URL')
    .addStringOption((opt) =>
      opt
        .setName('code')
        .setDescription('Ignored — Discord does not allow bots to set vanity URLs'),
    ),
  permissions: [PermissionFlagsBits.ManageGuild],
  guildOnly: true,
  async execute(interaction) {
    const guild = interaction.guild!;
    const attempted = interaction.options.getString('code')?.trim();

    if (!guild.features.includes('VANITY_URL')) {
      await interaction.reply({
        embeds: [
          fail(
            interaction.user,
            'This server does not have a vanity URL (needs **Level 3** boosts, or Partner/Verified)',
          ),
        ],
        ephemeral: true,
      });
      return;
    }

    // Discord rejects bot tokens on PATCH /guilds/:id/vanity-url ("Bots cannot use this endpoint")
    if (attempted) {
      await interaction.reply({
        embeds: [
          fail(
            interaction.user,
            [
              'Discord **does not allow bots** to change vanity URLs.',
              'Set it manually: **Server Settings → Invites → Custom Invite Link**.',
            ].join('\n'),
          ),
        ],
        ephemeral: true,
      });
      return;
    }

    let code = guild.vanityURLCode;
    let uses: number | null = guild.vanityURLUses;
    try {
      const data = await guild.fetchVanityData();
      code = data.code;
      uses = data.uses;
    } catch {
      /* fall back to cached */
    }

    if (!code) {
      await interaction.reply({
        embeds: [
          ok(
            interaction.user,
            'no vanity URL is set — change it in **Server Settings → Invites** (bots cannot set it)',
          ),
        ],
      });
      return;
    }

    await interaction.reply({
      embeds: [
        ok(
          interaction.user,
          `current vanity: **https://discord.gg/${code}**` +
            (uses != null ? ` · **${uses}** use${uses === 1 ? '' : 's'}` : '') +
            `\nTo change it: **Server Settings → Invites** (Discord blocks bots from setting vanities)`,
        ),
      ],
    });
  },
};

export default command;
