import { EmbedBuilder } from 'discord.js';

function helpEmbed() {
  return new EmbedBuilder()
    .setColor(0x5865f2)
    .setTitle('clara')
    .setDescription(
      'simple tools for your server.\nuse `/` or `.` before a command.',
    )
    .addFields(
      {
        name: 'utility',
        value: [
          '`avatar` · `av`',
          '`serverinfo` · `si`',
          '`banner`',
          '`serverbanner`',
          '`servericon`',
          '`nickname` · `nick`',
        ].join('\n'),
        inline: true,
      },
      {
        name: 'moderation',
        value: [
          '`ban`',
          '`kick`',
          '`timeout`',
          '`purge`',
          '`lock` · `unlock`',
          '`hide` · `unhide`',
          '`nuke`',
          '`role`',
        ].join('\n'),
        inline: true,
      },
      {
        name: 'other',
        value: [
          '`remindme`',
          '`echo`',
        ].join('\n'),
        inline: true,
      },
      {
        name: 'examples',
        value: [
          '`.avatar @user`',
          '`.serverinfo`',
          '`.ban @user reason`',
          '`.timeout @user 10min`',
          '`.role @user moderator`',
          '`.remindme 2min study`',
          '`.echo hello`',
        ].join('\n'),
        inline: false,
      },
      {
        name: 'reminder time',
        value:
          '`s` / `sec` · seconds\n`m` / `min` · minutes\n`h` / `hr` · hours\n`d` · days',
        inline: false,
      },
    )
    .setFooter({
      text: 'clara · help',
    });
}

export const helpCommand = {
  name: 'help',
  aliases: [],
  description: 'show clara commands',
  options: [],

  async prefix({ message }) {
    await message.reply({
      embeds: [helpEmbed()],
      allowedMentions: {
        parse: [],
      },
    });
  },

  async slash({ interaction }) {
    await interaction.reply({
      embeds: [helpEmbed()],
      allowedMentions: {
        parse: [],
      },
    });
  },
};