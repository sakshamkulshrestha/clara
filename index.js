import 'dotenv/config';

import {
  Client,
  GatewayIntentBits,
  REST,
  Routes,
} from 'discord.js';

import { helpCommand } from './src/commands/help/index.js';
import { utilityCommands } from './src/commands/utility/index.js';
import { moderationCommands } from './src/commands/moderation/index.js';
import {
  aiCommands,
  handleAIMessage,
} from './src/commands/ai/index.js';

import { restoreReminders } from './src/utils/reminders.js';
import { startStatusRotation } from './src/utils/status.js';

import {
  setHealthBot,
  startHealthServer,
} from './src/health.js';

const token = process.env.DISCORD_TOKEN;

if (!token) {
  throw new Error('missing DISCORD_TOKEN in .env');
}

const commands = [
  helpCommand,
  ...utilityCommands,
  ...moderationCommands,
  ...aiCommands,
];

const commandMap = new Map();

for (const command of commands) {
  commandMap.set(command.name, command);

  for (const alias of command.aliases || []) {
    commandMap.set(alias, command);
  }
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
  ],
});

client.once('clientReady', async (bot) => {
  console.log(`online as ${bot.user.tag}`);

  startStatusRotation(bot);
  restoreReminders(bot);

  const rest = new REST({ version: '10' }).setToken(token);

  const slashCommands = [];

  for (const command of commands) {
    slashCommands.push({
      name: command.name,
      description: command.description,
      options: command.options || [],
    });

    for (const alias of command.aliases || []) {
      slashCommands.push({
        name: alias,
        description: command.description,
        options: command.options || [],
      });
    }
  }

  for (const guild of bot.guilds.cache.values()) {
    await rest.put(
      Routes.applicationGuildCommands(
        bot.user.id,
        guild.id,
      ),
      {
        body: slashCommands,
      },
    );

    console.log(
      `commands registered in ${guild.name}`,
    );
  }
});

client.on('messageCreate', async (message) => {
  if (message.author.bot) return;
  if (!message.guild) return;

  if (message.content.startsWith('.')) {
    const input = message.content
      .slice(1)
      .trim();

    if (!input) return;

    const parts = input.split(/\s+/);

    const name =
      parts.shift()?.toLowerCase();

    if (!name) return;

    const command =
      commandMap.get(name);

    if (!command?.prefix) return;

    try {
      await command.prefix({
        message,
        args: parts,
        client,
      });
    } catch (error) {
      console.error(
        'prefix command error:',
        error,
      );

      await message
        .reply('something went wrong.')
        .catch(() => {});
    }

    return;
  }

  await handleAIMessage(
    message,
    client,
  );
});

client.on('interactionCreate', async (interaction) => {
  if (!interaction.isChatInputCommand()) return;
  if (!interaction.guild) return;

  const command = commandMap.get(
    interaction.commandName,
  );

  if (!command?.slash) return;

  try {
    await command.slash({
      interaction,
      client,
    });
  } catch (error) {
    console.error(
      'slash command error:',
      error,
    );

    if (
      interaction.replied ||
      interaction.deferred
    ) {
      await interaction
        .followUp('something went wrong.')
        .catch(() => {});
    } else {
      await interaction
        .reply('something went wrong.')
        .catch(() => {});
    }
  }
});

client.on('error', (error) => {
  console.error(
    'discord client error:',
    error,
  );
});

process.on('unhandledRejection', (error) => {
  console.error(
    'unhandled rejection:',
    error,
  );
});

setHealthBot(client);
startHealthServer();

client.login(token);