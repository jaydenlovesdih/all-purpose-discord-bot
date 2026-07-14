import { GuildMember, Message, MessagePayload, User } from 'discord.js';
import { PrefixArgDef, prefixSchemas } from './prefixSchemas.js';
import { buildUsageLine } from './usage.js';
type ReplyPayload = string | MessagePayload | import('discord.js').InteractionReplyOptions;

export class PrefixOptions {
  private readonly values = new Map<string, unknown>();

  constructor(
    private readonly message: Message,
    schema: PrefixArgDef[],
    rawArgs: string,
  ) {
    this.parse(schema, rawArgs);
  }

  private parse(schema: PrefixArgDef[], rawArgs: string): void {
    let remaining = rawArgs.trim();

    for (let index = 0; index < schema.length; index++) {
      const arg = schema[index];
      const isLast = index === schema.length - 1;

      if (!remaining && !arg.required) continue;

      if (arg.type === 'rest') {
        if (remaining || arg.required) {
          // Preserve internal newlines; only trim spaces/tabs on the edges
          this.values.set(arg.name, remaining.replace(/^[^\S\n]+|[^\S\n]+$/g, ''));
        }
        break;
      }

      if (arg.type === 'user') {
        const match = remaining.match(/^<@!?(\d+)>/);
        if (match) {
          const user = this.message.mentions.users.get(match[1]) ??
            this.message.client.users.cache.get(match[1]);
          if (user) {
            this.values.set(arg.name, user);
            remaining = remaining.slice(match[0].length).trim();
            continue;
          }
        }

        const idMatch = remaining.match(/^(\d{17,20})\b/);
        if (idMatch) {
          const user =
            this.message.mentions.users.get(idMatch[1]) ??
            this.message.client.users.cache.get(idMatch[1]) ??
            ({ id: idMatch[1] } as User);
          this.values.set(arg.name, user);
          remaining = remaining.slice(idMatch[0].length).trim();
          continue;
        }

        if (arg.required) {
          this.values.set(arg.name, null);
        }
        continue;
      }

      if (arg.type === 'role') {
        const match = remaining.match(/^<@&(\d+)>/);
        if (match) {
          const role = this.message.mentions.roles.get(match[1]) ??
            this.message.guild?.roles.cache.get(match[1]);
          if (role) {
            this.values.set(arg.name, role);
            remaining = remaining.slice(match[0].length).trim();
            continue;
          }
        }

        const nameMatch = remaining.match(/^("([^"]+)"|(\S+))/);
        if (nameMatch && this.message.guild) {
          const roleName = nameMatch[2] ?? nameMatch[3];
          const role = this.message.guild.roles.cache.find(
            (entry) => entry.name.toLowerCase() === roleName.toLowerCase(),
          );
          if (role) {
            this.values.set(arg.name, role);
            remaining = remaining.slice(nameMatch[0].length).trim();
            continue;
          }
        }

        if (arg.required) {
          this.values.set(arg.name, null);
        }
        continue;
      }

      if (arg.type === 'channel') {
        const match = remaining.match(/^<#(\d+)>/);
        if (match) {
          const channel = this.message.mentions.channels.get(match[1]) ??
            this.message.guild?.channels.cache.get(match[1]);
          if (channel) {
            this.values.set(arg.name, channel);
            remaining = remaining.slice(match[0].length).trim();
            continue;
          }
        }

        if (!arg.required) continue;
        this.values.set(arg.name, null);
        continue;
      }

      if (arg.type === 'integer') {
        const match = remaining.match(/^(\d+)\b/);
        if (match) {
          this.values.set(arg.name, Number.parseInt(match[1], 10));
          remaining = remaining.slice(match[0].length).trim();
          continue;
        }

        if (arg.required) {
          this.values.set(arg.name, null);
        }
        continue;
      }

      if (arg.type === 'string') {
        const quoted = remaining.match(/^"([^"]+)"/);
        if (quoted) {
          this.values.set(arg.name, quoted[1]);
          remaining = remaining.slice(quoted[0].length).trim();
          continue;
        }

        const word = remaining.match(/^(\S+)/);
        if (word) {
          this.values.set(arg.name, word[1]);
          remaining = remaining.slice(word[0].length).trim();
          continue;
        }

        if (arg.required) {
          this.values.set(arg.name, null);
        }
        continue;
      }

      if (isLast && remaining) {
        this.values.set(arg.name, remaining.trim());
      }
    }

    if (schema.some((arg) => arg.name === 'channel' && arg.type === 'channel') && !this.values.has('channel')) {
      const messageValue = this.values.get('message');
      if (typeof messageValue === 'string') {
        const channelMatch = messageValue.match(/<#(\d+)>\s*$/);
        if (channelMatch) {
          const channel = this.message.mentions.channels.get(channelMatch[1]) ??
            this.message.guild?.channels.cache.get(channelMatch[1]);
          if (channel) {
            this.values.set('channel', channel);
            this.values.set('message', messageValue.replace(/<#\d+>\s*$/, '').trim());
          }
        }
      }
    }

    const description = this.values.get('description');
    if (typeof description === 'string' && schema.some((arg) => arg.name === 'color')) {
      const colorMatch = description.match(/\s(#?[0-9a-fA-F]{6})\s*$/);
      if (colorMatch) {
        this.values.set('color', colorMatch[1]);
        this.values.set('description', description.slice(0, -colorMatch[0].length).trim());
      }
    }
  }

  getUser(name: string, required?: false): User | null;
  getUser(name: string, required: true): User;
  getUser(name: string, required = false): User | null {
    const value = this.values.get(name);
    if (value instanceof User || (value && typeof value === 'object' && 'id' in value)) {
      return value as User;
    }
    if (required) {
      throw new Error(`Missing required user argument: ${name}`);
    }
    return null;
  }

  getString(name: string, required?: false): string | null;
  getString(name: string, required: true): string;
  getString(name: string, required = false): string | null {
    const value = this.values.get(name);
    if (typeof value === 'string' && value.length > 0) {
      return value;
    }
    if (required) {
      throw new Error(`Missing required string argument: ${name}`);
    }
    return null;
  }

  getInteger(name: string, required?: false): number | null;
  getInteger(name: string, required: true): number;
  getInteger(name: string, required = false): number | null {
    const value = this.values.get(name);
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }
    if (required) {
      throw new Error(`Missing required integer argument: ${name}`);
    }
    return null;
  }

  getRole(name: string, required?: false): import('discord.js').Role | null;
  getRole(name: string, required: true): import('discord.js').Role;
  getRole(name: string, required = false): import('discord.js').Role | null {
    const value = this.values.get(name);
    if (value && typeof value === 'object' && 'id' in value && 'guild' in value) {
      return value as import('discord.js').Role;
    }
    if (required) {
      throw new Error(`Missing required role argument: ${name}`);
    }
    return null;
  }

  getChannel(name: string, required?: false): import('discord.js').GuildBasedChannel | null;
  getChannel(name: string, required: true): import('discord.js').GuildBasedChannel;
  getChannel(name: string, required = false): import('discord.js').GuildBasedChannel | null {
    const value = this.values.get(name);
    if (value && typeof value === 'object' && 'id' in value && 'type' in value) {
      return value as import('discord.js').GuildBasedChannel;
    }
    if (required) {
      throw new Error(`Missing required channel argument: ${name}`);
    }
    return null;
  }
}

export class PrefixCommandInteraction {
  readonly commandName: string;
  readonly options: PrefixOptions;
  readonly user: User;
  readonly member: GuildMember | null;
  readonly guild: Message['guild'];
  readonly guildId: string | null;
  readonly channel: Message['channel'];
  readonly client: Message['client'];
  readonly createdTimestamp: number;

  private readonly message: Message;
  private replyMessage: Message | null = null;
  private _replied = false;
  private _deferred = false;

  constructor(
    message: Message,
    commandName: string,
    rawArgs: string,
  ) {
    this.message = message;
    this.commandName = commandName;
    this.user = message.author;
    this.member = message.member;
    this.guild = message.guild;
    this.guildId = message.guild?.id ?? null;
    this.channel = message.channel;
    this.client = message.client;
    this.createdTimestamp = message.createdTimestamp;
    const schema = prefixSchemas[commandName] ?? [];
    this.options = new PrefixOptions(message, schema, rawArgs);
  }

  inGuild(): boolean {
    return !!this.guild;
  }

  get replied(): boolean {
    return this._replied;
  }

  get deferred(): boolean {
    return this._deferred;
  }

  async reply(payload: ReplyPayload & { fetchReply?: boolean; ephemeral?: boolean }): Promise<Message> {
    this._replied = true;
    const { fetchReply: _fetchReply, ephemeral: _ephemeral, ...rest } = payload as import('discord.js').InteractionReplyOptions;
    const sent = await this.message.reply(rest as unknown as MessagePayload);
    this.replyMessage = sent;
    return sent;
  }

  async editReply(payload: ReplyPayload): Promise<Message> {
    if (this.replyMessage) {
      return this.replyMessage.edit(payload as MessagePayload);
    }
    return this.reply(payload);
  }

  async deferReply(): Promise<void> {
    this._deferred = true;
    this._replied = true;
    const sent = await this.message.reply({ content: 'Processing...' });
    this.replyMessage = sent;
  }

  async followUp(payload: ReplyPayload): Promise<Message> {
    return this.message.reply(payload as unknown as MessagePayload);
  }
}

export function parsePrefixMessage(
  content: string,
  prefix: string,
): { command: string; args: string } | null {
  if (!content.startsWith(prefix)) return null;

  // Only strip leading whitespace so newlines in the message body are kept
  const body = content.slice(prefix.length).replace(/^[^\S\n]+/, '');
  if (!body) return null;

  const match = body.match(/^(\S+)(?:[^\S\n]+([\s\S]*))?$/);
  if (!match) return null;

  return {
    command: match[1].toLowerCase(),
    args: (match[2] ?? '').replace(/\s+$/, ''),
  };
}

export function asSlashInteraction(
  interaction: PrefixCommandInteraction | import('discord.js').ChatInputCommandInteraction,
): import('discord.js').ChatInputCommandInteraction {
  return interaction as unknown as import('discord.js').ChatInputCommandInteraction;
}

export function isTextCommandChannel(channel: Message['channel']): boolean {
  return channel.isTextBased() && !channel.isDMBased();
}

export function buildMissingArgsMessage(command: string, prefix = '.'): string {
  return `Usage: \`${buildUsageLine(command, prefix)}\``;
}
