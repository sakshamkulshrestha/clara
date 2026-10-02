import { config } from '../config';
import { type Command, embed, say, show } from '../lib/util';
import { moderation } from './moderation';
import { utilities } from './utilities';
import { ai } from './ai';

const help: Command = {
  name: 'help', aliases: ['h'], desc: 'list commands', usage: '[command]',
  async run(msg, args) {
    if (args[0]) {
      const c = commands.get(args[0].toLowerCase());
      if (!c) return say(msg, 'no such command.');
      const aliases = c.aliases ? `\naliases: ${c.aliases.join(', ')}` : '';
      return say(msg, `${config.prefix}${c.name} ${c.usage ?? ''}\n${c.desc}${aliases}`);
    }
    const body = Object.entries(categories).map(([name, list]) => `**${name}**\n${list.map((c) => c.name).join(', ')}`);
    return show(msg, embed().setDescription(`${body.join('\n\n')}\n\nprefix: ${config.prefix}  /  ping me to talk`));
  },
};

const categories: Record<string, Command[]> = { moderation, utilities: [...utilities, help], ai };

export const commands = new Map<string, Command>();
for (const list of Object.values(categories)) {
  for (const c of list) {
    commands.set(c.name, c);
    c.aliases?.forEach((a) => commands.set(a, c));
  }
}
