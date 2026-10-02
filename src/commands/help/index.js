export const helpCommand = {
  name: 'help',
  aliases: [],
  description: 'show clara commands',
  options: [],

  async prefix({ message }) {
    await message.reply(
      [
        'commands:',
        '.help',
        '.avatar @user',
        '.av @user',
        '.serverinfo',
        '.si',
        '.banner @user',
        '.serverbanner',
        '.servericon',
        '.nickname @user [name]',
        '.nick @user [name]',
        '.remindme 2min reason',
      ].join('\n'),
    );
  },

  async slash({ interaction }) {
    await interaction.reply(
      [
        'commands:',
        '/help',
        '/avatar',
        '/av',
        '/serverinfo',
        '/si',
        '/banner',
        '/serverbanner',
        '/servericon',
        '/nickname',
        '/nick',
        '/remindme',
      ].join('\n'),
    );
  },
};