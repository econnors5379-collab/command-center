/* Command Center host layer.
   Gives the app the same window.claude.use(...) interface it has inside Claude,
   backed by Supabase (login, private data, crew) and /api/ai (the mentor). */
(function () {
  'use strict';
  const APP = 'command-center';
  const LS = {
    get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} },
    del(k) { try { localStorage.removeItem(k); } catch (e) {} }
  };
  let client = null, session = null, cfg = null;

  /* ---------- config + login ---------- */
  async function loadConfig() {
    try {
      const r = await fetch('/api/config', {cache: 'no-store'});
      if (!r.ok) throw new Error('config ' + r.status);
      const c = await r.json(); LS.set('cc-config', JSON.stringify(c)); return c;
    } catch (e) {
      const c = LS.get('cc-config'); if (c) return JSON.parse(c);
      throw e;
    }
  }
  const CSS = '#cc-auth{position:fixed;inset:0;z-index:9999;display:grid;place-items:center;padding:24px max(16px,env(safe-area-inset-left,0px));background:radial-gradient(1200px 600px at 50% -10%,rgba(124,131,255,.18),transparent 60%),#07080A;color:#E9ECF2;font-family:Geist,system-ui,-apple-system,sans-serif}' +
    '#cc-auth form{width:min(380px,100%);display:flex;flex-direction:column;gap:12px;background:#0E1013;border:1px solid #1E222A;border-radius:18px;padding:24px}' +
    '#cc-auth .mk{width:44px;height:44px;border-radius:12px;background:linear-gradient(135deg,#7C83FF,#B36BFF);display:grid;place-items:center;margin-bottom:4px}' +
    '#cc-auth h1{margin:0;font-size:1.35rem;letter-spacing:-.02em;background:linear-gradient(90deg,#fff,#B9BDFF);-webkit-background-clip:text;background-clip:text;color:transparent}' +
    '#cc-auth p{margin:0;color:#8A92A3;font-size:.86rem}' +
    '#cc-auth input{font:inherit;font-size:16px;background:#07080A;color:#E9ECF2;border:1px solid #262B35;border-radius:10px;padding:12px}' +
    '#cc-auth input:focus{outline:2px solid #7C83FF;outline-offset:1px}' +
    '#cc-auth button{font:inherit;font-weight:600;border:0;border-radius:10px;padding:12px;color:#fff;background:linear-gradient(90deg,#7C83FF,#B36BFF);cursor:pointer}' +
    '#cc-auth button[disabled]{opacity:.6}' +
    '#cc-auth .err{color:#FF4D6D;font-size:.84rem;min-height:1.1em}' +
    '#cc-auth .mono{font-family:"Geist Mono",ui-monospace,monospace;font-size:.7rem;letter-spacing:.14em;text-transform:uppercase;color:#3DF5A8}';
  function showLogin(message) {
    return new Promise(resolve => {
      const mount = () => {
        if (!document.getElementById('cc-auth-css')) { const st = document.createElement('style'); st.id = 'cc-auth-css'; st.textContent = CSS; document.head.appendChild(st); }
        const old = document.getElementById('cc-auth'); if (old) old.remove();
        const w = document.createElement('div'); w.id = 'cc-auth';
        const name = (cfg && cfg.appName) || 'Command Center';
        w.innerHTML = '<form autocomplete="on"><div class="mk"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round"><path d="M4 17l5-5 4 4 7-8"/><path d="M15 8h5v5"/></svg></div>' +
          '<span class="mono">Private · invite only</span><h1></h1><p>Sign in to continue.</p>' +
          '<input type="email" name="email" placeholder="Email" autocomplete="username" required>' +
          '<input type="password" name="password" placeholder="Password" autocomplete="current-password" required>' +
          '<div class="err" role="alert"></div><button type="submit">Sign in</button></form>';
        w.querySelector('h1').textContent = name;
        if (message) w.querySelector('.err').textContent = message;
        document.body.appendChild(w);
        const f = w.querySelector('form'), btn = f.querySelector('button'), err = f.querySelector('.err');
        f.addEventListener('submit', async e => {
          e.preventDefault(); err.textContent = ''; btn.disabled = true; btn.textContent = 'Signing in…';
          try {
            const {data, error} = await client.auth.signInWithPassword({email: f.email.value.trim(), password: f.password.value});
            if (error) throw error;
            w.remove(); resolve(data.session);
          } catch (e2) {
            err.textContent = /invalid/i.test(String(e2 && e2.message)) ? 'Wrong email or password.' : 'Couldn’t sign in. Check your connection and try again.';
            btn.disabled = false; btn.textContent = 'Sign in';
          }
        });
        setTimeout(() => f.email.focus(), 50);
      };
      if (document.body) mount(); else document.addEventListener('DOMContentLoaded', mount, {once: true});
    });
  }
  const ready = (async () => {
    try { cfg = await loadConfig(); } catch (e) { return fatal('Can’t reach the server. Check your connection, then reopen the app.'); }
    if (!cfg.supabaseUrl || !cfg.supabaseAnonKey) return fatal('Setup isn’t finished: SUPABASE_URL and SUPABASE_ANON_KEY are missing in Vercel.');
    if (cfg.appName) document.title = cfg.appName;
    if (!window.supabase || !window.supabase.createClient) return fatal('Couldn’t load the sign-in library. Check your connection, then reopen the app.');
    client = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey, {auth: {persistSession: true, autoRefreshToken: true, storageKey: 'cc-auth'}});
    const {data} = await client.auth.getSession();
    session = data && data.session;
    if (!session) session = await showLogin();
    client.auth.onAuthStateChange((ev, s) => { if (s) session = s; if (ev === 'SIGNED_OUT') location.reload(); });
    return true;
  })().catch(e => { console.error(e); return false; });
  function fatal(msg) {
    const mount = () => { const d = document.createElement('div'); d.id = 'cc-auth'; d.innerHTML = '<form><p class="err"></p></form>'; d.querySelector('.err').textContent = msg; if (!document.getElementById('cc-auth-css')) { const st = document.createElement('style'); st.id = 'cc-auth-css'; st.textContent = CSS; document.head.appendChild(st); } document.body.appendChild(d); };
    if (document.body) mount(); else document.addEventListener('DOMContentLoaded', mount, {once: true});
    return false;
  }
  const uid = () => session && session.user && session.user.id;
  async function token() { try { const {data} = await client.auth.getSession(); if (data && data.session) session = data.session; } catch (e) {} return session && session.access_token; }
  const err = (code, message, extra) => Object.assign({code, message: message || code}, extra || {});
  const netErr = e => (e && (e.name === 'TypeError' || /fetch|network|Failed/i.test(String(e.message)))) ? err('unavailable', String(e.message || e)) : e;

  /* ---------- user ---------- */
  const user = Object.freeze({ id: async () => uid() });

  /* ---------- db: private docs in app_docs ---------- */
  const watchers = {};
  const cacheKey = name => 'cc-doc:' + uid() + ':' + name;
  const snap = data => ({exists: data != null, data: () => (data == null ? undefined : JSON.parse(JSON.stringify(data))), metadata: {hasPendingWrites: false}});
  async function readDoc(name) {
    try {
      const {data, error} = await client.from('app_docs').select('data').eq('app', APP).eq('name', name).maybeSingle();
      if (error) throw error;
      const d = data ? data.data : null;
      if (d != null) LS.set(cacheKey(name), JSON.stringify(d));
      return d;
    } catch (e) {
      const c = LS.get(cacheKey(name)); if (c) return JSON.parse(c);
      throw netErr(e);
    }
  }
  let docChannel = null;
  function ensureDocChannel() {
    if (docChannel) return;
    docChannel = client.channel('docs-' + uid())
      .on('postgres_changes', {event: '*', schema: 'public', table: 'app_docs', filter: 'user_id=eq.' + uid()}, p => {
        const row = p.new || {}; if (row.app && row.app !== APP) return;
        const name = row.name; if (name && watchers[name]) refreshDoc(name);
      }).subscribe();
  }
  async function refreshDoc(name) { try { const d = await readDoc(name); (watchers[name] || []).forEach(w => { try { w(snap(d)); } catch (e) {} }); } catch (e) {} }
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && client && uid()) Object.keys(watchers).forEach(refreshDoc); });
  function docRef(path) {
    const name = String(path).split('/').pop();
    return Object.freeze({
      get: async () => snap(await readDoc(name)),
      set: async data => {
        const row = {user_id: uid(), app: APP, name, data, v: Math.round(Number(data && data._v) || Date.now()), updated_at: new Date().toISOString()};
        let res;
        try { res = await client.from('app_docs').upsert(row, {onConflict: 'user_id,app,name'}); } catch (e) { throw netErr(e); }
        if (res.error) { const m = String(res.error.message || ''); throw /fetch|network/i.test(m) ? err('unavailable', m) : err('write_failed', m); }
        LS.set(cacheKey(name), JSON.stringify(data));
      },
      onSnapshot: (cb, onErr) => { (watchers[name] = watchers[name] || []).push(cb); try { ensureDocChannel(); } catch (e) { onErr && onErr(e); } return () => { watchers[name] = (watchers[name] || []).filter(f => f !== cb); }; }
    });
  }
  const db = Object.freeze({ doc: docRef });

  /* ---------- AI: streams from /api/ai, runs tool calls locally ---------- */
  function toMessages(input) {
    const raw = typeof input === 'string' ? [{role: 'user', content: input}] : (Array.isArray(input) ? input : [{role: 'user', content: String(input)}]);
    const out = [];
    raw.forEach(m => {
      const role = m.role === 'assistant' ? 'assistant' : 'user';
      const content = typeof m.content === 'string' ? [{type: 'text', text: m.content || '(empty)'}] : m.content;
      const last = out[out.length - 1];
      if (last && last.role === role) last.content = last.content.concat(content); else out.push({role, content: content.slice()});
    });
    if (out.length && out[0].role !== 'user') out.unshift({role: 'user', content: [{type: 'text', text: '(start)'}]});
    return out;
  }
  async function callOnce(messages, opts, tools, onDelta) {
    const t = await token(); if (!t) throw err('session_expired');
    let r;
    try {
      r = await fetch('/api/ai', {method: 'POST', signal: opts.signal, headers: {'Content-Type': 'application/json', Authorization: 'Bearer ' + t},
        body: JSON.stringify({messages, tools, tier: opts.modelTier === 'quick' ? 'quick' : 'main', json: !!opts.__json})});
    } catch (e) { if (e && e.name === 'AbortError') throw err('cancelled'); throw err('unavailable', String(e && e.message)); }
    if (!r.ok) {
      let j = {}; try { j = await r.json(); } catch (e) {}
      const code = j.code || ({401: 'session_expired', 403: 'not_granted', 413: 'prompt_too_large', 429: 'rate_limited', 503: 'sampling_disabled'}[r.status]) || 'unavailable';
      throw err(code, j.error);
    }
    const reader = r.body.getReader(), dec = new TextDecoder();
    const blocks = []; let stop = null, buf = '';
    const handle = ev => {
      if (ev.type === 'content_block_start') { const b = ev.content_block; blocks[ev.index] = b.type === 'tool_use' ? {type: 'tool_use', id: b.id, name: b.name, json: ''} : {type: b.type, text: b.text || ''}; }
      else if (ev.type === 'content_block_delta') { const b = blocks[ev.index]; if (!b) return; if (ev.delta.type === 'text_delta') { b.text += ev.delta.text; onDelta(ev.delta.text); } else if (ev.delta.type === 'input_json_delta') b.json += ev.delta.partial_json; }
      else if (ev.type === 'message_delta') { if (ev.delta && ev.delta.stop_reason) stop = ev.delta.stop_reason; }
      else if (ev.type === 'error') { const t2 = ev.error && ev.error.type; throw err(t2 === 'overloaded_error' || t2 === 'rate_limit_error' ? 'rate_limited' : 'unavailable', ev.error && ev.error.message); }
    };
    try {
      for (;;) {
        const {done, value} = await reader.read(); if (done) break;
        buf += dec.decode(value, {stream: true});
        let i; while ((i = buf.indexOf('\n\n')) >= 0) {
          const chunk = buf.slice(0, i); buf = buf.slice(i + 2);
          chunk.split('\n').forEach(line => { if (line.startsWith('data:')) { const s = line.slice(5).trim(); if (s && s !== '[DONE]') handle(JSON.parse(s)); } });
        }
      }
    } catch (e) { if (e && e.name === 'AbortError') throw err('cancelled'); throw e.code ? e : err('unavailable', String(e && e.message)); }
    const content = blocks.filter(Boolean).map(b => b.type === 'tool_use' ? {type: 'tool_use', id: b.id, name: b.name, input: b.json ? JSON.parse(b.json) : {}} : {type: 'text', text: b.text}).filter(b => b.type !== 'text' || b.text);
    return {content, stop};
  }
  async function sample(input, opts) {
    opts = opts || {};
    const messages = toMessages(input);
    const tools = (opts.tools || []).map(t => ({name: t.name, description: t.description || '', input_schema: t.inputSchema || t.input_schema || {type: 'object'}}));
    let text = '', stop = null;
    const onDelta = d => { text += d; if (opts.onText) { try { opts.onText({text, delta: d}); } catch (e) {} } };
    for (let round = 0; round < 6; round++) {
      let res;
      try { res = await callOnce(messages, opts, tools, onDelta); }
      catch (e) { if (text) e.text = text; throw e; }
      stop = res.stop;
      const calls = res.content.filter(b => b.type === 'tool_use');
      if (stop !== 'tool_use' || !calls.length) break;
      messages.push({role: 'assistant', content: res.content});
      const results = [];
      for (const c of calls) {
        const tool = (opts.tools || []).find(t => t.name === c.name);
        try { const out = tool && tool.execute ? await tool.execute(c.input || {}) : {error: 'unknown tool'}; results.push({type: 'tool_result', tool_use_id: c.id, content: JSON.stringify(out == null ? {ok: true} : out)}); }
        catch (e) { results.push({type: 'tool_result', tool_use_id: c.id, is_error: true, content: String((e && e.message) || e)}); }
      }
      messages.push({role: 'user', content: results});
      if (text && !/\s$/.test(text)) onDelta('\n\n');
    }
    if (!text.trim()) throw err('empty_completion');
    return {text, truncated: stop === 'max_tokens'};
  }
  function parseJSON(t) {
    let s = String(t).trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
    try { return JSON.parse(s); } catch (e) {}
    const a = s.search(/[\[{]/), b = Math.max(s.lastIndexOf(']'), s.lastIndexOf('}'));
    if (a >= 0 && b > a) { try { return JSON.parse(s.slice(a, b + 1)); } catch (e) {} }
    throw err('invalid_json');
  }
  sample.json = async (input, opts) => { const r = await sample(input, Object.assign({}, opts || {}, {tools: undefined, onText: undefined, __json: true})); return parseJSON(r.text); };
  sample.limits = async () => ({tools: true});

  /* ---------- downloads ---------- */
  const downloads = Object.freeze({
    save: async ({filename, data}) => {
      const blob = data instanceof Blob ? data : new Blob([data], {type: /\.json$/.test(filename) ? 'application/json' : 'text/plain'});
      try { const file = new File([blob], filename, {type: blob.type}); if (navigator.canShare && navigator.canShare({files: [file]}) && /iPhone|iPad/.test(navigator.userAgent)) { await navigator.share({files: [file]}); return {status: 'saved'}; } } catch (e) { if (e && e.name === 'AbortError') throw err('declined'); }
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = filename; document.body.appendChild(a); a.click();
      setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 2000);
      return {status: 'saved'};
    }
  });

  /* ---------- crew ---------- */
  const q = async p => { const {data, error} = await p; if (error) throw error; return data; };
  const crew = Object.freeze({
    me: async () => ({id: uid(), email: session.user.email}),
    getProfile: async () => q(client.from('profiles').select('id,display_name,app').eq('id', uid()).maybeSingle()),
    setProfile: async name => q(client.from('profiles').upsert({id: uid(), display_name: String(name).slice(0, 40), app: APP}, {onConflict: 'id'})),
    myCrews: async () => q(client.from('crews').select('id,name,invite_code,created_by,created_at').order('created_at', {ascending: true})),
    createCrew: async name => q(client.rpc('create_crew', {crew_name: name})),
    joinCrew: async code => q(client.rpc('join_crew', {code: String(code).trim().toUpperCase()})),
    members: async crewId => {
      const rows = await q(client.from('crew_members').select('user_id,joined_at').eq('crew_id', crewId));
      const ids = rows.map(r => r.user_id);
      const profs = ids.length ? await q(client.from('profiles').select('id,display_name,app').in('id', ids)) : [];
      return ids.map(id => Object.assign({id, display_name: null, app: null}, profs.find(p => p.id === id) || {}));
    },
    history: async (crewId, since) => q(client.from('shared_status').select('user_id,date,checkin,stats,updated_at').eq('crew_id', crewId).gte('date', since)),
    publish: async (crewId, date, st) => q(client.from('shared_status').upsert({user_id: uid(), crew_id: crewId, date, schedule: st.schedule || [], checkin: st.checkin || {}, stats: st.stats || {}, updated_at: new Date().toISOString()}, {onConflict: 'user_id,crew_id,date'})),
    nudge: async (crewId, to, kind, message) => q(client.from('nudges').insert({crew_id: crewId, from_user: uid(), to_user: to, kind, message: message || null})),
    watchStatus: (crewId, date, cb) => {
      const load = () => client.from('shared_status').select('*').eq('crew_id', crewId).eq('date', date).then(({data}) => cb(data || []), () => {});
      load();
      const ch = client.channel('status-' + crewId + '-' + date + '-' + Math.random().toString(36).slice(2))
        .on('postgres_changes', {event: '*', schema: 'public', table: 'shared_status', filter: 'crew_id=eq.' + crewId}, load).subscribe();
      const vis = () => { if (document.visibilityState === 'visible') load(); };
      document.addEventListener('visibilitychange', vis);
      return () => { document.removeEventListener('visibilitychange', vis); client.removeChannel(ch); };
    },
    watchNudges: (crewId, cb) => {
      let list = [];
      const load = fresh => client.from('nudges').select('*').eq('crew_id', crewId).order('created_at', {ascending: false}).limit(20).then(({data}) => { list = data || []; cb(list, fresh || null); }, () => {});
      load();
      const ch = client.channel('nudges-' + crewId + '-' + Math.random().toString(36).slice(2))
        .on('postgres_changes', {event: 'INSERT', schema: 'public', table: 'nudges', filter: 'crew_id=eq.' + crewId}, p => load(p.new)).subscribe();
      return () => client.removeChannel(ch);
    }
  });

  /* ---------- the interface the app expects ---------- */
  const caps = {db, user, sample, downloads, crew};
  window.CC_HOST = Object.freeze({
    standalone: true,
    signOut: async () => { try { Object.keys(localStorage).filter(k => k.startsWith('cc-doc:')).forEach(k => LS.del(k)); } catch (e) {} await client.auth.signOut(); }
  });
  window.claude = Object.freeze({ use: name => ready.then(ok => (ok && caps[name]) || null) });
})();
