import {
  ApplicationCommandOptionType,
  PermissionFlagsBits,
} from 'discord.js';

import { parseDuration } from '../../utils/reminders.js';

const purgeMessages = [
  'cleaned up.',
  'gone.',
  'purge complete.',
  'all cleaned up.',
  'that mess is gone.',
  'cleared.',
  'and suddenly, silence.',
  'deleted.',
  'cleanup finished.',
  'channel looks better already.',
  'messages removed.',
  'the clutter has left the building.',
  'clean slate.',
  'gone without a trace.',
  'done. nice and clean.',
  'that should do it.',
  'cleanup complete.',
  'all sorted.',
  'cleared out.',
  'much cleaner now.',
];

const channelStates = new Map();
const nukeWaiters = new Set();

function randomPurgeMessage() {
  return purgeMessages[
    Math.floor(Math.random() * purgeMessages.length)
  ];
}

function isOwner(guild, member) {
  return member.id === guild.ownerId;
}

function canModerate(actor, target) {
  if (!target) return false;
  if (target.id === actor.id) return false;
  if (target.id === actor.guild.ownerId) return false;

  if (isOwner(actor.guild, actor)) {
    return true;
  }

  return (
    actor.roles.highest.comparePositionTo(
      target.roles.highest,
    ) > 0
  );
}

function findRole(guild, query) {
  const clean = query.trim();

  if (!clean) return null;

  const byId = guild.roles.cache.get(clean);

  if (byId) {
    return byId;
  }

  const lower = clean.toLowerCase();

  const exact = guild.roles.cache.find(
    (role) =>
      role.name.toLowerCase() === lower,
  );

  if (exact) {
    return exact;
  }

  const contains = guild.roles.cache.find(
    (role) =>
      role.name
        .toLowerCase()
        .includes(lower),
  );

  if (contains) {
    return contains;
  }

  const available = guild.roles.cache.filter(
    (role) => !role.managed,
  );

  let best = null;
  let bestScore = Infinity;

  for (const role of available.values()) {
    const score = levenshtein(
      lower,
      role.name.toLowerCase(),
    );

    if (score < bestScore) {
      bestScore = score;
      best = role;
    }
  }

  // Avoid wildly unrelated fuzzy matches.
  if (
    best &&
    bestScore <= Math.max(
      3,
      Math.floor(clean.length / 2),
    )
  ) {
    return best;
  }

  return null;
}

