import { PermissionsBitField } from 'discord.js';
import { db, save } from '../lib/db';
import { chat, persona, respond } from '../lib/ai';
import { type Command, done, say, textChannel, who } from '../lib/util';

const aichannel: Command = {
  name: 'aichannel', aliases: ['aic'], desc: 'toggle ai replies to every message in a channel', usage: '[#channel]',
  perm: PermissionsBitField.Flags.ManageGuild,
  async run(msg, args) {
    const ch = textChannel(msg, args[0]);
    if (!ch) return say(msg, 'text channels only.');
    const i = db.aiChannels.indexOf(ch.id);
    if (i >= 0) db.aiChannels.splice(i, 1);
    else db.aiChannels.push(ch.id);
    save();
    return i >= 0
      ? done(msg, 'ai channel disabled', `channel: ${ch.name}`, 'fine. i am done talking there.')
      : done(msg, 'ai channel enabled, you will now answer everyone in it', `channel: ${ch.name}`, 'ok. i will talk to everyone there.');
  },
};

const ask: Command = {
  name: 'ask', desc: 'ask the ai something', usage: '<text>',
  async run(msg, args) {
    if (!args.length) return say(msg, 'ask what.');
    await msg.channel.sendTyping();
    return say(msg, await respond(msg, args.join(' ')));
  },
};

const roast: Command = {
  name: 'roast', desc: 'light roast of someone', usage: '[user]',
  async run(msg, args) {
    const u = await who(msg, args[0]);
    if (!u) return say(msg, 'who.');
    await msg.channel.sendTyping();
    const out = await chat(
      [
        { role: 'system', content: `${persona} roast the person given. one short line, playful not cruel, nothing about identity or appearance.` },
        { role: 'user', content: u.username },
      ],
      60,
      1.1,
    );
    return say(msg, out ?? 'you are not even worth the tokens.');
  },
};

export const ai: Command[] = [aichannel, ask, roast];
