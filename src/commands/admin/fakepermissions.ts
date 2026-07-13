import { PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import { Command } from '../../types/index.js';
import { FAKE_PERM_MAP, getGuildConfig, mutateGuildConfig } from '../../utils/guildConfig.js';
import { successEmbed, errorEmbed, infoEmbed } from '../../utils/embeds.js';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('fakepermissions')
    .setDescription('Grant bot-only permissions to roles (Bleed/Greed fakeperms)')
    .addStringOption((opt) =>
      opt
        .setName('subcommand')
        .setDescription('Action')
        .setRequired(true)
        .addChoices(
          { name: 'add', value: 'add' },
          { name: 'remove', value: 'remove' },
          { name: 'list', value: 'list' },
          { name: 'clear', value: 'clear' },
          { name: 'perms', value: 'perms' },
        ),
    )
    .addRoleOption((opt) => opt.setName('role').setDescription('Target role'))
    .addStringOption((opt) =>
      opt.setName('permissions').setDescription('Space-separated perms e.g. ban_members kick_members'),
    ),
  permissions: [PermissionFlagsBits.Administrator],
  guildOnly: true,
  async execute(interaction) {
    const sub = interaction.options.getString('subcommand', true);
    let role = interaction.options.getRole('role');
    let permsRaw = interaction.options.getString('permissions') ?? '';

    // Prefix form: ",fakepermissions add @Mods ban_members kick_members"
    if (!role && interaction.guild && permsRaw) {
      const mention = permsRaw.match(/<@&(\d+)>/);
      if (mention) {
        role = interaction.guild.roles.cache.get(mention[1]) ?? null;
        permsRaw = permsRaw.replace(mention[0], '').trim();
      }
    }

    const guildId = interaction.guildId!;

    if (sub === 'perms') {
      await interaction.reply({
        embeds: [infoEmbed(Object.keys(FAKE_PERM_MAP).map((p) => `\`${p}\``).join(', '), 'Available Fake Permissions')],
      });
      return;
    }

    if (sub === 'list') {
      const fake = getGuildConfig(guildId).fakePermissions;
      const lines = Object.entries(fake).map(
        ([roleId, perms]) => `<@&${roleId}> → ${perms.map((p) => `\`${p}\``).join(', ')}`,
      );
      await interaction.reply({
        embeds: [infoEmbed(lines.length ? lines.join('\n') : 'No fake permissions set.', 'Fake Permissions')],
      });
      return;
    }

    if (sub === 'clear') {
      mutateGuildConfig(guildId, (c) => {
        c.fakePermissions = {};
      });
      await interaction.reply({ embeds: [successEmbed('Cleared all fake permissions.')] });
      return;
    }

    if (!role) {
      await interaction.reply({
        embeds: [errorEmbed('Provide a role. Example: `,fakepermissions add @Mods ban_members kick_members`')],
        ephemeral: true,
      });
      return;
    }

    if (sub === 'remove') {
      mutateGuildConfig(guildId, (c) => {
        delete c.fakePermissions[role!.id];
      });
      await interaction.reply({ embeds: [successEmbed(`Removed fake permissions from **${role.name}**`)] });
      return;
    }

    const perms = permsRaw
      .split(/\s+/)
      .map((p) => p.toLowerCase())
      .filter((p) => FAKE_PERM_MAP[p]);

    if (!perms.length) {
      await interaction.reply({
        embeds: [errorEmbed('No valid permissions. Use `,fakepermissions perms` to list them.')],
        ephemeral: true,
      });
      return;
    }

    mutateGuildConfig(guildId, (c) => {
      const existing = new Set(c.fakePermissions[role!.id] ?? []);
      for (const p of perms) existing.add(p);
      c.fakePermissions[role!.id] = [...existing];
    });

    await interaction.reply({
      embeds: [successEmbed(`Added to **${role.name}**: ${perms.map((p) => `\`${p}\``).join(', ')}`)],
    });
  },
};

export default command;
