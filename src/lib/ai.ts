import type { Message } from 'discord.js';
import { config } from '../config';

export type Turn = { role: 'system' | 'user' | 'assistant'; content: string };

export const persona =
  'you are a discord bot with a feminine personality. you are nasty, a little arrogant, dry and playfully mean, ' +
  'like you are above everyone but still keep up. always write in lowercase only, no emojis, no markdown, no hashtags. ' +
  'keep replies extremely short, one or two short sentences max. minimal, never gush, never over explain. ' +
  'when someone asks something real, still answer it correctly, just briefly and with attitude. ' +
  'tease lightly. never be hateful about identity, never threaten, never encourage self harm.';

const offline = ['my brain is offline. try later.', 'not now.', 'i am ignoring you. technically.'];
const pick = <T>(list: T[]) => list[Math.floor(Math.random() * list.length)];

const clean = (text: string) =>
  text.replace(/\p{Extended_Pictographic}/gu, '').replace(/[*~`#]/g, '').toLowerCase().trim().slice(0, 500);

// nvidia nim is openai compatible
export async function chat(messages: Turn[], maxTokens = 150, temperature = 0.9): Promise<string | null> {
  if (!config.nvidiaKey) return null;
  try {
    const res = await fetch('https://integrate.api.nvidia.com/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${config.nvidiaKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: config.model, messages, max_tokens: maxTokens, temperature, top_p: 0.9 }),
      signal: AbortSignal.timeout(20000),
    });
    if (!res.ok) {
      console.error('nvidia error', res.status, await res.text());
      return null;
    }
    const json: any = await res.json();
    return clean(json.choices?.[0]?.message?.content ?? '') || null;
  } catch (err) {
    console.error('nvidia error', err);
    return null;
  }
}

// per user memory, last 12 turns
const memory = new Map<string, Turn[]>();
export const forget = (guildId: string, userId: string) => memory.delete(`${guildId}:${userId}`);

// conversational reply with user history + server context
export async function respond(msg: Message<true>, text: string): Promise<string> {
  const key = `${msg.guildId}:${msg.author.id}`;
  const history = memory.get(key) ?? [];
  const name = msg.member?.displayName ?? msg.author.username;

  const recent = await msg.channel.messages.fetch({ limit: 8, before: msg.id }).catch(() => null);
  const log = recent
    ? [...recent.values()].reverse().map((m) => `${m.member?.displayName ?? m.author.username}: ${m.content.slice(0, 200)}`).join('\n')
    : '';
  const roles = msg.member?.roles.cache.filter((r) => r.id !== msg.guildId).map((r) => r.name).slice(0, 8).join(', ') || 'none';

  const system =
    `${persona}\n\nserver: ${msg.guild.name}, ${msg.guild.memberCount} members` +
    `\nchannel: ${msg.channel.name}\nspeaker: ${name} (roles: ${roles})\nrecent messages:\n${log}`;

  const out = await chat([{ role: 'system', content: system }, ...history, { role: 'user', content: text }]);
  if (!out) return pick(offline);

  const turns: Turn[] = [...history, { role: 'user', content: text }, { role: 'assistant', content: out }];
  memory.set(key, turns.slice(-12));
  return out;
}

// short unique line announcing a command that was just executed
const recentLines: string[] = [];

export async function actionLine(action: string, detail: string, fallback: string): Promise<string> {
  const avoid = recentLines.length ? ` never repeat or echo these earlier lines: ${recentLines.join(' | ')}.` : '';
  const out = await chat(
    [
      {
        role: 'system',
        content:
          `${persona} you just carried out an action. write exactly one fresh line, under 12 words, reacting to it. ` +
          `sassy and playful, mention the target by name if there is one.${avoid}`,
      },
      { role: 'user', content: `action: ${action}\n${detail}` },
    ],
    40,
    1.1,
  );
  const line = out?.split('\n')[0];
  if (!line) return fallback;
  recentLines.push(line);
  if (recentLines.length > 6) recentLines.shift();
  return line;
}
