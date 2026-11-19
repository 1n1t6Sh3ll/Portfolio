// Shared game rules: keep in sync with the RULES block in 3d.html
export const PTS = { flag: 100, coin: 25, root: 300 };
export const TOTAL = { flags: 6, coins: 13 };
export const MAX_PTS = TOTAL.flags * PTS.flag + TOTAL.coins * PTS.coin + PTS.root; // 1225
export const LEVELS = [0, 100, 250, 450, 650, 900, 1225];
export const levelOf = pts => LEVELS.filter(t => pts >= t).length;
export const weekKey = (t = Date.now()) => `z:lb:w:${Math.floor(t / 604800000)}`;
// Rank by points, then fastest full clear (seconds), then earliest
export const rankScore = r => r.points * 1e6 + (r.clearSec ? 1e6 - Math.min(r.clearSec, 999999) : 0);
