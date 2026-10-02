import { ChannelType, EmbedBuilder, type GuildBasedChannel, type GuildMember, type Message } from 'discord.js';
import { config } from '../config';
import { actionLine } from './ai';

export type Msg = Message<true>;

export interface Command {
  name: string;
  aliases?: string[];
  desc: string;
  usage?: string;
  perm?: bigint;
  run: (msg: Msg, args: string[]) => Promise<unknown>;
}

// ---------- output ----------
export const say = (msg: Msg, content: string, ping: string[] = []) =>
  msg.reply({ content, allowedMentions: { parse: [], users: ping, repliedUser: false } });

export const embed = () => new EmbedBuilder().setColor(config.color);

export const show = (msg: Msg, e: EmbedBuilder) =>
  msg.reply({ embeds: [e], allowedMentions: { parse: [], repliedUser: false } });

export const info = (title: string, rows: [string, string | number][], thumb?: string | null) => {
  const e = embed().setTitle(title).setDescription(rows.map(([k, v]) => `**${k}** ${v}`).join('\n'));
  if (thumb) e.setThumbnail(thumb);
  return e;
};

// ai generated reply for an executed command
export async function done(msg: Msg, action: string, detail: string, fallback: string, ping?: string) {
  const line = await actionLine(action, `moderator: ${msg.member?.displayName}\n${detail}`, fallback);
  return say(msg, ping ? `<@${ping}> ${line}` : line, ping ? [ping] : []);
}

// ---------- parsing ----------
export const stamp = (d: Date | number | null) => (d ? `<t:${Math.floor(new Date(d).getTime() / 1000)}:R>` : 'unknown');

export const idOf = (s?: string) => s?.match(/\d{15,20}/)?.[0] ?? null;

export async function member(msg: Msg, arg?: string): Promise<GuildMember | null> {
  const id = idOf(arg);
  return id ? msg.guild.members.fetch(id).catch(() => null) : null;
}

export async function user(msg: Msg, arg?: string) {
  const id = idOf(arg);
  return id ? msg.client.users.fetch(id, { force: true }).catch(() => null) : null;
}

// user from arg, or the author when no arg is given
export const who = (msg: Msg, arg?: string) => user(msg, arg ?? msg.author.id);

export function role(msg: Msg, query: string) {
  const id = idOf(query);
  const q = query.toLowerCase();
  return (id ? msg.guild.roles.cache.get(id) : null) ?? msg.guild.roles.cache.find((r) => r.name.toLowerCase() === q) ?? null;
}

export function channel(msg: Msg, arg?: string): GuildBasedChannel | null {
  const id = idOf(arg);
  return id ? msg.guild.channels.cache.get(id) ?? null : msg.channel;
}

export function textChannel(msg: Msg, arg?: string) {
  const c = channel(msg, arg);
  return c && (c.type === ChannelType.GuildText || c.type === ChannelType.GuildAnnouncement) ? c : null;
}

const units = { s: 1e3, m: 6e4, h: 36e5, d: 864e5, w: 6048e5 };
export function duration(s?: string) {
  const m = s?.match(/^(\d+)([smhdw])$/i);
  return m ? Number(m[1]) * units[m[2].toLowerCase() as keyof typeof units] : null;
}

// stops moderators from acting on people above them
export function guard(msg: Msg, target: GuildMember): string | null {
  if (target.id === msg.author.id) return 'not yourself.';
  if (target.id === msg.client.user.id) return 'cute try.';
  if (target.id === msg.guild.ownerId) return 'that is the owner.';
  if (msg.author.id !== msg.guild.ownerId && target.roles.highest.position >= msg.member!.roles.highest.position)
    return 'they outrank you.';
  return null;
}
