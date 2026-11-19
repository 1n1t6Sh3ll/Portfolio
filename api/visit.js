// POST /api/visit { vid, page, ref } -> counts a page view, returns totals
// GET  /api/visit                    -> totals only
import { pipe } from './_db.js';
import { readJson, send, clean, origin, cors } from './_util.js';

export default async function handler(req, res) {
  if (cors(req, res)) return;
  try {
    if (req.method === 'POST') {
      const b = await readJson(req);
      const vid = clean(b.vid, 64) || 'anon';
      const entry = { t: Date.now(), type: 'visit', page: clean(b.page, 12), vid: vid.slice(0, 8), ref: clean(b.ref, 80), ...origin(req) };
      const [, , visits, visitors] = await pipe([
        ['PFADD', 'pf:visitors', vid],
        ['LPUSH', 'l:log', JSON.stringify(entry)],
        ['INCR', 'c:visits'],
        ['PFCOUNT', 'pf:visitors'],
        ['LTRIM', 'l:log', '0', '4999'],
      ]);
      return send(res, 200, { visits, visitors });
    }
    const [visits, visitors] = await pipe([['GET', 'c:visits'], ['PFCOUNT', 'pf:visitors']]);
    return send(res, 200, { visits: +visits || 0, visitors });
  } catch (e) {
    return send(res, 500, { error: e.message });
  }
}
