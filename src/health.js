import http from 'node:http';

const port = Number(process.env.PORT || 8000);

let bot = null;

const attitudes = [
  'confident and slightly annoyed.',
  'online and judging quietly.',
  'awake, useful, and impatient.',
  'operational, barely tolerating chaos.',
  'online, behaving herself. mostly.',
  'keeping everything under control.',
  'watching the server.',
  'mildly irritated, fully operational.',
  'doing her job, unfortunately.',
  'still here. tragic, isnt it?',
];

function getAttitude() {
  return attitudes[
    Math.floor(Math.random() * attitudes.length)
  ];
}

const server = http.createServer((req, res) => {
  if (
    (req.method === 'GET' || req.method === 'HEAD') &&
    req.url === '/health'
  ) {
    const online = bot?.isReady() === true;

    const body = [
      'clara',
      '',
      `status: ${online ? 'online' : 'starting'}`,
      `attitude: ${getAttitude()}`,
      `discord: ${online ? 'connected' : 'connecting'}`,
      `uptime: ${formatUptime(process.uptime())}`,
    ].join('\n');

    res.writeHead(200, {
      'Content-Type': 'text/plain; charset=utf-8',
    });

    // HEAD requests must not return a response body
    if (req.method === 'HEAD') {
      res.end();
    } else {
      res.end(body);
    }

    return;
  }

  res.writeHead(404, {
    'Content-Type': 'text/plain; charset=utf-8',
  });

  res.end('not found');
});

export function setHealthBot(client) {
  bot = client;
}

export function startHealthServer() {
  server.listen(port, '0.0.0.0', () => {
    console.log(
      `health check running on port ${port}`,
    );
  });
}

function formatUptime(seconds) {
  const days = Math.floor(seconds / 86400);

  seconds %= 86400;

  const hours = Math.floor(seconds / 3600);

  seconds %= 3600;

  const minutes = Math.floor(seconds / 60);

  const secs = Math.floor(seconds % 60);

  const parts = [];

  if (days) parts.push(`${days}d`);
  if (hours) parts.push(`${hours}h`);
  if (minutes) parts.push(`${minutes}m`);

  parts.push(`${secs}s`);

  return parts.join(' ');
}