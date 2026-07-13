import { PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import { Command } from '../../types/index.js';
import { AntinukeModule, getGuildConfig, mutateGuildConfig } from '../../utils/guildConfig.js';
import { ensureAntinukeAdmin, toggleAntinukeModule } from '../../utils/antinuke.js';
import { successEmbed, errorEmbed, infoEmbed } from '../../utils/embeds.js';

const MODULES: AntinukeModule[] = ['ban', 'kick', 'role', 'channel', 'webhook', 'emoji', 'botadd', 'guild'];

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('antinuke')
    .setDescription('Configure AntiNuke protection (Bleed/Greed style)')
    .addStringOption((opt) =>
      opt
        .setName('subcommand')
        .setDescription('Action')
        .setRequired(true)
        .addChoices(
          { name: 'toggle', value: 'toggle' },
          { name: 'ban', value: 'ban' },
          { name: 'kick', value: 'kick' },
          { name: 'role', value: 'role' },
          { name: 'channel', value: 'channel' },
          { name: 'webhook', value: 'webhook' },
          { name: 'emoji', value: 'emoji' },
          { name: 'botadd', value: 'botadd' },
          { name: 'guild', value: 'guild' },
          { name: 'whitelist', value: 'whitelist' },
          { name: 'admin', value: 'admin' },
          { name: 'config', value: 'config' },
          { name: 'list', value: 'list' },
        ),
    )
    .addStringOption((opt) => opt.setName('value').setDescription('on/off, add/remove, or punishment'))
    .addUserOption((opt) => opt.setName('user').setDescription('User for whitelist/admin'))
    .addIntegerOption((opt) => opt.setName('threshold').setDescription('Actions per 60s').setMinValue(1).setMaxValue(20)),
  guildOnly: true,
  async execute(interaction) {
    const guild = interaction.guild!;
    if (!ensureAntinukeAdmin(guild.id, interaction.user.id, guild.ownerId)) {
      await interaction.reply({
        embeds: [errorEmbed('Only the server owner or antinuke admins can configure this.')],
        ephemeral: true,
      });
      return;
    }

    const sub = interaction.options.getString('subcommand', true);
    const value = interaction.options.getString('value');
    const user = interaction.options.getUser('user');
    const threshold = interaction.options.getInteger('threshold') ?? undefined;
    const on = !value || ['on', 'true', '1', 'yes', 'enable'].includes(value.toLowerCase());

    if (sub === 'toggle') {
      let enabled = false;
      mutateGuildConfig(guild.id, (c) => {
        c.antinuke.enabled = value ? on : !c.antinuke.enabled;
        enabled = c.antinuke.enabled;
        if (enabled) {
          for (const m of MODULES) c.antinuke.modules[m].enabled = true;
        }
      });
      await interaction.reply({
        embeds: [successEmbed(`AntiNuke **${enabled ? 'enabled' : 'disabled'}**${enabled ? ' (all modules on)' : ''}`)],
      });
      return;
    }

    if (MODULES.includes(sub as AntinukeModule)) {
      const punishment =
        value && ['ban', 'kick', 'strip', 'timeout'].includes(value.toLowerCase())
          ? (value.toLowerCase() as 'ban' | 'kick' | 'strip' | 'timeout')
          : undefined;
      const enable = punishment ? true : on;
      toggleAntinukeModule(guild.id, sub as AntinukeModule, enable, threshold, punishment);
      await interaction.reply({
        embeds: [
          successEmbed(
            `Module \`${sub}\` → **${enable ? 'on' : 'off'}**` +
              (threshold ? ` · threshold **${threshold}**` : '') +
              (punishment ? ` · punish **${punishment}**` : ''),
          ),
        ],
      });
      return;
    }

    if (sub === 'whitelist') {
      if (!user) {
        const list = getGuildConfig(guild.id).antinuke.whitelist;
        await interaction.reply({
          embeds: [infoEmbed(list.length ? list.map((id) => `<@${id}>`).join('\n') : 'Empty whitelist.', 'Antinuke Whitelist')],
        });
        return;
      }
      mutateGuildConfig(guild.id, (c) => {
        if (c.antinuke.whitelist.includes(user.id)) {
          c.antinuke.whitelist = c.antinuke.whitelist.filter((id) => id !== user.id);
        } else {
          c.antinuke.whitelist.push(user.id);
        }
      });
      await interaction.reply({ embeds: [successEmbed(`Toggled whitelist for **${user.tag}**`)] });
      return;
    }

    if (sub === 'admin') {
      const { canBypass } = await import('../../utils/permissions.js');
      if (!user) {
        const list = getGuildConfig(guild.id).antinuke.admins;
        await interaction.reply({
          embeds: [infoEmbed(list.length ? list.map((id) => `<@${id}>`).join('\n') : 'No antinuke admins.', 'Antinuke Admins')],
        });
        return;
      }
      if (!canBypass(interaction.user.id) && interaction.user.id !== guild.ownerId) {
        await interaction.reply({ embeds: [errorEmbed('Only the server owner can manage antinuke admins.')], ephemeral: true });
        return;
      }
      mutateGuildConfig(guild.id, (c) => {
        if (c.antinuke.admins.includes(user.id)) {
          c.antinuke.admins = c.antinuke.admins.filter((id) => id !== user.id);
        } else {
          c.antinuke.admins.push(user.id);
        }
      });
      await interaction.reply({ embeds: [successEmbed(`Toggled antinuke admin for **${user.tag}**`)] });
      return;
    }

    const an = getGuildConfig(guild.id).antinuke;
    const lines = MODULES.map((m) => {
      const mod = an.modules[m];
      return `\`${m}\`: ${mod.enabled ? 'on' : 'off'} · t=${mod.threshold} · ${mod.punishment}`;
    });
    await interaction.reply({
      embeds: [
        infoEmbed(
          [`Enabled: **${an.enabled}**`, ...lines, `Whitelist: ${an.whitelist.length}`, `Admins: ${an.admins.length}`].join('\n'),
          'Antinuke Config',
        ),
      ],
    });
  },
};

export default command;
