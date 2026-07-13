import { Message, PartialMessage } from 'discord.js';

export interface SnipeEntry {
  content: string;
  authorTag: string;
  authorId: string;
  authorAvatar?: string;
  createdAt: number;
  deletedAt: number;
  attachments: string[];
}

export interface EditSnipeEntry {
  before: string;
  after: string;
  authorTag: string;
  authorId: string;
  editedAt: number;
}

const deleted = new Map<string, SnipeEntry[]>();
const edited = new Map<string, EditSnipeEntry[]>();

const MAX = 20;

export function pushDeleteSnipe(message: Message | PartialMessage): void {
  if (!message.guild || !message.channel || message.author?.bot) return;
  const channelId = message.channel.id;
  const list = deleted.get(channelId) ?? [];
  list.unshift({
    content: message.content || '*No content*',
    authorTag: message.author?.tag ?? 'Unknown',
    authorId: message.author?.id ?? '0',
    authorAvatar: message.author?.displayAvatarURL(),
    createdAt: message.createdTimestamp ?? Date.now(),
    deletedAt: Date.now(),
    attachments: message.attachments?.map((a) => a.url) ?? [],
  });
  deleted.set(channelId, list.slice(0, MAX));
}

export function pushEditSnipe(before: Message | PartialMessage, after: Message | PartialMessage): void {
  if (!before.guild || !before.channel || before.author?.bot) return;
  if ((before.content ?? '') === (after.content ?? '')) return;
  const channelId = before.channel.id;
  const list = edited.get(channelId) ?? [];
  list.unshift({
    before: before.content || '*No content*',
    after: after.content || '*No content*',
    authorTag: before.author?.tag ?? 'Unknown',
    authorId: before.author?.id ?? '0',
    editedAt: Date.now(),
  });
  edited.set(channelId, list.slice(0, MAX));
}

export function getDeleteSnipe(channelId: string, index = 1): SnipeEntry | null {
  return deleted.get(channelId)?.[index - 1] ?? null;
}

export function getEditSnipe(channelId: string, index = 1): EditSnipeEntry | null {
  return edited.get(channelId)?.[index - 1] ?? null;
}

export function clearSnipes(channelId: string): void {
  deleted.delete(channelId);
  edited.delete(channelId);
}
