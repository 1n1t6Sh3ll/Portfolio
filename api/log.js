// GET /api/log?key=ADMIN_KEY&limit=500 -> recent visit and score events (owner only)
import { pipe } from './_db.js';
import { send, query, cors } from './_util.js';

export default async function handler(req, res) {
  if (cors(req, res)) return;
  const q = query(req);
  const key = process.env.ADMIN_KEY;
  if (!key) return send(res, 503, { error: 'Set the ADMIN_KEY environment variable to enable the log' });
  if (q.get('key') !== key) return send(res, 401, { error: 'wrong key' });
  try {
    const limit = Math.min(5000, Math.max(1, +q.get('limit') || 500));
    const [rows, visits, visitors, players] = await pipe([
      ['LRANGE', 'l:log', '0', String(limit - 1)],
      ['GET', 'c:visits'], ['PFCOUNT', 'pf:visitors'], ['ZCARD', 'z:lb'],
    ]);
    return send(res, 200, { visits: +visits || 0, visitors, players, entries: rows.map(r => JSON.parse(r)) });
  } catch (e) {
    return send(res, 500, { error: e.message });
  }
}
