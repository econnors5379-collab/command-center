// AI mentor proxy. The Anthropic key lives only here, on the server.
// Checks the Supabase login and ALLOWED_EMAILS, then streams the reply back.
import {env, getUser, allowed} from './_auth.js';

export const config = {maxDuration: 60};

const MAX_BODY = 400000;

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({error: 'POST only'});
  if (!env('ANTHROPIC_API_KEY')) return res.status(503).json({error: 'ANTHROPIC_API_KEY is not set', code: 'sampling_disabled'});
  if (!env('SUPABASE_URL') || !env('SUPABASE_ANON_KEY')) return res.status(503).json({error: 'Supabase is not configured', code: 'sampling_disabled'});

  let user = null;
  try { user = await getUser(req); } catch (e) { return res.status(502).json({error: 'Could not verify login', code: 'unavailable'}); }
  if (!user) return res.status(401).json({error: 'Sign in again', code: 'session_expired'});
  if (!allowed(user.email)) return res.status(403).json({error: 'This account is not allowed to use the AI', code: 'not_granted'});

  const body = typeof req.body === 'string' ? safeJSON(req.body) : (req.body || {});
  const size = JSON.stringify(body).length;
  if (size > MAX_BODY) return res.status(413).json({error: 'Too much to send at once', code: 'prompt_too_large'});
  const messages = Array.isArray(body.messages) ? body.messages.slice(-60) : null;
  if (!messages || !messages.length) return res.status(400).json({error: 'messages required', code: 'bad_request'});
  const tools = Array.isArray(body.tools) ? body.tools.slice(0, 4) : [];
  const quick = body.tier === 'quick';
  const appName = env('APP_NAME', 'Command Center');

  let system = 'You are the private AI mentor inside ' + appName + ', a personal app used by one person. Follow the instructions in the messages. Be direct and objective. Never invent data that is not in the messages.';
  if (body.json) system += ' Reply with only valid JSON: no prose, no code fences.';

  const payload = {
    model: quick ? env('MODEL_QUICK', 'claude-haiku-5-5') : env('MODEL_MAIN', 'claude-sonnet-5-5'),
    max_tokens: quick ? 2048 : 4096,
    system,
    messages,
    stream: true
  };
  if (tools.length) payload.tools = tools;

  const ctl = new AbortController();
  req.on && req.on('close', () => { if (!res.writableEnded) ctl.abort(); });

  let upstream;
  try {
    upstream = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST', signal: ctl.signal,
      headers: {'content-type': 'application/json', 'x-api-key': env('ANTHROPIC_API_KEY'), 'anthropic-version': '2023-06-01'},
      body: JSON.stringify(payload)
    });
  } catch (e) {
    return res.status(502).json({error: 'Could not reach the AI', code: 'unavailable'});
  }
  if (!upstream.ok) {
    const text = await upstream.text().catch(() => '');
    const code = upstream.status === 429 || upstream.status === 529 ? 'rate_limited' : upstream.status === 413 ? 'prompt_too_large' : upstream.status === 401 ? 'sampling_disabled' : 'unavailable';
    console.error('anthropic', upstream.status, text.slice(0, 500));
    return res.status(upstream.status === 429 || upstream.status === 529 ? 429 : 502).json({error: 'AI request failed (' + upstream.status + ')', code});
  }

  res.writeHead(200, {'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-cache, no-transform', 'X-Accel-Buffering': 'no'});
  try {
    for await (const chunk of upstream.body) res.write(chunk);
  } catch (e) {
    if (!ctl.signal.aborted) res.write('event: error\ndata: ' + JSON.stringify({type: 'error', error: {type: 'stream_error', message: 'Stream interrupted'}}) + '\n\n');
  }
  res.end();
}

function safeJSON(s) { try { return JSON.parse(s); } catch (e) { return {}; } }
