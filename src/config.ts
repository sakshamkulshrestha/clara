import 'dotenv/config';

const need = (key: string) => {
  const value = process.env[key];
  if (!value) throw new Error(`missing ${key} in .env`);
  return value;
};

export const config = {
  token: need('DISCORD_TOKEN'),
  prefix: process.env.PREFIX || '.',
  nvidiaKey: process.env.NVIDIA_API_KEY || '',
  model: process.env.NVIDIA_MODEL || 'meta/llama-3.1-70b-instruct',
  color: 0x2b2d31,
};
