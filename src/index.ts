import {
  ActivityType, ChannelType, Client, Events, GatewayIntentBits, PermissionsBitField, SlashCommandBuilder,
} from 'discord.js';
import { config } from './config';
import { commands } from './commands';
import { db } from './lib/db';
import { actionLine, respond } from './lib/ai';
import { setChannelLock } from './commands/moderation';
import { commandError, say } from './lib/util';

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent],
});

client.once(Events.ClientReady, (c) => {
  console.log(`online as ${c.user.tag}`);
  c.user.setActivity('you, unimpressed', { type: ActivityType.Watching });
  void syncLockCommands().catch((err) => console.error('could not register lock slash commands', err));
});

const lockCommands = [true, false].map((locked) => new SlashCommandBuilder()
  .setName(locked ? 'lock' : 'unlock')
  .setDescription(`${locked ? 'lock' : 'unlock'} a text channel`)
  .setDefaultMemberPermissions(PermissionsBitField.Flags.ManageChannels)
  .addChannelOption((option) => option
    .setName('channel')
    .setDescription('channel to change; defaults to this channel')
    .setRequired(false)
    .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)));

async function syncLockCommands() {
  if (!client.application) return;
  const registered = await client.application.commands.fetch();
  for (const definition of lockCommands) {
    const body = definition.toJSON();
    const existing = registered.find((command) => command.name === body.name);
    if (!existing) await client.application.commands.create(body);
  }
}

client.on(Events.MessageCreate, async (msg) => {
  if (msg.author.bot || !msg.inGuild()) return;

  // prefix commands
  if (msg.content.startsWith(config.prefix)) {
    const [name, ...args] = msg.content.slice(config.prefix.length).trim().split(/\s+/);
    const cmd = commands.get(name?.toLowerCase() ?? '');
    if (!name || !cmd) return;
    if (cmd.perm && !msg.member?.permissions.has(cmd.perm)) return void say(msg, 'you need permission to do that.');
    try {
      await cmd.run(msg, args);
    } catch (err) {
      console.error(`${cmd.name} failed`, err);
      await say(msg, commandError(err)).catch(() => {});
    }
    return;
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

client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand()) return;
  if (!['lock', 'unlock'].includes(interaction.commandName)) {
    await interaction.reply({ content: 'that slash command is not handled here.', ephemeral: true }).catch((err) => {
      console.error('could not acknowledge unsupported slash command', err);
    });
    return;
  }
  try {
    await interaction.deferReply({ ephemeral: true });
  } catch (err) {
    console.error('could not acknowledge lock interaction', err);
    return;
  }

  try {
    if (!interaction.inGuild() || !interaction.guild) {
      await interaction.editReply('use this in a server.');
      return;
    }
    if (!interaction.memberPermissions?.has(PermissionsBitField.Flags.ManageChannels)) {
      await interaction.editReply('you need manage channels to do that.');
      return;
    }

    const channelId = interaction.options.getChannel('channel')?.id ?? interaction.channelId;
    const selected = channelId ? await interaction.guild.channels.fetch(channelId) : null;
    if (!selected || (selected.type !== ChannelType.GuildText && selected.type !== ChannelType.GuildAnnouncement)) {
      await interaction.editReply('choose a text or announcement channel.');
      return;
    }

    const moderator = await interaction.guild.members.fetch(interaction.user.id);
    const locked = interaction.commandName === 'lock';
    const previous = await setChannelLock(selected, interaction.guild, moderator, locked);
    const line = await actionLine(
      locked ? 'lock channel' : 'unlock channel',
      `channel: ${selected.name}`,
      locked ? 'locked.' : previous === false ? 'previous setting restored.' : 'unlocked.',
    ).catch(() => locked ? 'locked.' : previous === false ? 'previous setting restored.' : 'unlocked.');
    await interaction.editReply(line);
  } catch (err) {
    console.error(`${interaction.commandName} interaction failed`, err);
    await interaction.editReply(commandError(err)).catch(() => {});
  }
});

client.login(config.token).catch((err) => {
  console.error('failed to log in to Discord; check DISCORD_TOKEN and bot configuration.', err);
  process.exitCode = 1;
});
