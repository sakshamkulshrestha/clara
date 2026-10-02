# clara

a small discord bot for your server.

## setup

1. clone

```bash
git clone https://github.com/sakshamkulshrestha/clara.git
cd clara
```

2. install

```bash
npm install
```

3. create `.env`

```env
DISCORD_TOKEN=your_discord_token
NVIDIA_API_KEY=your_nvidia_api_key
NVIDIA_BASE_URL=https://integrate.api.nvidia.com/v1
NVIDIA_MODEL=your_model_name
PORT=8000
```

4. enable in discord

`message content intent`
`server members intent`

5. run

```bash
npm run dev
```

use `.help` or `/help` in discord.

never share your `.env`.