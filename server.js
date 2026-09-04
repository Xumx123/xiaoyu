const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const PORT = parseInt(process.env.DEPLOY_RUN_PORT || '5000', 10);
const ROOT = __dirname;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.htm':  'text/html; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.js':   'application/javascript; charset=utf-8',
  '.mjs':  'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg':  'image/svg+xml',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif':  'image/gif',
  '.webp': 'image/webp',
  '.ico':  'image/x-icon',
  '.woff': 'font/woff',
  '.woff2':'font/woff2',
  '.ttf':  'font/ttf',
  '.otf':  'font/otf',
  '.txt':  'text/plain; charset=utf-8',
  '.map':  'application/json; charset=utf-8'
};

function safeJoin(root, reqPath) {
  const decoded = decodeURIComponent(reqPath.split('?')[0]);
  const resolved = path.normalize(path.join(root, decoded));
  if (!resolved.startsWith(root)) return null;
  return resolved;
}

function send(res, status, body, headers) {
  res.writeHead(status, headers || {});
  res.end(body);
}

const server = http.createServer((req, res) => {
  try {
    const parsed = url.parse(req.url);
    let pathname = parsed.pathname || '/';
    if (pathname === '/') pathname = '/index.html';

    let filePath = safeJoin(ROOT, pathname);
    if (!filePath) return send(res, 403, 'Forbidden');

    fs.stat(filePath, (err, stat) => {
      if (err || !stat) {
        return send(res, 404, 'Not Found', { 'Content-Type': 'text/plain; charset=utf-8' });
      }
      if (stat.isDirectory()) {
        filePath = path.join(filePath, 'index.html');
      }
      fs.readFile(filePath, (err2, data) => {
        if (err2) {
          return send(res, 404, 'Not Found', { 'Content-Type': 'text/plain; charset=utf-8' });
        }
        const ext = path.extname(filePath).toLowerCase();
        const mime = MIME[ext] || 'application/octet-stream';
        send(res, 200, data, { 'Content-Type': mime, 'Content-Length': data.length });
      });
    });
  } catch (e) {
    send(res, 500, 'Server Error');
  }
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`[static-server] listening on 0.0.0.0:${PORT}, root=${ROOT}`);
});

process.on('SIGTERM', () => server.close(() => process.exit(0)));
process.on('SIGINT',  () => server.close(() => process.exit(0)));
