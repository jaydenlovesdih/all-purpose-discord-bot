import {
  ChatInputCommandInteraction,
  Client,
  Collection,
  PermissionResolvable,
  SlashCommandBuilder,
  SlashCommandOptionsOnlyBuilder,
  SlashCommandSubcommandsOnlyBuilder,
} from 'discord.js';

export type SlashCommandData =
  | SlashCommandBuilder
  | SlashCommandOptionsOnlyBuilder
  | SlashCommandSubcommandsOnlyBuilder
  | Omit<SlashCommandBuilder, 'addSubcommand' | 'addSubcommandGroup'>;

export interface Command {
  data: SlashCommandData;
  permissions?: PermissionResolvable[];
  ownerOnly?: boolean;
  guildOnly?: boolean;
  /**
   * When true, this command is registered as a global slash command with
   * User Install + Guild Install contexts (Add to My Apps).
   */
  userInstall?: boolean;
  /** Skip botlock for this command (typical for user-install utilities). */
  bypassBotLock?: boolean;
  execute: (interaction: ChatInputCommandInteraction, client: BotClient) => Promise<void>;
}

export interface BotClient extends Client {
  commands: Collection<string, Command>;
}

export interface WarningRecord {
  userId: string;
  moderatorId: string;
  reason: string;
  timestamp: number;
}

export interface GuildWarnings {
  [userId: string]: WarningRecord[];
}
