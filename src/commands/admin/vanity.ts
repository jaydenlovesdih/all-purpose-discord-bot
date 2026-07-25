import { PermissionFlagsBits, Routes, SlashCommandBuilder } from 'discord.js';
import { Command } from '../../types/index.js';
import { fail, ok } from '../../utils/embeds.js';

const CODE_RE = /^[a-zA-Z0-9-]{2,32}$/;

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('vanity')
    .setDescription('View or set this server\'s vanity invite URL')
    .addStringOption((opt) =>
      opt.setName('code').setDescription('New vanity code (e.g. mogs → discord.gg/mogs)'),
    ),
  permissions: [PermissionFlagsBits.ManageGuild],
  guildOnly: true,
  async execute(interaction) {
    const guild = interaction.guild!;
    const me = guild.members.me;
    const raw = interaction.options.getString('code')?.trim();

    if (!me?.permissions.has(PermissionFlagsBits.ManageGuild)) {
      await interaction.reply({
        embeds: [fail(interaction.user, 'I need **Manage Server** to change the vanity URL')],
        ephemeral: true,
      });
      return;
    }

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

    if (!raw) {
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
          embeds: [ok(interaction.user, 'no vanity URL is set — use `vanity <code>` to set one')],
        });
        return;
      }

      await interaction.reply({
        embeds: [
          ok(
            interaction.user,
            `current vanity: **https://discord.gg/${code}**` +
              (uses != null ? ` · **${uses}** use${uses === 1 ? '' : 's'}` : '') +
              `\nSet a new one: \`vanity <code>\``,
          ),
        ],
      });
      return;
    }

    // Allow paste of full URL or discord.gg/code
    const code = raw
      .replace(/^https?:\/\/(www\.)?discord\.gg\//i, '')
      .replace(/^discord\.gg\//i, '')
      .split(/[/?#]/)[0]
      .trim();

    if (!CODE_RE.test(code)) {
      await interaction.reply({
        embeds: [
          fail(
            interaction.user,
            'Invalid code — use 2–32 letters, numbers, or hyphens (e.g. `mogs`)',
          ),
        ],
        ephemeral: true,
      });
      return;
    }

    await interaction.deferReply();

    try {
      await interaction.client.rest.patch(Routes.guildVanityUrl(guild.id), {
        body: { code },
      });

      await interaction.editReply({
        embeds: [
          ok(
            interaction.user,
            `vanity set to **https://discord.gg/${code}**`,
          ),
        ],
      });
    } catch (error) {
      const msg =
        error && typeof error === 'object' && 'message' in error
          ? String((error as { message: string }).message)
          : 'unknown error';

      let hint = 'Could not set vanity URL';
      if (/already|taken|unique/i.test(msg)) hint = 'That vanity code is **already taken**';
      else if (/missing|access|permission/i.test(msg))
        hint = 'Missing permission or this server cannot use vanity URLs';
      else if (/invalid|code/i.test(msg)) hint = 'Discord rejected that vanity code';
      else hint = `Could not set vanity URL (${msg.slice(0, 120)})`;

      await interaction.editReply({
        embeds: [fail(interaction.user, hint)],
      });
    }
  },
};

export default command;
