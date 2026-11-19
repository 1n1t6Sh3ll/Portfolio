// POST /api/score { pid, points, flags, coins, root, clearSec } -> saves an explorer's best run.
// Names are generated from the player id and the flag comes from the visitor's country; nothing typed by users is shown.
import { pipe } from './_db.js';
import { readJson, send, clean, origin, nameFor, cors } from './_util.js';
import { PTS, TOTAL, MAX_PTS, levelOf, weekKey, rankScore } from './_game.js';

export default async function handler(req, res) {
  if (cors(req, res)) return;
  if (req.method !== 'POST') return send(res, 405, { error: 'POST only' });
  try {
    const b = await readJson(req);
    const pid = clean(b.pid, 64);
    const int = v => Math.floor(+v || 0);
    const run = { points: int(b.points), flags: int(b.flags), coins: int(b.coins), root: int(b.root) ? 1 : 0, clearSec: int(b.clearSec) };
    const valid = pid.length >= 8
      && run.flags >= 0 && run.flags <= TOTAL.flags && run.coins >= 0 && run.coins <= TOTAL.coins
      && (!run.root || run.flags === TOTAL.flags)
      && run.points === run.flags * PTS.flag + run.coins * PTS.coin + run.root * PTS.root
      && run.clearSec >= 0 && (!run.clearSec || run.points === MAX_PTS);
    if (!valid) return send(res, 400, { error: 'invalid score' });

    const name = nameFor(pid);
    const { country } = origin(req);
    const [prevRaw] = await pipe([['HGET', 'h:players', pid]]);
    const prev = prevRaw ? JSON.parse(prevRaw) : null;
    const better = !prev || rankScore(run) > rankScore(prev);
    const rec = better ? { ...run, name, country, level: levelOf(run.points), at: Date.now(), first: prev?.first || Date.now() } : { ...prev, name, country };
    const score = String(rankScore(rec));
    const cmds = [['HSET', 'h:players', pid, JSON.stringify(rec)], ['ZADD', 'z:lb', score, pid], ['ZADD', weekKey(), score, pid]];
    if (better) cmds.push(['LPUSH', 'l:log', JSON.stringify({ t: Date.now(), type: 'score', vid: pid.slice(0, 8), name, ...run, level: rec.level, ...origin(req) })], ['LTRIM', 'l:log', '0', '99999']);
    cmds.push(['ZREVRANK', 'z:lb', pid]);
    const out = await pipe(cmds);
    return send(res, 200, { ok: true, rank: out.at(-1) + 1, record: rec });
  } catch (e) {
    return send(res, 500, { error: e.message });
  }
}
