import { ChannelType } from 'discord.js';
import { type Command, channel, embed, info, member, role, say, show, stamp, user, who } from '../lib/util';

const avatar: Command = {
  name: 'avatar', aliases: ['av', 'pfp'], desc: 'show an avatar', usage: '[user]',
  async run(msg, args) {
    const u = await who(msg, args[0]);
    if (!u) return say(msg, 'who.');
    return show(msg, embed().setTitle(u.username).setImage(u.displayAvatarURL({ size: 1024 })));
  },
};

const banner: Command = {
  name: 'banner', aliases: ['ub', 'userbanner'], desc: 'show a user banner', usage: '[user]',
  async run(msg, args) {
    const u = await who(msg, args[0]);
    const url = u?.bannerURL({ size: 1024 });
    if (!u) return say(msg, 'who.');
    if (!url) return say(msg, 'no banner.');
    return show(msg, embed().setTitle(u.username).setImage(url));
  },
};

const serverbanner: Command = {
  name: 'serverbanner', aliases: ['sb'], desc: 'show the server banner',
  async run(msg) {
    const url = msg.guild.bannerURL({ size: 1024 });
    if (!url) return say(msg, 'no server banner.');
    return show(msg, embed().setTitle(msg.guild.name).setImage(url));
  },
};

const servericon: Command = {
  name: 'servericon', aliases: ['icon'], desc: 'show the server icon',
  async run(msg) {
    const url = msg.guild.iconURL({ size: 1024 });
    if (!url) return say(msg, 'no server icon.');
    return show(msg, embed().setTitle(msg.guild.name).setImage(url));
  },
};

const userinfo: Command = {
  name: 'userinfo', aliases: ['ui', 'whois'], desc: 'info about a user', usage: '[user]',
  async run(msg, args) {
    const u = await who(msg, args[0]);
    if (!u) return say(msg, 'who.');
    const m = await member(msg, u.id);
    const rows: [string, string | number][] = [
      ['name', u.username],
      ['id', u.id],
      ['bot', u.bot ? 'yes' : 'no'],
      ['created', stamp(u.createdAt)],
      ['joined', m ? stamp(m.joinedAt) : 'not in server'],
    ];
    if (m) rows.push(['top role', m.roles.highest.name], ['roles', m.roles.cache.size - 1]);
    return show(msg, info('user', rows, u.displayAvatarURL()));
  },
};

const channelinfo: Command = {
  name: 'channelinfo', aliases: ['ci'], desc: 'info about a channel', usage: '[#channel]',
  async run(msg, args) {
    const c = channel(msg, args[0]);
    if (!c) return say(msg, 'no such channel.');
    const rows: [string, string | number][] = [
      ['name', c.name],
      ['id', c.id],
      ['type', ChannelType[c.type].replace('Guild', '').toLowerCase()],
      ['created', stamp(c.createdAt)],
      ['category', c.parent?.name ?? 'none'],
    ];
    if ('topic' in c && c.topic) rows.push(['topic', c.topic.slice(0, 200)]);
    if ('rateLimitPerUser' in c && c.rateLimitPerUser) rows.push(['slowmode', `${c.rateLimitPerUser}s`]);
    if ('nsfw' in c) rows.push(['nsfw', c.nsfw ? 'yes' : 'no']);
    return show(msg, info('channel', rows));
  },
};

const roleinfo: Command = {
  name: 'roleinfo', aliases: ['ri'], desc: 'info about a role', usage: '<role>',
  async run(msg, args) {
    const r = role(msg, args.join(' '));
    if (!r) return say(msg, 'no such role.');
    return show(msg, info('role', [
      ['name', r.name],
      ['id', r.id],
      ['color', r.hexColor],
      ['position', r.position],
      ['hoisted', r.hoist ? 'yes' : 'no'],
      ['mentionable', r.mentionable ? 'yes' : 'no'],
      ['managed', r.managed ? 'yes' : 'no'],
      ['created', stamp(r.createdAt)],
    ]));
  },
};

const serverinfo: Command = {
  name: 'serverinfo', aliases: ['si', 'guildinfo'], desc: 'info about the server',
  async run(msg) {
    const g = msg.guild;
    return show(msg, info('server', [
      ['name', g.name],
      ['id', g.id],
      ['owner', `<@${g.ownerId}>`],
      ['members', g.memberCount],
      ['channels', g.channels.cache.size],
      ['roles', g.roles.cache.size],
      ['boosts', g.premiumSubscriptionCount ?? 0],
      ['created', stamp(g.createdAt)],
    ], g.iconURL()));
  },
};

const membercount: Command = {
  name: 'membercount', aliases: ['mc'], desc: 'member count',
  async run(msg) {
    return say(msg, `${msg.guild.memberCount} members.`);
  },
};

const roles: Command = {
  name: 'roles', desc: 'list server roles',
  async run(msg) {
    const list = msg.guild.roles.cache
      .filter((r) => r.id !== msg.guildId)
      .sort((a, b) => b.position - a.position)
      .map((r) => `<@&${r.id}>`)
      .join(' ');
    return show(msg, embed().setTitle('roles').setDescription(list.slice(0, 4000) || 'none'));
  },
};

const ping: Command = {
  name: 'ping', desc: 'check latency',
  async run(msg) {
    return say(msg, `${Math.round(msg.client.ws.ping)}ms.`);
  },
};

export const utilities: Command[] = [
  avatar, banner, serverbanner, servericon, userinfo, channelinfo, roleinfo, serverinfo, membercount, roles, ping,
];
