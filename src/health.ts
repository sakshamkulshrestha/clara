import 'dotenv/config';
import { REST, Routes } from 'discord.js';

type SQLiteStatement = { get(): Record<string, unknown> | undefined };
type SQLiteDatabase = { prepare(sql: string): SQLiteStatement; close(): void };
type SQLiteModule = { DatabaseSync: new (path: string) => SQLiteDatabase };

let failed = false;

function messageOf(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return message.replace(/\s+/g, ' ').slice(0, 180);
}

async function check(name: string, run: () => Promise<void> | void) {
  try {
    await run();
    console.log(`[ok] ${name}`);
  } catch (error) {
    failed = true;
    console.error(`[fail] ${name}\n${messageOf(error)}`);
  }
}

async function main() {
  await check('environment', () => {
    const required = ['DISCORD_TOKEN', 'DISCORD_CLIENT_ID', 'NVIDIA_API_KEY', 'NVIDIA_MODEL'];
    const missing = required.filter((key) => !process.env[key]?.trim());
    if (missing.length) throw new Error(`missing ${missing.join(', ')}`);
  });

  await check('database', () => {
    const { DatabaseSync } = require('node:sqlite') as SQLiteModule;
    const database = new DatabaseSync(':memory:');
    try {
      if (database.prepare('SELECT 1 AS ok').get()?.ok !== 1) {
        throw new Error('SELECT 1 returned an unexpected result');
      }
    } finally {
      database.close();
    }
  });

  await check('discord token', async () => {
    const token = process.env.DISCORD_TOKEN?.trim();
    if (!token) throw new Error('DISCORD_TOKEN is missing');
    const rest = new REST({ version: '10' }).setToken(token);
    await rest.get(Routes.user('@me'));
  });

  await check('nvidia model', async () => {
    const apiKey = process.env.NVIDIA_API_KEY?.trim();
    const model = process.env.NVIDIA_MODEL?.trim();
    if (!apiKey || !model) throw new Error('NVIDIA_API_KEY or NVIDIA_MODEL is missing');

    const baseUrl = (process.env.NVIDIA_BASE_URL || 'https://integrate.api.nvidia.com/v1').replace(/\/+$/, '');
    const response = await fetch(`${baseUrl}/models`, {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) throw new Error(`NVIDIA returned HTTP ${response.status}`);

    const result = await response.json() as {
      data?: { id?: unknown; name?: unknown }[];
      models?: { id?: unknown; name?: unknown }[];
    };
    const models = result.data ?? result.models;
    if (!Array.isArray(models)) throw new Error('NVIDIA returned an invalid model list');
    if (!models.some((entry) => entry.id === model || entry.name === model)) {
      throw new Error(`configured model ${model} was not found`);
    }
  });

  if (failed) {
    process.exitCode = 1;
  } else {
    console.log('\nhealth check: all right.');
  }
}

void main().catch((error: unknown) => {
  failed = true;
  console.error(`[fail] health check\n${messageOf(error)}`);
  process.exitCode = 1;
});
