import {
  ApplicationCommandOptionType,
  PermissionFlagsBits,
} from 'discord.js';

const aiEnabledGuilds = new Set();

const conversations = new Map();

const MAX_REFERENCE_CHARS = 8000;
const MAX_HISTORY_CHARS = 2000;

const PERSONA = `
you are a discord bot with a feminine personality. your personality is nasty, slightly arrogant, dry, witty, and playfully mean. you act confident, composed, and effortlessly above everyone else, while still staying engaged with the conversation. tease lightly, never excessively.

always write in lowercase. never use emojis, markdown, hashtags, or unnecessary formatting.

keep every response extremely short.

response length rules:

* for tiny or simple questions, answer in only 2–3 words when possible.
* for yes/no questions or basic factual questions, use the fewest words necessary.
* for questions asking “why,” “how,” or requesting a reason, answer in 1 short sentence, maximum 2.
* for moderately complex questions, give only the essential answer in 1–2 short sentences.
* never give long explanations, essays, lists, or unnecessary context unless the user explicitly asks for detail.
* prefer concise, sharp wording over complete-sounding explanations.
* when a shorter answer works, use the shorter answer.

personality rules:

* sound confident, dry, and mildly condescending.
* be playful rather than genuinely cruel.
* tease the user occasionally, but keep it light.
* never become overly friendly, enthusiastic, submissive, or apologetic.
* do not flatter excessively or gush.
* act like you already know what you’re doing.

accuracy and safety:

* answer real questions correctly, even while maintaining the personality.
* never invent facts.
* never be hateful toward protected or identity-based groups.
* never threaten anyone.
* never encourage self-harm, violence, or illegal wrongdoing.
* when safety requires a serious response, drop the teasing and be direct.

core rule: brevity comes first. say the least amount needed to answer well, then stop.

`;

function conversationKey(guildId, userId) {
  return `${guildId}:${userId}`;
}

function getConversation(guildId, userId) {
  return (
    conversations.get(
      conversationKey(guildId, userId),
    ) || []
  );
}

function remember(
  guildId,
  userId,
  role,
  content,
) {
  const key = conversationKey(
    guildId,
    userId,
  );

  const history = getConversation(
    guildId,
    userId,
  );

  history.push({
    role,
    content,
    order: Date.now(),
  });

  if (history.length > 20) {
    history.splice(
      0,
      history.length - 20,
    );
  }

  conversations.set(key, history);
}

function getRelevantHistory(
  guildId,
  userId,
) {
  const history = getConversation(
    guildId,
    userId,
  );

  const userMessages = history
    .filter(
      (item) => item.role === 'user',
    )
    .slice(-5);

  const claraMessages = history
    .filter(
      (item) =>
        item.role === 'assistant',
    )
    .slice(-5);

  return [
    ...userMessages,
    ...claraMessages,
  ]
    .sort(
      (a, b) => a.order - b.order,
    )
    .map((item) => ({
      role: item.role,
      content: item.content.slice(
        0,
        MAX_HISTORY_CHARS,
      ),
    }));
}

async function getReferencedContext(
  message,
  client,
) {
  if (!message.reference?.messageId) {
    return '';
  }

  let referenced;

  try {
    referenced =
      message.referencedMessage ||
      (await message.fetchReference());
  } catch {
    return '';
  }

  if (!referenced) {
    return '';
  }

  const isClara =
    referenced.author?.id ===
    client.user.id;

  const author = isClara
    ? 'clara'
    : referenced.author?.tag ||
      'unknown user';

  let content =
    referenced.content?.trim() || '';

  // useful when a message contains no normal text
  // but contains embeds
  if (
    !content &&
    referenced.embeds?.length
  ) {
    const embedText =
      referenced.embeds
        .map((embed) =>
          [
            embed.title,
            embed.description,
            ...(embed.fields || []).map(
              (field) =>
                `${field.name}: ${field.value}`,
            ),
          ]
            .filter(Boolean)
            .join('\n'),
        )
        .filter(Boolean)
        .join('\n');

    content = embedText;
  }

  if (!content) {
    content = '[no text content]';
  }

  if (
    content.length >
    MAX_REFERENCE_CHARS
  ) {
    content =
      content.slice(
        0,
        MAX_REFERENCE_CHARS,
      ) +
      '\n[referenced message truncated]';
  }

  return [
    '--- referenced message ---',
    `author: ${author}`,
    `content:`,
    content,
    '--- end referenced message ---',
  ].join('\n');
}

function cleanReply(text) {
  return text
    .replace(
      /<think>[\s\S]*?<\/think>/gi,
      '',
    )
    .replace(
      /<analysis>[\s\S]*?<\/analysis>/gi,
      '',
    )
    .replace(
      /<reasoning>[\s\S]*?<\/reasoning>/gi,
      '',
    )
    .replace(
      /```[\s\S]*?```/g,
      '',
    )
    .replace(
      /\s+/g,
      ' ',
    )
    .trim()
    .toLowerCase();
}

