// GET /api/leaderboard?pid=... -> top 10 all-time + this week, visitor totals, and the caller's rank
import { pipe } from './_db.js';
import { send, query, clean, cors } from './_util.js';
import { weekKey } from './_game.js';

export default async function handler(req, res) {
  if (cors(req, res)) return;
  try {
    const pid = clean(query(req).get('pid'), 64);
    const [top, week, players, visits, visitors, rank] = await pipe([
      ['ZREVRANGE', 'z:lb', '0', '9'], ['ZREVRANGE', weekKey(), '0', '9'],
      ['ZCARD', 'z:lb'], ['GET', 'c:visits'], ['PFCOUNT', 'pf:visitors'], ['ZREVRANK', 'z:lb', pid || '-'],
    ]);
    const ids = [...new Set([...top, ...week, ...(pid ? [pid] : [])])];
    const [raw] = ids.length ? await pipe([['HMGET', 'h:players', ...ids]]) : [[]];
    const recs = Object.fromEntries(ids.map((id, i) => [id, JSON.parse(raw[i] || 'null')]));
    const rows = list => list.filter(id => recs[id]).map((id, i) => {
      const r = recs[id];
      return { rank: i + 1, name: r.name, country: r.country, points: r.points, flags: r.flags, root: r.root, clearSec: r.clearSec, level: r.level, you: id === pid };
    });
    const you = pid && recs[pid] ? { name: recs[pid].name, country: recs[pid].country } : null;
    return send(res, 200, { top: rows(top), weekly: rows(week), players, visits: +visits || 0, visitors, yourRank: rank === null ? null : rank + 1, you });
  } catch (e) {
    return send(res, 500, { error: e.message });
  }
}
