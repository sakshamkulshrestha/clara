import { ActivityType, Client, Events, GatewayIntentBits } from 'discord.js';
import { config } from './config';
import { commands } from './commands';
import { db } from './lib/db';
import { respond } from './lib/ai';
import { say } from './lib/util';

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent],
});

client.once(Events.ClientReady, (c) => {
  console.log(`online as ${c.user.tag}`);
  c.user.setActivity('you, unimpressed', { type: ActivityType.Watching });
});

client.on(Events.MessageCreate, async (msg) => {
  if (msg.author.bot || !msg.inGuild()) return;

  // prefix commands
  if (msg.content.startsWith(config.prefix)) {
    const [name, ...args] = msg.content.slice(config.prefix.length).trim().split(/\s+/);
    const cmd = commands.get(name?.toLowerCase() ?? '');
    if (cmd) {
      if (cmd.perm && !msg.member?.permissions.has(cmd.perm)) return void say(msg, 'you wish.');
      try {
        await cmd.run(msg, args);
      } catch (err) {
        console.error(`${cmd.name} failed`, err);
        await say(msg, 'that failed. check my permissions.').catch(() => {});
      }
      return;
    }
  }

  // ai: when pinged, or anywhere inside an ai channel
  const pinged = msg.mentions.has(client.user!, { ignoreEveryone: true, ignoreRoles: true });
  if (!pinged && !db.aiChannels.includes(msg.channelId)) return;

  const text = msg.content.replace(new RegExp(`<@!?${client.user!.id}>`, 'g'), '').trim();
  if (!text) return void (pinged && say(msg, 'yes?'));

  try {
    await msg.channel.sendTyping();
    await say(msg, await respond(msg, text));
  } catch (err) {
    console.error('ai failed', err);
  }
});

client.login(config.token);
