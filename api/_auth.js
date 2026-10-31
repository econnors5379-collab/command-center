// Shared helpers for the serverless functions. Files starting with "_" are not exposed as routes.
const cache = new Map(); // token -> {user, until}

export function env(name, fallback = '') {
  const v = process.env[name];
  return v == null || v === '' ? fallback : v.trim();
}

export async function getUser(req) {
  const h = req.headers.authorization || req.headers.Authorization || '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : '';
  if (!token) return null;
  const hit = cache.get(token);
  if (hit && hit.until > Date.now()) return hit.user;
  const url = env('SUPABASE_URL').replace(/\/$/, '');
  const r = await fetch(url + '/auth/v1/user', {headers: {apikey: env('SUPABASE_ANON_KEY'), Authorization: 'Bearer ' + token}});
  if (!r.ok) return null;
  const user = await r.json();
  if (!user || !user.id) return null;
  if (cache.size > 200) cache.clear();
  cache.set(token, {user, until: Date.now() + 5 * 60 * 1000});
  return user;
}

export function allowed(email) {
  const list = env('ALLOWED_EMAILS').toLowerCase().split(/[,\s]+/).filter(Boolean);
  return !!email && list.includes(String(email).toLowerCase());
}
