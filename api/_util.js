export async function readJson(req) {
  if (req.body !== undefined && req.body !== null) {
    return typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body;
  }
  let raw = '';
  for await (const chunk of req) { raw += chunk; if (raw.length > 10_000) throw new Error('body too large'); }
  return raw ? JSON.parse(raw) : {};
}

export function send(res, status, data) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(data));
}

export const query = req => new URL(req.url, 'http://local').searchParams;

// Short, printable, length-capped string
export const clean = (v, max = 40) => String(v ?? '').replace(/[^\w .,:/\-@#?=&%+]/g, '').slice(0, max);

// Where a request came from. Uses Vercel's geo headers; never stores IP addresses.
export function origin(req) {
  const h = req.headers;
  const dec = v => { try { return decodeURIComponent(v || ''); } catch { return v || ''; } };
  const ua = String(h['user-agent'] || '');
  return {
    country: clean(h['x-vercel-ip-country'], 4) || 'local',
    city: clean(dec(h['x-vercel-ip-city']), 40),
    device: /mobile|android|iphone|ipad/i.test(ua) ? 'mobile' : 'desktop',
  };
}

// Friendly, stable name for a player id, e.g. "Neon Falcon"
const ADJ = ['Neon', 'Silent', 'Rapid', 'Crimson', 'Cobalt', 'Lucky', 'Shadow', 'Quantum', 'Turbo', 'Pixel', 'Cyber', 'Golden',
  'Midnight', 'Stealth', 'Solar', 'Frost', 'Iron', 'Electric', 'Rogue', 'Nimble', 'Atomic', 'Velvet', 'Hyper', 'Static'];
const NOUN = ['Falcon', 'Fox', 'Otter', 'Wolf', 'Panda', 'Lynx', 'Raven', 'Tiger', 'Cobra', 'Badger', 'Gecko', 'Orca',
  'Viper', 'Hawk', 'Koala', 'Mantis', 'Bison', 'Jaguar', 'Owl', 'Shark', 'Yak', 'Moose', 'Heron', 'Ferret'];
export function nameFor(id) {
  let h = 2166136261;
  for (const ch of String(id)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619) >>> 0; }
  return `${ADJ[h % ADJ.length]} ${NOUN[(h >>> 8) % NOUN.length]}`;
}
