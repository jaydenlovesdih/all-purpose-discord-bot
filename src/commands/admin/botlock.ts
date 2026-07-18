import { SlashCommandBuilder } from 'discord.js';
import { Command } from '../../types/index.js';
import { mutateGuildConfig } from '../../utils/guildConfig.js';
import { ok } from '../../utils/embeds.js';
import { blackBolt, bolt } from '../../utils/emojis.js';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('botlock')
    .setDescription('Lock/unlock the bot for this server (owner only)'),
  ownerOnly: true,
  guildOnly: true,
  async execute(interaction) {
    let locked = false;
    mutateGuildConfig(interaction.guildId!, (c) => {
      c.botLocked = !c.botLocked;
      locked = c.botLocked;
    });

    if (locked) {
      await interaction.reply({
        embeds: [
          ok(
            interaction.user,
            `${blackBolt()} **bot locked** — only bot owners can use commands. Everyone else is ignored silently.`,
          ),
        ],
      });
      return;
    }

    await interaction.reply({
      embeds: [
        ok(interaction.user, `${bolt()} **bot unlocked** — everyone can use commands again.`),
      ],
    });
  },
};

export default command;
