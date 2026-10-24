// Minimal static file server for the browser checks - no dependencies.
// Usage: node scripts/serve-static.mjs --port 8080
import { createServer } from 'node:http';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { join, dirname, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const portFlag = process.argv.indexOf('--port');
const port = portFlag >= 0 ? Number(process.argv[portFlag + 1]) : Number(process.env.PORT) || 8080;

const types = { '.html': 'text/html', '.jpeg': 'image/jpeg', '.jpg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.css': 'text/css', '.js': 'text/javascript' };

createServer((req, res) => {
  const rel = normalize(decodeURIComponent(req.url.split('?')[0])).replace(/^([/\\])+/, '');
  let path = join(root, rel === '' ? 'index.html' : rel);
  if (!path.startsWith(root) || !existsSync(path)) { res.writeHead(404); res.end(); return; }
  if (statSync(path).isDirectory()) {
    path = join(path, 'index.html');
    if (!existsSync(path)) { res.writeHead(404); res.end(); return; }
  }
  res.writeHead(200, { 'content-type': types[path.slice(path.lastIndexOf('.'))] || 'application/octet-stream' });
  res.end(readFileSync(path));
}).listen(port, '127.0.0.1', () => console.log(`serving ${root} on http://127.0.0.1:${port}`));
