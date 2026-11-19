// Local preview: serves the static site and runs /api/* functions the way Vercel would.
// Data is saved to .data/dev-db.json. Log page key defaults to "dev".
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
const PORT = +process.env.PORT || 8000;
process.env.ADMIN_KEY ??= 'dev';
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.pdf': 'application/pdf', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.ico': 'image/x-icon' };

http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://local');
  if (url.pathname.startsWith('/api/')) {
    const name = url.pathname.slice(5).replace(/[^a-z0-9-]/gi, '');
    let mod;
    try { mod = await import(pathToFileURL(path.join(root, 'api', `${name}.js`))); }
    catch { res.statusCode = 404; return res.end('{"error":"no such endpoint"}'); }
    try { return await mod.default(req, res); }
    catch (e) { res.statusCode = 500; return res.end(JSON.stringify({ error: e.message })); }
  }
  let rel = decodeURIComponent(url.pathname);
  if (rel.endsWith('/')) rel += 'index.html';
  const file = path.join(root, path.normalize(rel));
  if (!file.startsWith(root + path.sep) || /(^|\/)(\.|api\/|node_modules)/.test(rel.slice(1)) || rel.endsWith('.mjs')) {
    res.statusCode = 404; return res.end('Not found');
  }
  try {
    const body = await fs.readFile(file);
    res.setHeader('Content-Type', TYPES[path.extname(file)] || 'application/octet-stream');
    res.end(body);
  } catch { res.statusCode = 404; res.end('Not found'); }
}).listen(PORT, () => console.log(`Portfolio running at http://localhost:${PORT}  (log key: ${process.env.ADMIN_KEY})`));
