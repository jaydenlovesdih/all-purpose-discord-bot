import { PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import { Command } from '../../types/index.js';
import { getGuildConfig, mutateGuildConfig } from '../../utils/guildConfig.js';
import { successEmbed, errorEmbed, infoEmbed, fail } from '../../utils/embeds.js';
import {
  buildTwitterCaption,
  downloadTweetVideos,
  extractTweetIds,
  fetchTweetMedia,
  shouldSkipRecent,
} from '../../utils/twitterVideo.js';
import { wantsPlainRoleReply, withUserInstall } from '../../utils/userInstall.js';

const command: Command = {
  data: withUserInstall(
    new SlashCommandBuilder()
      .setName('twitter')
      .setDescription('Convert Twitter/X links into permanent Discord videos')
      .addStringOption((opt) =>
        opt
          .setName('subcommand')
          .setDescription('Action')
          .setRequired(true)
          .addChoices(
            { name: 'save', value: 'save' },
            { name: 'enable', value: 'enable' },
            { name: 'disable', value: 'disable' },
            { name: 'view', value: 'view' },
          ),
      )
      .addStringOption((opt) =>
        opt.setName('url').setDescription('Twitter/X post URL (for save)'),
      ),
  ),
  guildOnly: true,
  userInstall: true,
  bypassBotLock: true,
  async execute(interaction) {
    let sub = interaction.options.getString('subcommand', true);
    let url =
      interaction.options.getString('url') ??
      interaction.options.getString('value') ??
      '';

    // Prefix: `twitter https://x.com/...` → save that URL
    if (extractTweetIds(sub).length || /^https?:\/\//i.test(sub)) {
      url = url.trim() || sub;
      sub = 'save';
    }

    const guildId = interaction.guildId!;
    const isPrefix = 'commandMessage' in interaction;
    const ephemeral = !isPrefix && sub !== 'save';
    const plain = wantsPlainRoleReply(interaction);

    if (sub === 'view') {
      const cfg = getGuildConfig(guildId).twitterVideo;
      const text = [
        `**Twitter → permanent video**`,
        `Auto-convert: **${cfg.enabled ? 'on' : 'off'}**`,
        '',
        'When on, video posts are re-uploaded as Discord files.',
        'Manual: `/twitter save` + URL, or `atwitter save <url>`.',
      ].join('\n');
      if (plain) {
        await interaction.reply({ content: text, embeds: [], ephemeral });
      } else {
        await interaction.reply({
          embeds: [infoEmbed(text, 'Twitter → permanent video')],
          ephemeral,
        });
      }
      return;
    }

    if (sub === 'enable' || sub === 'disable') {
      const canManage = interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild);
      if (!canManage) {
        const tip = 'You need **Manage Server** to toggle auto-convert.';
        if (plain) {
          await interaction.reply({ content: tip, embeds: [], ephemeral: true });
        } else {
          await interaction.reply({ embeds: [errorEmbed(tip)], ephemeral: true });
        }
        return;
      }

      const enabled = sub === 'enable';
      mutateGuildConfig(guildId, (c) => {
        c.twitterVideo.enabled = enabled;
      });
      const msg = enabled
        ? 'Twitter/X videos will be auto-saved as permanent Discord attachments.'
        : 'Auto-convert disabled. You can still use `/twitter save`.';
      if (plain) {
        await interaction.reply({ content: msg, embeds: [], ephemeral });
      } else {
        await interaction.reply({ embeds: [successEmbed(msg)], ephemeral });
      }
      return;
    }

    if (sub !== 'save') {
      const tip = 'Use `save`, `enable`, `disable`, or `view`.';
      if (plain) {
        await interaction.reply({ content: tip, embeds: [], ephemeral: true });
      } else {
        await interaction.reply({ embeds: [errorEmbed(tip)], ephemeral: true });
      }
      return;
    }

    const ids = extractTweetIds(url);
    if (!ids.length) {
      const tip = 'Provide a Twitter/X post URL, e.g. `https://x.com/user/status/123`.';
      if (plain) {
        await interaction.reply({ content: tip, embeds: [], ephemeral: true });
      } else {
        await interaction.reply({
          embeds: [fail(interaction.user, tip)],
          ephemeral: true,
        });
      }
      return;
    }

    await interaction.deferReply();

    const files = [];
    const captions: string[] = [];
    let noVideo = 0;
    let failed = 0;

    for (const id of ids.slice(0, 3)) {
      if (shouldSkipRecent(guildId, id)) continue;
      const media = await fetchTweetMedia(id);
      if (!media) {
        failed += 1;
        continue;
      }
      if (!media.videos.length) {
        noVideo += 1;
        continue;
      }
      const { attachments } = await downloadTweetVideos(media);
      if (!attachments.length) {
        failed += 1;
        continue;
      }
      files.push(...attachments);
      captions.push(buildTwitterCaption(media));
    }

    if (!files.length) {
      const tip =
        noVideo && !failed
          ? 'That post has no video/GIF to save.'
          : 'Could not download the video (missing, private, or too large for Discord).';
      if (plain) {
        await interaction.editReply({ content: tip, embeds: [] });
      } else {
        await interaction.editReply({ embeds: [errorEmbed(tip)] });
      }
      return;
    }

    await interaction.editReply({
      content: captions.join('\n\n').slice(0, 2000),
      embeds: [],
      files: files.slice(0, 10),
    });
  },
};

export default command;
