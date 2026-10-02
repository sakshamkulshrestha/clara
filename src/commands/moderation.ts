import { PermissionsBitField } from 'discord.js';
import { db, save } from '../lib/db';
import { actionLine } from '../lib/ai';
import {
  type Command, type Msg, done, duration, embed, guard, idOf, member, role, say, show, stamp, textChannel, user,
} from '../lib/util';

const F = PermissionsBitField.Flags;
const reasonOf = (args: string[], from: number) => args.slice(from).join(' ') || 'no reason';
const audit = (msg: Msg, reason: string) => `${msg.author.username}: ${reason}`;

// fetches a member and makes sure the moderator can act on them
async function target(msg: Msg, arg?: string) {
  const m = await member(msg, arg);
  if (!m) {
    await say(msg, 'who.');
    return null;
  }
  const err = guard(msg, m);
  if (err) {
    await say(msg, err);
    return null;
  }
  return m;
}

const ban: Command = {
  name: 'ban', desc: 'ban a user, even if not in the server', usage: '<user> [reason]', perm: F.BanMembers,
  async run(msg, args) {
    const u = await user(msg, args[0]);
    if (!u) return say(msg, 'who.');
    const m = await member(msg, args[0]);
    if (m) {
      const err = guard(msg, m);
      if (err) return say(msg, err);
      if (!m.bannable) return say(msg, 'i cannot ban that one.');
    }
    const reason = reasonOf(args, 1);
    await msg.guild.members.ban(u, { reason: audit(msg, reason) });
    return done(msg, 'ban', `target: ${u.username}\nreason: ${reason}`, 'gone.');
  },
};

const unban: Command = {
  name: 'unban', desc: 'unban a user by id', usage: '<id> [reason]', perm: F.BanMembers,
  async run(msg, args) {
    const id = idOf(args[0]);
    if (!id) return say(msg, 'give an id.');
    const reason = reasonOf(args, 1);
    const ok = await msg.guild.members.unban(id, audit(msg, reason)).then(() => true).catch(() => false);
    if (!ok) return say(msg, 'not banned.');
    return done(msg, 'unban', `target id: ${id}\nreason: ${reason}`, 'forgiven. once.');
  },
};

const kick: Command = {
  name: 'kick', desc: 'kick a member', usage: '<user> [reason]', perm: F.KickMembers,
  async run(msg, args) {
    const m = await target(msg, args[0]);
    if (!m) return;
    if (!m.kickable) return say(msg, 'i cannot kick that one.');
    const reason = reasonOf(args, 1);
    await m.kick(audit(msg, reason));
    return done(msg, 'kick', `target: ${m.displayName}\nreason: ${reason}`, 'out.');
  },
};

const timeout: Command = {
  name: 'timeout', aliases: ['mute', 'to'], desc: 'timeout a member', usage: '<user> <10m|2h|1d> [reason]', perm: F.ModerateMembers,
  async run(msg, args) {
    const m = await target(msg, args[0]);
    if (!m) return;
    const ms = duration(args[1]);
    if (!ms || ms > 28 * 864e5) return say(msg, 'give a duration. like 10m, 2h, 1d. max 28d.');
    if (!m.moderatable) return say(msg, 'i cannot time that one out.');
    const reason = reasonOf(args, 2);
    await m.timeout(ms, audit(msg, reason));
    return done(msg, 'timeout', `target: ${m.displayName}\nduration: ${args[1]}\nreason: ${reason}`, 'quiet now.', m.id);
  },
};

const untimeout: Command = {
  name: 'untimeout', aliases: ['unmute'], desc: 'remove a timeout', usage: '<user>', perm: F.ModerateMembers,
  async run(msg, args) {
    const m = await member(msg, args[0]);
    if (!m) return say(msg, 'who.');
    if (!m.moderatable) return say(msg, 'i cannot touch that one.');
    await m.timeout(null);
    return done(msg, 'timeout removed', `target: ${m.displayName}`, 'you may speak.', m.id);
  },
};

const warn: Command = {
  name: 'warn', desc: 'warn a member', usage: '<user> [reason]', perm: F.ModerateMembers,
  async run(msg, args) {
    const m = await target(msg, args[0]);
    if (!m) return;
    const reason = reasonOf(args, 1);
    const list = (db.warnings[`${msg.guildId}:${m.id}`] ??= []);
    list.push({ mod: msg.author.id, reason, at: Date.now() });
    save();
    return done(msg, 'warn', `target: ${m.displayName}\nreason: ${reason}\ntotal warnings: ${list.length}`, `warned. that is ${list.length}.`, m.id);
  },
};

const warnings: Command = {
  name: 'warnings', aliases: ['warns'], desc: 'list warnings', usage: '[user]', perm: F.ModerateMembers,
  async run(msg, args) {
    const m = args[0] ? await member(msg, args[0]) : msg.member;
    if (!m) return say(msg, 'who.');
    const list = db.warnings[`${msg.guildId}:${m.id}`] ?? [];
    if (!list.length) return say(msg, 'clean. for now.');
    const lines = list.map((w, i) => `${i + 1}. ${w.reason} - <@${w.mod}> ${stamp(w.at)}`);
    return show(msg, embed().setTitle(`${m.displayName} / warnings`).setDescription(lines.join('\n').slice(0, 4000)));
  },
};

