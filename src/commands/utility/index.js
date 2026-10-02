import {
  ApplicationCommandOptionType,
  PermissionFlagsBits,
} from 'discord.js';

import { randomNicknameMessage } from '../../utils/random.js';
import {
  addReminder,
  parseDuration,
} from '../../utils/reminders.js';

export const utilityCommands = [
  {
    name: 'avatar',
    aliases: ['av'],
    description: 'show a user avatar',

    options: [
      {
        name: 'user',
        description: 'user to check',
        type: ApplicationCommandOptionType.User,
        required: false,
      },
    ],

    async prefix({ message }) {
      const user =
        message.mentions.users.first() ||
        message.author;

      const target = await user.fetch();

      const url = target.displayAvatarURL({
        extension: 'png',
        size: 1024,
      });

      await message.reply(url);
    },

    async slash({ interaction }) {
      const user =
        interaction.options.getUser('user') ||
        interaction.user;

      const target = await user.fetch();

      const url = target.displayAvatarURL({
        extension: 'png',
        size: 1024,
      });

      await interaction.reply(url);
    },
  },

  {
    name: 'serverinfo',
    aliases: ['si'],
    description: 'show server information',
    options: [],

    async prefix({ message }) {
      const guild = message.guild;

      await message.reply(
        [
          `server: ${guild.name}`,
          `id: ${guild.id}`,
          `owner: <@${guild.ownerId}>`,
          `members: ${guild.memberCount}`,
          `channels: ${guild.channels.cache.size}`,
          `roles: ${guild.roles.cache.size}`,
          `created: <t:${Math.floor(
            guild.createdTimestamp / 1000,
          )}:F>`,
        ].join('\n'),
      );
    },

    async slash({ interaction }) {
      const guild = interaction.guild;

      await interaction.reply(
        [
          `server: ${guild.name}`,
          `id: ${guild.id}`,
          `owner: <@${guild.ownerId}>`,
          `members: ${guild.memberCount}`,
          `channels: ${guild.channels.cache.size}`,
          `roles: ${guild.roles.cache.size}`,
          `created: <t:${Math.floor(
            guild.createdTimestamp / 1000,
          )}:F>`,
        ].join('\n'),
      );
    },
  },

  {
    name: 'banner',
    aliases: [],
    description: 'show a user banner',

    options: [
      {
        name: 'user',
        description: 'user to check',
        type: ApplicationCommandOptionType.User,
        required: false,
      },
    ],

    async prefix({ message }) {
      const user =
        message.mentions.users.first() ||
        message.author;

      const target = await user.fetch();

      const url = target.bannerURL({
        extension: 'png',
        size: 1024,
      });

      if (!url) {
        return message.reply(
          'that user has no banner.',
        );
      }

      await message.reply(url);
    },

    async slash({ interaction }) {
      const user =
        interaction.options.getUser('user') ||
        interaction.user;

      const target = await user.fetch();

      const url = target.bannerURL({
        extension: 'png',
        size: 1024,
      });

      if (!url) {
        return interaction.reply(
          'that user has no banner.',
        );
      }

      await interaction.reply(url);
    },
  },

  {
    name: 'serverbanner',
    aliases: [],
    description: 'show the server banner',
    options: [],

    async prefix({ message }) {
      const url = message.guild.bannerURL({
        extension: 'png',
        size: 1024,
      });

      if (!url) {
        return message.reply(
          'this server has no banner.',
        );
      }

      await message.reply(url);
    },

    async slash({ interaction }) {
      const url = interaction.guild.bannerURL({
        extension: 'png',
        size: 1024,
      });

      if (!url) {
        return interaction.reply(
          'this server has no banner.',
        );
      }

      await interaction.reply(url);
    },
  },

  {
    name: 'servericon',
    aliases: [],
    description: 'show the server icon',
    options: [],

    async prefix({ message }) {
      const url = message.guild.iconURL({
        extension: 'png',
        size: 1024,
      });

      if (!url) {
        return message.reply(
          'this server has no icon.',
        );
      }

      await message.reply(url);
    },

    async slash({ interaction }) {
      const url = interaction.guild.iconURL({
        extension: 'png',
        size: 1024,
      });

      if (!url) {
        return interaction.reply(
          'this server has no icon.',
        );
      }

      await interaction.reply(url);
    },
  },

  {
    name: 'nickname',
    aliases: ['nick'],
    description: 'change or reset a nickname',

    options: [
      {
        name: 'user',
        description: 'user to rename',
        type: ApplicationCommandOptionType.User,
        required: true,
      },
      {
        name: 'name',
        description:
          'new nickname, leave empty to reset',
        type: ApplicationCommandOptionType.String,
        required: false,
        max_length: 32,
      },
    ],

    async prefix({ message, args }) {
      if (
        !message.member.permissions.has(
          PermissionFlagsBits.ManageNicknames,
        )
      ) {
        return message.reply(
          'you need manage nicknames for that.',
        );
      }

      if (
        !message.guild.members.me.permissions.has(
          PermissionFlagsBits.ManageNicknames,
        )
      ) {
        return message.reply(
          'i need manage nicknames for that.',
        );
      }

      const target =
        message.mentions.members.first();

      if (!target) {
        return message.reply(
          'use .nick @user or .nick @user newname',
        );
      }

      if (!target.manageable) {
        return message.reply(
          'i cant change that nickname.',
        );
      }

      const nickname = args
        .slice(1)
        .join(' ')
        .trim();

      if (nickname.length > 32) {
        return message.reply(
          'that nickname is too long.',
        );
      }

      try {
        await target.setNickname(
          nickname || null,
        );

        await message.reply(
          randomNicknameMessage(),
        );
      } catch {
        await message.reply(
          'couldnt change that nickname.',
        );
      }
    },

    async slash({ interaction }) {
      if (
        !interaction.member.permissions.has(
          PermissionFlagsBits.ManageNicknames,
        )
      ) {
        return interaction.reply(
          'you need manage nicknames for that.',
        );
      }

      if (
        !interaction.guild.members.me.permissions.has(
          PermissionFlagsBits.ManageNicknames,
        )
      ) {
        return interaction.reply(
          'i need manage nicknames for that.',
        );
      }

      const user =
        interaction.options.getUser('user');

      const target =
        await interaction.guild.members.fetch(
          user.id,
        );

      const nickname =
        interaction.options
          .getString('name')
          ?.trim() || '';

      if (!target.manageable) {
        return interaction.reply(
          'i cant change that nickname.',
        );
      }

      try {
        await target.setNickname(
          nickname || null,
        );

        await interaction.reply(
          randomNicknameMessage(),
        );
      } catch {
        await interaction.reply(
          'couldnt change that nickname.',
        );
      }
    },
  },

  {
    name: 'remindme',
    aliases: [],
    description: 'set a reminder',

    options: [
      {
        name: 'time',
        description:
          'use 10s, 10sec, 10m, 10min, 1h, 1hr or 1d',
        type: ApplicationCommandOptionType.String,
        required: true,
      },
      {
        name: 'reason',
        description: 'what to remind you about',
        type: ApplicationCommandOptionType.String,
        required: true,
        max_length: 500,
      },
    ],

    async prefix({ message, args, client }) {
      if (args.length < 2) {
        return message.reply(
          'use .remindme 2min your reason',
        );
      }

      const delay = parseDuration(args[0]);

      if (!delay) {
        return message.reply(
          'invalid time. use 10s, 10sec, 10m, 10min, 1h, 1hr or 1d.',
        );
      }

      const reason = args
        .slice(1)
        .join(' ')
        .trim();

      if (!reason) {
        return message.reply(
          'tell me what to remind you about.',
        );
      }

      addReminder({
        userId: message.author.id,
        channelId: message.channel.id,
        reason,
        delay,
        client,
      });

      await message.reply(
        `okay, i'll remind you in ${formatDuration(delay)}.`,
      );
    },

    async slash({ interaction, client }) {
      const time =
        interaction.options.getString('time');

      const reason =
        interaction.options.getString('reason');

      const delay = parseDuration(time);

      if (!delay) {
        return interaction.reply(
          'invalid time. use 10s, 10sec, 10m, 10min, 1h, 1hr or 1d.',
        );
      }

      addReminder({
        userId: interaction.user.id,
        channelId: interaction.channel.id,
        reason,
        delay,
        client,
      });

      await interaction.reply(
        `okay, i'll remind you in ${formatDuration(delay)}.`,
      );
    },
  },
  {
  name: 'echo',
  aliases: [],
  description: 'repeat a message',

  options: [
    {
      name: 'message',
      description: 'message to repeat',
      type: ApplicationCommandOptionType.String,
      required: true,
      max_length: 2000,
    },
  ],

  async prefix({ message, args }) {
    const text = args.join(' ').trim();

    if (!text) {
      return message.reply(
        'give me something to echo.',
      );
    }

    await message.reply({
      content: text,
      allowedMentions: {
        parse: [],
      },
    });
  },

  async slash({ interaction }) {
    const text =
      interaction.options.getString('message');

    await interaction.reply({
      content: text,
      allowedMentions: {
        parse: [],
      },
    });
  },
},
];

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

  const remaining =
    seconds % 86400;

  if (!remaining) {
    return `${days}d`;
  }

  const hours = Math.floor(
    remaining / 3600,
  );

  return hours
    ? `${days}d ${hours}h`
    : `${days}d`;  
}