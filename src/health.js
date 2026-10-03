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