const clearwarns: Command = {
  name: 'clearwarns', desc: 'clear all warnings of a member', usage: '<user>', perm: F.ModerateMembers,
  async run(msg, args) {
    const m = await member(msg, args[0]);
    if (!m) return say(msg, 'who.');
    delete db.warnings[`${msg.guildId}:${m.id}`];
    save();
    return done(msg, 'warnings cleared', `target: ${m.displayName}`, 'slate wiped.');
  },
};

const purge: Command = {
  name: 'purge', aliases: ['clear'], desc: 'delete messages, optionally from one user', usage: '<1-100> [user]', perm: F.ManageMessages,
  async run(msg, args) {
    const n = parseInt(args[0]);
    if (!n || n < 1 || n > 100) return say(msg, 'give a number. 1 to 100.');
    const only = idOf(args[1]);
    await msg.delete().catch(() => {});
    let found = await msg.channel.messages.fetch({ limit: 100 });
    if (only) found = found.filter((m) => m.author.id === only);
    const deleted = await msg.channel.bulkDelete(found.first(n), true);
    const line = await actionLine('purge', `moderator: ${msg.member?.displayName}\ncount: ${deleted.size}${only ? '\nfiltered to a single user' : ''}`, `${deleted.size} gone.`);
    const sent = await msg.channel.send({ content: line, allowedMentions: { parse: [] } });
    setTimeout(() => sent.delete().catch(() => {}), 5000);
  },
};

const toggleLock = (locked: boolean): Command => ({
  name: locked ? 'lock' : 'unlock',
  desc: `${locked ? 'lock' : 'unlock'} a channel`,
  usage: '[#channel]',
  perm: F.ManageChannels,
  async run(msg, args) {
    const ch = textChannel(msg, args[0]);
    if (!ch) return say(msg, 'text channels only.');
    await ch.permissionOverwrites.edit(msg.guild.roles.everyone, { SendMessages: locked ? false : null });
    return done(msg, locked ? 'lock channel' : 'unlock channel', `channel: ${ch.name}`, locked ? 'locked.' : 'unlocked.');
  },
});

const slowmode: Command = {
  name: 'slowmode', aliases: ['sm'], desc: 'set slowmode in seconds, or off', usage: '<seconds|off> [#channel]', perm: F.ManageChannels,
  async run(msg, args) {
    const s = args[0] === 'off' ? 0 : parseInt(args[0]);
    const ch = textChannel(msg, args[1]);
    if (isNaN(s) || s < 0 || s > 21600) return say(msg, 'give seconds. 0 to 21600.');
    if (!ch) return say(msg, 'text channels only.');
    await ch.setRateLimitPerUser(s);
    return done(msg, 'slowmode', `channel: ${ch.name}\nseconds: ${s}`, s ? `${s}s. slow down.` : 'slowmode off.');
  },
};

// role changes need both the moderator and the bot to outrank the role
function roleError(msg: Msg, r: { editable: boolean; position: number }) {
  if (!r.editable) return 'i cannot manage that role.';
  if (msg.author.id !== msg.guild.ownerId && r.position >= msg.member!.roles.highest.position) return 'that role is above you.';
  return null;
}

const roleCmd = (give: boolean): Command => ({
  name: give ? 'addrole' : 'removerole',
  aliases: give ? ['role', 'ar'] : ['rr'],
  desc: give ? 'give a role to a member' : 'take a role from a member',
  usage: '<user> <role>',
  perm: F.ManageRoles,
  async run(msg, args) {
    const m = await member(msg, args[0]);
    const r = role(msg, args.slice(1).join(' '));
    if (!m || !r) return say(msg, `usage: ${give ? 'addrole' : 'removerole'} <user> <role>`);
    const err = roleError(msg, r);
    if (err) return say(msg, err);
    await (give ? m.roles.add(r, audit(msg, 'role')) : m.roles.remove(r, audit(msg, 'role')));
    return done(msg, give ? 'role given' : 'role removed', `target: ${m.displayName}\nrole: ${r.name}`, give ? 'promoted. barely.' : 'role gone.');
  },
});

const nick: Command = {
  name: 'nick', desc: 'change a nickname, or reset', usage: '<user> <nickname|reset>', perm: F.ManageNicknames,
  async run(msg, args) {
    const m = await target(msg, args[0]);
    if (!m) return;
    const name = args.slice(1).join(' ');
    if (!name) return say(msg, 'give a nickname, or reset.');
    if (!m.manageable) return say(msg, 'i cannot rename that one.');
    await m.setNickname(name === 'reset' ? null : name.slice(0, 32), audit(msg, 'nick'));
    return done(msg, 'nickname changed', `target: ${m.user.username}\nnew nickname: ${name}`, 'renamed.');
  },
};

export const moderation: Command[] = [
  ban, unban, kick, timeout, untimeout, warn, warnings, clearwarns, purge,
  toggleLock(true), toggleLock(false), slowmode, roleCmd(true), roleCmd(false), nick,
];