function levenshtein(a, b) {
  const previous = Array.from(
    { length: b.length + 1 },
    (_, i) => i,
  );

  for (let i = 1; i <= a.length; i++) {
    const current = [i];

    for (let j = 1; j <= b.length; j++) {
      current[j] = Math.min(
        current[j - 1] + 1,
        previous[j] + 1,
        previous[j - 1] +
          (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    }

    for (let j = 0; j <= b.length; j++) {
      previous[j] = current[j];
    }
  }

  return previous[b.length];
}

function roleActionMessage(action, role, member) {
  const roleName = role.name;
  const userName = member.user.tag;

  if (action === 'added') {
    return `gave ${userName} the ${roleName} role.`;
  }

  return `removed the ${roleName} role from ${userName}.`;
}

async function nukeChannel(channel) {
  const position = channel.position;

  const newChannel = await channel.clone({
    reason: 'channel nuke',
  });

  await newChannel.setPosition(position);

  await channel.delete('channel nuke');

  if (newChannel.isSendable()) {
    await newChannel.send('channel nuked.');
  }
}

async function confirmNuke(channel, userId) {
  if (!channel.isTextBased()) {
    return false;
  }

  if (nukeWaiters.has(channel.id)) {
    return false;
  }

  nukeWaiters.add(channel.id);

  try {
    const collected = await channel.awaitMessages({
      filter: (message) =>
        message.author.id === userId &&
        ['y', 'yes'].includes(
          message.content.trim().toLowerCase(),
        ),
      max: 1,
      time: 15_000,
    });

    return collected.size > 0;
  } finally {
    nukeWaiters.delete(channel.id);
  }
}

export const moderationCommands = [
  {
    name: 'ban',
    aliases: [],
    description: 'ban a member',

    options: [
      {
        name: 'user',
        description: 'member to ban',
        type: ApplicationCommandOptionType.User,
        required: true,
      },
      {
        name: 'reason',
        description: 'reason for the ban',
        type: ApplicationCommandOptionType.String,
        required: true,
        max_length: 500,
      },
    ],

    async prefix({ message, args }) {
      if (
        !message.member.permissions.has(
          PermissionFlagsBits.BanMembers,
        )
      ) {
        return message.reply(
          'you need ban members for that.',
        );
      }

      const target =
        message.mentions.members.first();

      const reason = args
        .slice(1)
        .join(' ')
        .trim();

      if (!target) {
        return message.reply(
          'use .ban @user reason',
        );
      }

      if (!reason) {
        return message.reply(
          'give me a reason.',
        );
      }

      if (!canModerate(message.member, target)) {
        return message.reply(
          'you cant moderate that member.',
        );
      }

      if (!target.bannable) {
        return message.reply(
          'i cant ban that member.',
        );
      }

      try {
        await target.ban({
          reason,
        });

        await message.reply(
          `banned ${target.user.tag} — ${reason}`,
        );
      } catch {
        await message.reply(
          'couldnt ban that member.',
        );
      }
    },

    async slash({ interaction }) {
      if (
        !interaction.member.permissions.has(
          PermissionFlagsBits.BanMembers,
        )
      ) {
        return interaction.reply(
          'you need ban members for that.',
        );
      }

      const user =
        interaction.options.getUser('user');

      const reason =
        interaction.options.getString('reason');

      const target =
        await interaction.guild.members.fetch(
          user.id,
        );

      if (!canModerate(interaction.member, target)) {
        return interaction.reply(
          'you cant moderate that member.',
        );
      }

      if (!target.bannable) {
        return interaction.reply(
          'i cant ban that member.',
        );
      }

      try {
        await target.ban({ reason });

        await interaction.reply(
          `banned ${target.user.tag} — ${reason}`,
        );
      } catch {
        await interaction.reply(
          'couldnt ban that member.',
        );
      }
    },
  },

  {
    name: 'kick',
    aliases: [],
    description: 'kick a member',

    options: [
      {
        name: 'user',
        description: 'member to kick',
        type: ApplicationCommandOptionType.User,
        required: true,
      },
      {
        name: 'reason',
        description: 'reason for the kick',
        type: ApplicationCommandOptionType.String,
        required: true,
        max_length: 500,
      },
    ],

    async prefix({ message, args }) {
      if (
        !message.member.permissions.has(
          PermissionFlagsBits.KickMembers,
        )
      ) {
        return message.reply(
          'you need kick members for that.',
        );
      }

      const target =
        message.mentions.members.first();

      const reason = args
        .slice(1)
        .join(' ')
        .trim();

      if (!target) {
        return message.reply(
          'use .kick @user reason',
        );
      }

      if (!reason) {
        return message.reply(
          'give me a reason.',
        );
      }

      if (!canModerate(message.member, target)) {
        return message.reply(
          'you cant moderate that member.',
        );
      }

      if (!target.kickable) {
        return message.reply(
          'i cant kick that member.',
        );
      }

      try {
        await target.kick(reason);

        await message.reply(
          `kicked ${target.user.tag} — ${reason}`,
        );
      } catch {
        await message.reply(
          'couldnt kick that member.',
        );
      }
    },

    async slash({ interaction }) {
      if (
        !interaction.member.permissions.has(
          PermissionFlagsBits.KickMembers,
        )
      ) {
        return interaction.reply(
          'you need kick members for that.',
        );
      }

      const user =
        interaction.options.getUser('user');

      const reason =
        interaction.options.getString('reason');

      const target =
        await interaction.guild.members.fetch(
          user.id,
        );

      if (!canModerate(interaction.member, target)) {
        return interaction.reply(
          'you cant moderate that member.',
        );
      }

      if (!target.kickable) {
        return interaction.reply(
          'i cant kick that member.',
        );
      }

      try {
        await target.kick(reason);

        await interaction.reply(
          `kicked ${target.user.tag} — ${reason}`,
        );
      } catch {
        await interaction.reply(
          'couldnt kick that member.',
        );
      }
    },
  },

  {
    name: 'timeout',
    aliases: [],
    description: 'timeout a member',

    options: [
      {
        name: 'user',
        description: 'member to timeout',
        type: ApplicationCommandOptionType.User,
        required: true,
      },
      {
        name: 'time',
        description:
          'use 10s, 10sec, 10m, 10min, 1h, 1hr or 1d',
        type: ApplicationCommandOptionType.String,
        required: true,
      },
    ],

    async prefix({ message, args }) {
      if (
        !message.member.permissions.has(
          PermissionFlagsBits.ModerateMembers,
        )
      ) {
        return message.reply(
          'you need moderate members for that.',
        );
      }

      const target =
        message.mentions.members.first();

      if (!target) {
        return message.reply(
          'use .timeout @user 10min',
        );
      }

      const delay =
        parseDuration(args[1] || '');

      if (!delay) {
        return message.reply(
          'invalid time. use 10s, 10sec, 10m, 10min, 1h, 1hr or 1d.',
        );
      }

      if (!canModerate(message.member, target)) {
        return message.reply(
          'you cant moderate that member.',
        );
      }

      if (!target.moderatable) {
        return message.reply(
          'i cant timeout that member.',
        );
      }

      try {
        await target.timeout(delay);

        await message.reply(
          `timed out ${target.user.tag} for ${formatDuration(delay)}.`,
        );
      } catch {
        await message.reply(
          'couldnt timeout that member.',
        );
      }
    },

    async slash({ interaction }) {
      if (
        !interaction.member.permissions.has(
          PermissionFlagsBits.ModerateMembers,
        )
      ) {
        return interaction.reply(
          'you need moderate members for that.',
        );
      }

      const user =
        interaction.options.getUser('user');

      const time =
        interaction.options.getString('time');

      const delay =
        parseDuration(time);

      if (!delay) {
        return interaction.reply(
          'invalid time. use 10s, 10sec, 10m, 10min, 1h, 1hr or 1d.',
        );
      }

      const target =
        await interaction.guild.members.fetch(
          user.id,
        );

      if (!canModerate(interaction.member, target)) {
        return interaction.reply(
          'you cant moderate that member.',
        );
      }

      if (!target.moderatable) {
        return interaction.reply(
          'i cant timeout that member.',
        );
      }

      try {
        await target.timeout(delay);

        await interaction.reply(
          `timed out ${target.user.tag} for ${formatDuration(delay)}.`,
        );
      } catch {
        await interaction.reply(
          'couldnt timeout that member.',
        );
      }
    },
  },

  {
    name: 'purge',
    aliases: [],
    description: 'delete recent messages',

    options: [
      {
        name: 'amount',
        description: 'number of messages, 1-100',
        type: ApplicationCommandOptionType.Integer,
        required: true,
        min_value: 1,
        max_value: 100,
      },
    ],

    async prefix({ message, args }) {
      if (
        !message.member.permissions.has(
          PermissionFlagsBits.ManageMessages,
        )
      ) {
        return message.reply(
          'you need manage messages for that.',
        );
      }

      const amount = Number(args[0]);

      if (
        !Number.isInteger(amount) ||
        amount < 1 ||
        amount > 100
      ) {
        return message.reply(
          'use .purge 1-100',
        );
      }

      if (
        typeof message.channel.bulkDelete !==
        'function'
      ) {
        return message.reply(
          'this channel cant be purged.',
        );
      }

      try {
        const deleted =
  await message.channel.bulkDelete(
    Math.min(amount + 1, 100),
    true,
  );

const removedCount = Math.max(
  deleted.size - 1,
  0,
);

const msg = await message.channel.send(
  `${randomPurgeMessage()} ${removedCount} message(s).`,
);

setTimeout(() => {
  msg.delete().catch(() => {});
}, 3000);
      } catch {
        await message.reply(
          'couldnt purge messages.',
        );
      }
    },

    async slash({ interaction }) {
      if (
        !interaction.member.permissions.has(
          PermissionFlagsBits.ManageMessages,
        )
      ) {
        return interaction.reply(
          'you need manage messages for that.',
        );
      }

      const amount =
        interaction.options.getInteger(
          'amount',
        );

      if (
        typeof interaction.channel.bulkDelete !==
        'function'
      ) {
        return interaction.reply(
          'this channel cant be purged.',
        );
      }

      try {
        const deleted =
          await interaction.channel.bulkDelete(
            amount,
            true,
          );

        const msg = await interaction.reply({
  content: `${randomPurgeMessage()} ${deleted.size} message(s).`,
  fetchReply: true,
});

setTimeout(() => {
  msg.delete().catch(() => {});
}, 3000);
      } catch {
        await interaction.reply(
          'couldnt purge messages.',
        );
      }
    },
  },

  {
    name: 'lock',
    aliases: [],
    description: 'lock the current channel',
    options: [],

    async prefix({ message }) {
      if (
        !message.member.permissions.has(
          PermissionFlagsBits.ManageChannels,
        )
      ) {
        return message.reply(
          'you need manage channels for that.',
        );
      }

      const channel = message.channel;
      const everyone = message.guild.roles.everyone;
      const existing =
        channel.permissionOverwrites.cache.get(
          everyone.id,
        );

      channelStates.set(channel.id, {
        sendMessages:
          existing?.allow.has(
            PermissionFlagsBits.SendMessages,
          )
            ? true
            : existing?.deny.has(
                  PermissionFlagsBits.SendMessages,
                )
              ? false
              : null,
      });

      try {
        await channel.permissionOverwrites.edit(
          everyone,
          {
            SendMessages: false,
          },
        );

        await message.reply(
          'channel locked.',
        );
      } catch {
        await message.reply(
          'couldnt lock this channel.',
        );
      }
    },

    async slash({ interaction }) {
      if (
        !interaction.member.permissions.has(
          PermissionFlagsBits.ManageChannels,
        )
      ) {
        return interaction.reply(
          'you need manage channels for that.',
        );
      }

      const channel = interaction.channel;
      const everyone = interaction.guild.roles.everyone;
      const existing =
        channel.permissionOverwrites.cache.get(
          everyone.id,
        );

      channelStates.set(channel.id, {
        sendMessages:
          existing?.allow.has(
            PermissionFlagsBits.SendMessages,
          )
            ? true
            : existing?.deny.has(
                  PermissionFlagsBits.SendMessages,
                )
              ? false
              : null,
      });

      try {
        await channel.permissionOverwrites.edit(
          everyone,
          {
            SendMessages: false,
          },
        );

        await interaction.reply(
          'channel locked.',
        );
      } catch {
        await interaction.reply(
          'couldnt lock this channel.',
        );
      }
    },
  },

  {
    name: 'unlock',
    aliases: [],
    description: 'unlock the current channel',
    options: [],

    async prefix({ message }) {
      if (
        !message.member.permissions.has(
          PermissionFlagsBits.ManageChannels,
        )
      ) {
        return message.reply(
          'you need manage channels for that.',
        );
      }

      const state =
        channelStates.get(message.channel.id);

      try {
        await message.channel.permissionOverwrites.edit(
          message.guild.roles.everyone,
          {
            SendMessages:
              state?.sendMessages ?? null,
          },
        );

        channelStates.delete(
          message.channel.id,
        );

        await message.reply(
          'channel unlocked.',
        );
      } catch {
        await message.reply(
          'couldnt unlock this channel.',
        );
      }
    },

    async slash({ interaction }) {
      if (
        !interaction.member.permissions.has(
          PermissionFlagsBits.ManageChannels,
        )
      ) {
        return interaction.reply(
          'you need manage channels for that.',
        );
      }

      const state =
        channelStates.get(
          interaction.channel.id,
        );

      try {
        await interaction.channel.permissionOverwrites.edit(
          interaction.guild.roles.everyone,
          {
            SendMessages:
              state?.sendMessages ?? null,
          },
        );

        channelStates.delete(
          interaction.channel.id,
        );

        await interaction.reply(
          'channel unlocked.',
        );
      } catch {
        await interaction.reply(
          'couldnt unlock this channel.',
        );
      }
    },
  },

  {
    name: 'hide',
    aliases: [],
    description: 'hide the current channel',
    options: [],

    async prefix({ message }) {
      if (
        !message.member.permissions.has(
          PermissionFlagsBits.ManageChannels,
        )
      ) {
        return message.reply(
          'you need manage channels for that.',
        );
      }

      const channel = message.channel;
      const everyone = message.guild.roles.everyone;
      const existing =
        channel.permissionOverwrites.cache.get(
          everyone.id,
        );

      channelStates.set(
        `${channel.id}:visibility`,
        {
          viewChannel:
            existing?.allow.has(
              PermissionFlagsBits.ViewChannel,
            )
              ? true
              : existing?.deny.has(
                    PermissionFlagsBits.ViewChannel,
                  )
                ? false
                : null,
        },
      );

      try {
        await channel.permissionOverwrites.edit(
          everyone,
          {
            ViewChannel: false,
          },
        );

        await message.reply(
          'channel hidden.',
        );
      } catch {
        await message.reply(
          'couldnt hide this channel.',
        );
      }
    },

    async slash({ interaction }) {
      if (
        !interaction.member.permissions.has(
          PermissionFlagsBits.ManageChannels,
        )
      ) {
        return interaction.reply(
          'you need manage channels for that.',
        );
      }

      const channel = interaction.channel;
      const everyone = interaction.guild.roles.everyone;
      const existing =
        channel.permissionOverwrites.cache.get(
          everyone.id,
        );

      channelStates.set(
        `${channel.id}:visibility`,
        {
          viewChannel:
            existing?.allow.has(
              PermissionFlagsBits.ViewChannel,
            )
              ? true
              : existing?.deny.has(
                    PermissionFlagsBits.ViewChannel,
                  )
                ? false
                : null,
        },
      );

      try {
        await channel.permissionOverwrites.edit(
          everyone,
          {
            ViewChannel: false,
          },
        );

        await interaction.reply(
          'channel hidden.',
        );
      } catch {
        await interaction.reply(
          'couldnt hide this channel.',
        );
      }
    },
  },

  {
    name: 'unhide',
    aliases: [],
    description: 'unhide the current channel',
    options: [],

    async prefix({ message }) {
      if (
        !message.member.permissions.has(
          PermissionFlagsBits.ManageChannels,
        )
      ) {
        return message.reply(
          'you need manage channels for that.',
        );
      }

      const state =
        channelStates.get(
          `${message.channel.id}:visibility`,
        );

      try {
        await message.channel.permissionOverwrites.edit(
          message.guild.roles.everyone,
          {
            ViewChannel:
              state?.viewChannel ?? null,
          },
        );

        channelStates.delete(
          `${message.channel.id}:visibility`,
        );

        await message.reply(
          'channel visible again.',
        );
      } catch {
        await message.reply(
          'couldnt unhide this channel.',
        );
      }
    },

    async slash({ interaction }) {
      if (
        !interaction.member.permissions.has(
          PermissionFlagsBits.ManageChannels,
        )
      ) {
        return interaction.reply(
          'you need manage channels for that.',
        );
      }

      const state =
        channelStates.get(
          `${interaction.channel.id}:visibility`,
        );

      try {
        await interaction.channel.permissionOverwrites.edit(
          interaction.guild.roles.everyone,
          {
            ViewChannel:
              state?.viewChannel ?? null,
          },
        );

        channelStates.delete(
          `${interaction.channel.id}:visibility`,
        );

        await interaction.reply(
          'channel visible again.',
        );
      } catch {
        await interaction.reply(
          'couldnt unhide this channel.',
        );
      }
    },
  },

  {
    name: 'nuke',
    aliases: [],
    description: 'recreate the current channel',
    options: [],

    async prefix({ message }) {
      if (
        !message.member.permissions.has(
          PermissionFlagsBits.ManageChannels,
        )
      ) {
        return message.reply(
          'you need manage channels for that.',
        );
      }

      if (
        !message.channel.isTextBased() ||
        message.channel.isThread()
      ) {
        return message.reply(
          'this channel cant be nuked.',
        );
      }

      await message.reply(
        'this will delete and recreate the channel. reply `yes` or `y` within 15 seconds.',
      );

      const confirmed =
        await confirmNuke(
          message.channel,
          message.author.id,
        );

      if (!confirmed) {
        return message.channel.send(
          'nuke cancelled.',
        );
      }

      try {
        await nukeChannel(message.channel);
      } catch {
        await message.channel.send(
          'couldnt nuke this channel.',
        ).catch(() => {});
      }
    },

    async slash({ interaction }) {
      if (
        !interaction.member.permissions.has(
          PermissionFlagsBits.ManageChannels,
        )
      ) {
        return interaction.reply(
          'you need manage channels for that.',
        );
      }

      if (
        !interaction.channel.isTextBased() ||
        interaction.channel.isThread()
      ) {
        return interaction.reply(
          'this channel cant be nuked.',
        );
      }

      await interaction.reply(
        'this will delete and recreate the channel. reply `yes` or `y` within 15 seconds.',
      );

      const confirmed =
        await confirmNuke(
          interaction.channel,
          interaction.user.id,
        );

      if (!confirmed) {
        return interaction.channel.send(
          'nuke cancelled.',
        );
      }

      try {
        await nukeChannel(
          interaction.channel,
        );
      } catch {
        await interaction.channel.send(
          'couldnt nuke this channel.',
        ).catch(() => {});
      }
    },
  },

  {
    name: 'role',
    aliases: [],
    description: 'manage roles',

    options: [
      {
        name: 'toggle',
        description: 'give or remove a role',
        type: ApplicationCommandOptionType.Subcommand,
        options: [
          {
            name: 'user',
            description: 'member',
            type: ApplicationCommandOptionType.User,
            required: true,
          },
          {
            name: 'role',
            description: 'role name or id',
            type: ApplicationCommandOptionType.String,
            required: true,
          },
        ],
      },
      {
        name: 'create',
        description: 'create a role with no permissions',
        type: ApplicationCommandOptionType.Subcommand,
        options: [
          {
            name: 'name',
            description: 'role name',
            type: ApplicationCommandOptionType.String,
            required: true,
            max_length: 100,
          },
        ],
      },
      {
        name: 'delete',
        description: 'delete a role',
        type: ApplicationCommandOptionType.Subcommand,
        options: [
          {
            name: 'role',
            description: 'role name or id',
            type: ApplicationCommandOptionType.String,
            required: true,
          },
        ],
      },
    ],

    async prefix({ message, args }) {
      if (
        !message.member.permissions.has(
          PermissionFlagsBits.ManageRoles,
        )
      ) {
        return message.reply(
          'you need manage roles for that.',
        );
      }

      const target =
        message.mentions.members.first();

      // .role @user role
      if (target) {
        const roleQuery = args
          .slice(1)
          .join(' ')
          .trim();

        if (!roleQuery) {
          return message.reply(
            'use .role @user rolename',
          );
        }

        return toggleRole(
          message.guild,
          message.member,
          target,
          roleQuery,
          message.reply.bind(message),
        );
      }

      const action =
        args[0]?.toLowerCase();

      // .role delete role
      if (
        action === 'delete' ||
        action === 'del' ||
        action === 'remove'
      ) {
        const query = args
          .slice(1)
          .join(' ')
          .trim();

        if (!query) {
          return message.reply(
            'use .role delete rolename',
          );
        }

        return deleteRole(
          message.guild,
          query,
          message.reply.bind(message),
        );
      }

      // .role create role
      if (
        action === 'create' ||
        action === 'new'
      ) {
        const name = args
          .slice(1)
          .join(' ')
          .trim();

        if (!name) {
          return message.reply(
            'use .role create rolename',
          );
        }

        return createRole(
          message.guild,
          name,
          message.reply.bind(message),
        );
      }

      // .role rolename
      return createRole(
        message.guild,
        args.join(' ').trim(),
        message.reply.bind(message),
      );
    },

    async slash({ interaction }) {
      if (
        !interaction.member.permissions.has(
          PermissionFlagsBits.ManageRoles,
        )
      ) {
        return interaction.reply(
          'you need manage roles for that.',
        );
      }

      const subcommand =
        interaction.options.getSubcommand();

      if (subcommand === 'toggle') {
        const user =
          interaction.options.getUser('user');

        const query =
          interaction.options.getString('role');

        const target =
          await interaction.guild.members.fetch(
            user.id,
          );

        return toggleRole(
          interaction.guild,
          interaction.member,
          target,
          query,
          interaction.reply.bind(interaction),
        );
      }

      if (subcommand === 'create') {
        const name =
          interaction.options.getString('name');

        return createRole(
          interaction.guild,
          name,
          interaction.reply.bind(interaction),
        );
      }

      if (subcommand === 'delete') {
        const query =
          interaction.options.getString('role');

        return deleteRole(
          interaction.guild,
          query,
          interaction.reply.bind(interaction),
        );
      }
    },
  },
];

async function toggleRole(
  guild,
  actor,
  target,
  query,
  reply,
) {
  const role = findRole(guild, query);

  if (!role) {
    return reply('role not found.');
  }

  if (role.managed) {
    return reply(
      'that role is managed by discord.',
    );
  }

  const me = guild.members.me;

  if (!me || me.roles.highest.comparePositionTo(role) <= 0) {
    return reply(
      'that role is above my highest role.',
    );
  }

  if (
    actor.id !== guild.ownerId &&
    actor.roles.highest.comparePositionTo(role) <= 0
  ) {
    return reply(
      'that role is above your highest role.',
    );
  }

  try {
    if (target.roles.cache.has(role.id)) {
      await target.roles.remove(role);

      return reply(
        roleActionMessage(
          'removed',
          role,
          target,
        ),
      );
    }

    await target.roles.add(role);

    return reply(
      roleActionMessage(
        'added',
        role,
        target,
      ),
    );
  } catch {
    return reply(
      'couldnt update that role.',
    );
  }
}

async function createRole(
  guild,
  name,
  reply,
) {
  if (!name) {
    return reply(
      'give me a role name.',
    );
  }

  if (name.length > 100) {
    return reply(
      'that role name is too long.',
    );
  }

  try {
    const role = await guild.roles.create({
      name,
      permissions: [],
      reason: 'role command',
    });

    return reply(
      `created ${role}.`,
    );
  } catch {
    return reply(
      'couldnt create that role.',
    );
  }
}

async function deleteRole(
  guild,
  query,
  reply,
) {
  const role = findRole(guild, query);

  if (!role) {
    return reply('role not found.');
  }

  if (role.managed) {
    return reply(
      'that role is managed by discord.',
    );
  }

  const me = guild.members.me;

  if (!me || me.roles.highest.comparePositionTo(role) <= 0) {
    return reply(
      'that role is above my highest role.',
    );
  }

  try {
    await role.delete('role command');

    return reply(
      `deleted role ${role.name}.`,
    );
  } catch {
    return reply(
      'couldnt delete that role.',
    );
  }
}

function formatDuration(milliseconds) {
  const seconds = Math.ceil(
    milliseconds / 1000,
  );

  if (seconds < 60) {
    return `${seconds}s`;
  }

  if (seconds < 3600) {
    const minutes = Math.floor(
      seconds / 60,
    );

    const remaining =
      seconds % 60;

    return remaining
      ? `${minutes}m ${remaining}s`
      : `${minutes}m`;
  }

  if (seconds < 86400) {
    const hours = Math.floor(
      seconds / 3600,
    );

    const remaining =
      seconds % 3600;

    if (!remaining) {
      return `${hours}h`;
    }

    const minutes = Math.floor(
      remaining / 60,
    );

    return minutes
      ? `${hours}h ${minutes}m`
      : `${hours}h`;
  }

  const days = Math.floor(
    seconds / 86400,
  );

  return `${days}d`;
}