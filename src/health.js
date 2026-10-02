import http from 'node:http';

const port = Number(process.env.PORT || 8000);

const server = http.createServer((req, res) => {
  if (req.method === 'GET' && req.url === '/health') {
    res.writeHead(200, {
      'Content-Type': 'text/plain',
    });

    res.end('OK');
    return;
  }

  res.writeHead(404, {
    'Content-Type': 'text/plain',
  });

  res.end('Not Found');
});

export function startHealthServer() {
  server.listen(port, '0.0.0.0', () => {
    console.log(`health check running on port ${port}`);
  });
}