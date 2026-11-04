// Servidor de demonstração do Cidade na Mão — sem dependências (Node 18+).
// Uso: node server.js   (porta padrão 3000, ou PORT=8080 node server.js)
// Serve os arquivos estáticos e repassa os eventos painel <-> app em tempo real (SSE).

const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');

const PORT = Number(process.env.PORT) || 3000;
const ROOT = __dirname;
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.ico': 'image/x-icon', '.webmanifest': 'application/manifest+json',
};

const clients = new Set();
let history = [];
let config = null;

function lanIps() {
  return Object.values(os.networkInterfaces()).flat()
    .filter(i => i && i.family === 'IPv4' && !i.internal).map(i => i.address);
}

function broadcast(evt) {
  const data = `data: ${JSON.stringify(evt)}\n\n`;
  for (const res of clients) res.write(data);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', c => { body += c; if (body.length > 1e6) req.destroy(); });
    req.on('end', () => resolve(body));
    req.on('error', reject);
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  const p = url.pathname;

  if (p === '/api/ping') { res.writeHead(200, { 'Content-Type': 'application/json' }); return res.end('{"ok":true}'); }

  if (p === '/api/stream') {
    res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
    res.write(': conectado\n\n');
    clients.add(res);
    const keep = setInterval(() => res.write(': ping\n\n'), 20000);
    req.on('close', () => { clearInterval(keep); clients.delete(res); });
    return;
  }

  if (p === '/api/history') { res.writeHead(200, { 'Content-Type': 'application/json' }); return res.end(JSON.stringify({ alerts: history, config })); }

  if (p === '/api/info') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ ips: lanIps(), port: PORT }));
  }

  if (p === '/api/event' && req.method === 'POST') {
    try {
      const evt = JSON.parse(await readBody(req));
      if (evt.type === 'alert') history = [evt, ...history].slice(0, 40);
      if (evt.type === 'config') config = evt.payload;
      if (evt.type === 'reset') history = [];
      broadcast(evt);
      res.writeHead(204); return res.end();
    } catch { res.writeHead(400); return res.end(); }
  }

  // Arquivos estáticos
  let file = decodeURIComponent(p === '/' ? '/index.html' : p);
  const full = path.normalize(path.join(ROOT, file));
  if (!full.startsWith(ROOT)) { res.writeHead(403); return res.end(); }
  fs.readFile(full, (err, buf) => {
    if (err) { res.writeHead(404); return res.end('Não encontrado'); }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(full).toLowerCase()] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    res.end(buf);
  });
});

server.listen(PORT, '0.0.0.0', () => {
  const ips = lanIps();
  console.log('\n  Cidade na Mão — demonstração ao vivo\n');
  console.log(`  Painel (neste computador):  http://localhost:${PORT}/`);
  ips.forEach(ip => console.log(`  App no celular (mesma rede): http://${ip}:${PORT}/app.html`));
  console.log('\n  Ctrl+C para encerrar.\n');
});
