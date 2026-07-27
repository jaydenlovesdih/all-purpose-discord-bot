import { ChannelType, GuildMember, PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import { Command } from '../../types/index.js';
import { getGuildConfig, mutateGuildConfig } from '../../utils/guildConfig.js';
import { successEmbed, errorEmbed, infoEmbed, fail } from '../../utils/embeds.js';
import { canBypass } from '../../utils/permissions.js';
import {
  buildTwitterCaption,
  downloadTweetVideos,
  extractTweetIds,
  fetchTweetMedia,
  logTwitterConversion,
  shouldSkipRecent,
} from '../../utils/twitterVideo.js';
import { wantsPlainRoleReply, withUserInstall } from '../../utils/userInstall.js';

function parseOnOff(raw: string | null | undefined): boolean | null {
  if (!raw) return null;
  const v = raw.trim().toLowerCase();
  if (['on', 'enable', 'enabled', 'true', 'yes', '1'].includes(v)) return true;
  if (['off', 'disable', 'disabled', 'false', 'no', '0'].includes(v)) return false;
  return null;
}

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
            { name: 'text', value: 'text' },
            { name: 'log', value: 'log' },
            { name: 'view', value: 'view' },
          ),
      )
      .addStringOption((opt) =>
        opt.setName('url').setDescription('Twitter/X post URL (for save) or on/off (for text)'),
      )
      .addChannelOption((opt) =>
        opt
          .setName('channel')
          .setDescription('Log channel (for log)')
          .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement),
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

    const requireManage = async (): Promise<boolean> => {
      // Bot owners always bypass
      if (canBypass(interaction.user.id)) return true;

      // Discord server owner
      if (interaction.guild?.ownerId === interaction.user.id) return true;

      // Slash / cached permissions
      if (interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) return true;

      // Prefix + user-install: resolve the real guild member
      let member = interaction.member instanceof GuildMember ? interaction.member : null;
      if (!member && interaction.guild) {
        member = await interaction.guild.members.fetch(interaction.user.id).catch(() => null);
      }
      if (member?.permissions.has(PermissionFlagsBits.ManageGuild)) return true;
      if (member?.permissions.has(PermissionFlagsBits.Administrator)) return true;

      const tip = 'You need **Manage Server** for this setting.';
      if (plain) {
        await interaction.reply({ content: tip, embeds: [], ephemeral: true });
      } else {
        await interaction.reply({ embeds: [errorEmbed(tip)], ephemeral: true });
      }
      return false;
    };

    if (sub === 'view') {
      const cfg = getGuildConfig(guildId).twitterVideo;
      const text = [
        `**Twitter → permanent video**`,
        `Auto-convert: **${cfg.enabled ? 'on' : 'off'}**`,
        `Post text with video: **${cfg.includeText ? 'on' : 'off'}** (default off — video only)`,
        `Delete original link: **${cfg.deleteOriginal !== false ? 'on' : 'off'}**`,
        `Log channel: ${cfg.logChannelId ? `<#${cfg.logChannelId}>` : '_not set_'}`,
        '',
        'Auto: deletes the Twitter link, uploads the video, logs to the log channel.',
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
      if (!(await requireManage())) return;

      const enabled = sub === 'enable';
      mutateGuildConfig(guildId, (c) => {
        c.twitterVideo.enabled = enabled;
      });
      const msg = enabled
        ? 'Auto-convert on: Twitter/X video links are deleted, re-uploaded as Discord files, and logged.'
        : 'Auto-convert disabled. You can still use `/twitter save`.';
      if (plain) {
        await interaction.reply({ content: msg, embeds: [], ephemeral });
      } else {
        await interaction.reply({ embeds: [successEmbed(msg)], ephemeral });
      }
      return;
    }

    if (sub === 'text') {
      if (!(await requireManage())) return;

      const parsed = parseOnOff(url) ?? parseOnOff(interaction.options.getString('url'));
      if (parsed === null) {
        const tip = 'Use `twitter text on` or `twitter text off`.';
        if (plain) {
          await interaction.reply({ content: tip, embeds: [], ephemeral: true });
        } else {
          await interaction.reply({ embeds: [errorEmbed(tip)], ephemeral: true });
        }
        return;
      }

      mutateGuildConfig(guildId, (c) => {
        c.twitterVideo.includeText = parsed;
      });
      const msg = parsed
        ? 'Videos will include the post text.'
        : 'Videos will upload with no extra text (default).';
      if (plain) {
        await interaction.reply({ content: msg, embeds: [], ephemeral });
      } else {
        await interaction.reply({ embeds: [successEmbed(msg)], ephemeral });
      }
      return;
    }

    if (sub === 'log') {
      if (!(await requireManage())) return;

      const channelOpt = interaction.options.getChannel('channel');
      // Prefix: `twitter log #channel` or `twitter log clear` via url/rest
      const rest = url.trim();
      const clear = ['clear', 'none', 'off', 'remove'].includes(rest.toLowerCase());

      if (clear) {
        mutateGuildConfig(guildId, (c) => {
          delete c.twitterVideo.logChannelId;
        });
        const msg = 'Twitter log channel cleared.';
        if (plain) {
          await interaction.reply({ content: msg, embeds: [], ephemeral });
        } else {
          await interaction.reply({ embeds: [successEmbed(msg)], ephemeral });
        }
        return;
      }

      let channelId = channelOpt?.id;
      if (!channelId && rest) {
        const mention = rest.match(/^<#(\d+)>$/);
        channelId = mention?.[1] ?? (/^\d{17,20}$/.test(rest) ? rest : undefined);
      }

      if (!channelId) {
        const tip = 'Set a log channel: `twitter log #channel` (or `twitter log clear`).';
        if (plain) {
          await interaction.reply({ content: tip, embeds: [], ephemeral: true });
        } else {
          await interaction.reply({ embeds: [errorEmbed(tip)], ephemeral: true });
        }
        return;
      }

      mutateGuildConfig(guildId, (c) => {
        c.twitterVideo.logChannelId = channelId;
      });
      const msg = `Twitter conversions will be logged in <#${channelId}>.`;
      if (plain) {
        await interaction.reply({ content: msg, embeds: [], ephemeral });
      } else {
        await interaction.reply({ embeds: [successEmbed(msg)], ephemeral });
      }
      return;
    }

    if (sub !== 'save') {
      const tip = 'Use `save`, `enable`, `disable`, `text`, `log`, or `view`.';
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

    const cfg = getGuildConfig(guildId).twitterVideo;
    const files = [];
    const captions: string[] = [];
    const tweetUrls: string[] = [];
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
      const caption = buildTwitterCaption(media, cfg.includeText);
      if (caption) captions.push(caption);
      tweetUrls.push(media.tweetUrl);
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

    const content = captions.length ? captions.join('\n\n').slice(0, 2000) : '';
    await interaction.editReply({
      content,
      embeds: [],
      files: files.slice(0, 10),
    });

    const posted = await interaction.fetchReply();
    if (interaction.guild && tweetUrls[0] && 'id' in posted) {
      await logTwitterConversion(interaction.guild, cfg, {
        tweetUrl: tweetUrls[0],
        postedMessage: posted as import('discord.js').Message,
        sourceUserTag: `${interaction.user} (\`${interaction.user.tag}\`)`,
      });
    }
  },
};

export default command;