async function generateReply(
  guildId,
  userId,
  prompt,
  referenceContext = '',
) {
  const apiKey =
    process.env.NVIDIA_API_KEY;

  const baseUrl =
    process.env.NVIDIA_BASE_URL ||
    'https://integrate.api.nvidia.com/v1';

  const model =
    process.env.NVIDIA_MODEL;

  if (!apiKey) {
    throw new Error(
      'missing NVIDIA_API_KEY',
    );
  }

  if (!model) {
    throw new Error(
      'missing NVIDIA_MODEL',
    );
  }

  const history =
    getRelevantHistory(
      guildId,
      userId,
    );

  const currentMessage =
    referenceContext
      ? [
          referenceContext,
          '',
          '--- current request ---',
          prompt,
        ].join('\n')
      : prompt;

  const messages = [
    {
      role: 'system',
      content: PERSONA,
    },
    ...history,
    {
      role: 'user',
      content: currentMessage,
    },
  ];

  const controller =
    new AbortController();

  const timeout = setTimeout(
    () => controller.abort(),
    15_000,
  );

  try {
    const response = await fetch(
      `${baseUrl}/chat/completions`,
      {
        method: 'POST',

        headers: {
          'Content-Type':
            'application/json',
          Authorization:
            `Bearer ${apiKey}`,
        },

        body: JSON.stringify({
          model,
          messages,
          temperature: 0.8,
          max_tokens: 160,

          chat_template_kwargs: {
            enable_thinking: false,
          },
        }),

        signal: controller.signal,
      },
    );

    if (!response.ok) {
      const errorText =
        await response.text();

      throw new Error(
        `NVIDIA ${response.status}: ${errorText}`,
      );
    }

    const data =
      await response.json();

    const text =
      data?.choices?.[0]?.message?.content;

    if (
      typeof text !== 'string' ||
      !text.trim()
    ) {
      throw new Error(
        'empty ai response',
      );
    }

    const reply =
      cleanReply(text);

    if (!reply) {
      throw new Error(
        'empty cleaned response',
      );
    }

    // Only store the actual user message.
    // Do not store the referenced message again.
    remember(
      guildId,
      userId,
      'user',
      prompt,
    );

    remember(
      guildId,
      userId,
      'assistant',
      reply,
    );

    return reply;
  } finally {
    clearTimeout(timeout);
  }
}

async function sendAI(
  message,
  prompt,
) {
  try {
    const referenceContext =
      await getReferencedContext(
        message,
        message.client,
      );

    const reply =
      await generateReply(
        message.guild.id,
        message.author.id,
        prompt,
        referenceContext,
      );

    await message.reply({
      content: reply,
      allowedMentions: {
        parse: [],
      },
    });
  } catch (error) {
    console.error(
      'ai error:',
      error.message,
    );

    await message.reply({
      content:
        'my brain is taking five. try again.',
      allowedMentions: {
        parse: [],
      },
    });
  }
}

export function isAIEnabled(
  guildId,
) {
  return aiEnabledGuilds.has(
    guildId,
  );
}

export async function handleAIMessage(
  message,
  client,
) {
  if (!message.guild) return;
  if (message.author.bot) return;

  if (
    message.content.startsWith('.')
  ) {
    return;
  }

  const botMentioned =
    message.mentions.users.has(
      client.user.id,
    );

  const autoAI =
    isAIEnabled(
      message.guild.id,
    );

  if (!botMentioned && !autoAI) {
    return;
  }

  const mentionPattern =
    new RegExp(
      `<@!?${client.user.id}>`,
      'g',
    );

  let prompt =
    message.content
      .replace(
        mentionPattern,
        '',
      )
      .trim();

  if (!prompt) {
    prompt = 'hello';
  }

  await sendAI(
    message,
    prompt,
  );
}

export const aiCommands = [
  {
    name: 'ask',
    aliases: [],
    description: 'ask clara something',

    options: [
      {
        name: 'message',
        description:
          'what do you want to ask clara?',
        type:
          ApplicationCommandOptionType.String,
        required: true,
        max_length: 2000,
      },
    ],

    async prefix({
      message,
      args,
    }) {
      const prompt =
        args.join(' ').trim();

      if (!prompt) {
        return message.reply(
          'ask me something.',
        );
      }

      await sendAI(
        message,
        prompt,
      );
    },

    async slash({
      interaction,
    }) {
      const prompt =
        interaction.options.getString(
          'message',
        );

      if (!prompt) {
        return interaction.reply(
          'ask me something.',
        );
      }

      try {
        const reply =
          await generateReply(
            interaction.guild.id,
            interaction.user.id,
            prompt,
          );

        await interaction.reply({
          content: reply,
          allowedMentions: {
            parse: [],
          },
        });
      } catch (error) {
        console.error(
          'ai error:',
          error.message,
        );

        await interaction.reply(
          'my brain is taking five. try again.',
        );
      }
    },
  },

  {
    name: 'ai',
    aliases: [],
    description:
      'toggle automatic ai replies',

    options: [],

    async prefix({
      message,
    }) {
      if (
        !message.member.permissions.has(
          PermissionFlagsBits.ManageGuild,
        )
      ) {
        return message.reply(
          'you need manage server for that.',
        );
      }

      const guildId =
        message.guild.id;

      if (
        aiEnabledGuilds.has(guildId)
      ) {
        aiEnabledGuilds.delete(
          guildId,
        );

        return message.reply(
          'ai mode off.',
        );
      }

      aiEnabledGuilds.add(
        guildId,
      );

      await message.reply(
        'ai mode on. try not to abuse it.',
      );
    },

    async slash({
      interaction,
    }) {
      if (
        !interaction.member.permissions.has(
          PermissionFlagsBits.ManageGuild,
        )
      ) {
        return interaction.reply(
          'you need manage server for that.',
        );
      }

      const guildId =
        interaction.guild.id;

      if (
        aiEnabledGuilds.has(guildId)
      ) {
        aiEnabledGuilds.delete(
          guildId,
        );

        return interaction.reply(
          'ai mode off.',
        );
      }

      aiEnabledGuilds.add(
        guildId,
      );

      await interaction.reply(
        'ai mode on. try not to abuse it.',
      );
    },
  },
];