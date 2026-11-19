// Tiny storage layer.
//  - Production: Upstash Redis over REST (Vercel Marketplace sets KV_REST_API_URL / KV_REST_API_TOKEN,
//    or set UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN yourself).
//  - Local dev: a JSON file in .data/ that mimics the handful of Redis commands we use.
import fs from 'node:fs';
import path from 'node:path';

const URL_ = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;

export const backend = URL_ && TOKEN ? 'redis' : 'file';

export async function pipe(cmds) {
  if (backend === 'redis') {
    const r = await fetch(`${URL_}/pipeline`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(cmds),
    });
    if (!r.ok) throw new Error(`redis ${r.status}`);
    const out = await r.json();
    return out.map(x => { if (x.error) throw new Error(x.error); return x.result; });
  }
  if (process.env.VERCEL) throw new Error('No database configured: connect Upstash Redis in the Vercel dashboard');
  return fileStore(cmds);
}

/* ---------- local file fallback ---------- */
const FILE = path.join(process.cwd(), '.data', 'dev-db.json');
let mem = null;
function load() {
  if (mem) return mem;
  try { mem = JSON.parse(fs.readFileSync(FILE, 'utf8')); } catch { mem = {}; }
  return mem;
}
function persist() {
  fs.mkdirSync(path.dirname(FILE), { recursive: true });
  fs.writeFileSync(FILE, JSON.stringify(mem));
}
function fileStore(cmds) {
  const db = load();
  let dirty = false;
  const out = cmds.map(([cmd, key, ...a]) => {
    cmd = cmd.toUpperCase();
    switch (cmd) {
      case 'INCR': dirty = true; return (db[key] = (db[key] || 0) + 1);
      case 'GET': return db[key] ?? null;
      case 'PFADD': {
        const s = (db[key] ||= []); let added = 0;
        a.forEach(v => { if (!s.includes(v)) { s.push(v); added = 1; } });
        dirty ||= !!added; return added;
      }
      case 'PFCOUNT': return (db[key] || []).length;
      case 'LPUSH': { const l = (db[key] ||= []); l.unshift(...a.reverse()); dirty = true; return l.length; }
      case 'LTRIM': { const l = db[key] || []; db[key] = l.slice(+a[0], +a[1] + 1); dirty = true; return 'OK'; }
      case 'LRANGE': { const l = db[key] || []; const end = +a[1] < 0 ? l.length : +a[1] + 1; return l.slice(+a[0], end); }
      case 'ZADD': { const z = (db[key] ||= {}); z[a[1]] = +a[0]; dirty = true; return 1; }
      case 'ZSCORE': return db[key]?.[a[0]] ?? null;
      case 'ZCARD': return Object.keys(db[key] || {}).length;
      case 'ZREVRANGE': {
        const sorted = Object.entries(db[key] || {}).sort((x, y) => y[1] - x[1]).slice(+a[0], +a[1] + 1);
        return a[2] === 'WITHSCORES' ? sorted.flatMap(([m, s]) => [m, String(s)]) : sorted.map(([m]) => m);
      }
      case 'ZREVRANK': {
        const sorted = Object.entries(db[key] || {}).sort((x, y) => y[1] - x[1]);
        const i = sorted.findIndex(([m]) => m === a[0]); return i < 0 ? null : i;
      }
      case 'HSET': { const h = (db[key] ||= {}); h[a[0]] = a[1]; dirty = true; return 1; }
      case 'HGET': return db[key]?.[a[0]] ?? null;
      case 'HMGET': return a.map(f => db[key]?.[f] ?? null);
      default: throw new Error(`unsupported ${cmd}`);
    }
  });
  if (dirty) persist();
  return out;
}
