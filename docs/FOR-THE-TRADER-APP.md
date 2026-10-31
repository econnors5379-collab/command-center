# Note for whoever is building the trader app

Ethan's Command Center is built, deployed on Vercel, and running against a Supabase project he set up.

**To connect the trader app:**
- Use the SAME Supabase project. Ethan will give you `SUPABASE_URL` and `SUPABASE_ANON_KEY`.
- Do NOT run any setup SQL. The tables, row-level security, `create_crew` / `join_crew`, and realtime are already in place (see `CREW_SPEC.md`).
- Sign in with Supabase Auth email + password. Sign-ups are off, so Ethan creates the login in the dashboard.
- On first run, upsert `profiles` with `{id: auth.uid(), display_name, app: 'trader'}`.
- Join screen: `rpc('join_crew', {code})` with the 6-character code, uppercased.
- Publish today's row to `shared_status` (upsert on `user_id,crew_id,date`), debounced to every few seconds. Follow the JSON contract in `CREW_SPEC.md`. The Command Center already displays these trader keys: `sessions_week`, `rules_followed_pct`, `trades_today`, `pnl_today`, and `pnl_week`. The P&L keys show only when `share_money` is true.
- Subscribe to `shared_status` (filter `crew_id=eq.<id>`) and `nudges` (filter `crew_id=eq.<id>`).
  - Nudge kinds: `gym`, `locked_in`, `check`, each with a short `message`.
- Keep the Anthropic key server-side, as the spec says.
