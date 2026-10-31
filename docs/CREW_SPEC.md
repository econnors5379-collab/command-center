# Crew spec: connecting Ethan's Command Center with his friend's trading app

Give this file to the Claude session building the other app. Both apps must follow it exactly so they connect. Neither app is public; sign-ups stay closed.

## What "connected" means
Two private apps, one shared backend. Each person's full app data stays private to them. Each app also publishes a small daily **shared status** to a "crew" (Ethan + his friend) so they can:
- see each other's schedule for today (same wake/gym time, work blocks, trading session),
- check in each day (gym done, plan followed, top 3 done, a short note),
- see each other's streaks and progress stats,
- send a nudge ("gym in 10", "you good?", "locked in").

Money numbers (P&L, income) are shared only if that person turns on "Share money stats" (off by default).

## Backend: ONE Supabase project used by both apps
**Status: Ethan's Command Center package creates this project and runs the SQL below (its `supabase/setup.sql`, which also adds `app_docs` to realtime). The trader app must NOT run this SQL again.** It connects with the same `SUPABASE_URL` and anon key, stores its private docs in `app_docs` with `app = 'trader'`, and writes its profile with `app = 'trader'`. Ethan creates the friend's login in Supabase → Authentication → Users.

Ethan creates it once and gives both apps the same project URL and anon key. Each app signs users in with Supabase Auth (email + password or magic link). Turn OFF public sign-ups in Supabase Auth settings and invite the two users from the dashboard.

Run this SQL once (Supabase → SQL editor):

```sql
-- Private per-app data (each app stores its own documents here; only the owner can read/write)
create table public.app_docs (
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  app text not null,                -- 'command-center' or 'trader'
  name text not null,               -- document name, e.g. 'tasks', 'trades'
  data jsonb not null,
  v bigint not null,                -- client timestamp (ms) for last-writer-wins
  updated_at timestamptz not null default now(),
  primary key (user_id, app, name)
);

create table public.profiles (
  id uuid primary key references auth.users on delete cascade,
  display_name text not null,
  app text not null check (app in ('command-center','trader')),
  created_at timestamptz not null default now()
);

create table public.crews (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  invite_code text unique not null,
  created_by uuid not null default auth.uid() references auth.users,
  created_at timestamptz not null default now()
);

create table public.crew_members (
  crew_id uuid not null references public.crews on delete cascade,
  user_id uuid not null references auth.users on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (crew_id, user_id)
);

-- One row per person per crew per day
create table public.shared_status (
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  crew_id uuid not null references public.crews on delete cascade,
  date date not null,               -- the person's local calendar date
  schedule jsonb not null default '[]',
  checkin jsonb not null default '{}',
  stats jsonb not null default '{}',
  updated_at timestamptz not null default now(),
  primary key (user_id, crew_id, date)
);

create table public.nudges (
  id bigserial primary key,
  crew_id uuid not null references public.crews on delete cascade,
  from_user uuid not null default auth.uid() references auth.users,
  to_user uuid not null references auth.users,
  kind text not null,               -- 'nudge' | 'gym' | 'locked_in' | 'custom'
  message text check (char_length(message) <= 280),
  created_at timestamptz not null default now()
);

create or replace function public.in_crew(c uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from crew_members where crew_id = c and user_id = auth.uid())
$$;

create or replace function public.is_crewmate(target uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from crew_members a join crew_members b on a.crew_id = b.crew_id
    where a.user_id = auth.uid() and b.user_id = target)
$$;

create or replace function public.join_crew(code text) returns uuid
language plpgsql security definer set search_path = public as $$
declare cid uuid;
begin
  select id into cid from crews where invite_code = code;
  if cid is null then raise exception 'Invalid invite code'; end if;
  insert into crew_members (crew_id, user_id) values (cid, auth.uid()) on conflict do nothing;
  return cid;
end $$;

create or replace function public.create_crew(crew_name text) returns table (id uuid, invite_code text)
language plpgsql security definer set search_path = public as $$
declare cid uuid; code text := upper(substr(md5(random()::text), 1, 6));
begin
  insert into crews (name, invite_code, created_by) values (crew_name, code, auth.uid()) returning crews.id into cid;
  insert into crew_members (crew_id, user_id) values (cid, auth.uid());
  return query select cid, code;
end $$;

alter table public.app_docs enable row level security;
alter table public.profiles enable row level security;
alter table public.crews enable row level security;
alter table public.crew_members enable row level security;
alter table public.shared_status enable row level security;
alter table public.nudges enable row level security;

create policy "own docs" on public.app_docs for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "see self and crewmates" on public.profiles for select using (id = auth.uid() or public.is_crewmate(id));
create policy "write own profile" on public.profiles for insert with check (id = auth.uid());
create policy "update own profile" on public.profiles for update using (id = auth.uid());
create policy "see my crews" on public.crews for select using (public.in_crew(id));
create policy "see crew members" on public.crew_members for select using (public.in_crew(crew_id));
create policy "leave crew" on public.crew_members for delete using (user_id = auth.uid());
create policy "read crew status" on public.shared_status for select using (public.in_crew(crew_id));
create policy "write own status" on public.shared_status for insert with check (user_id = auth.uid() and public.in_crew(crew_id));
create policy "update own status" on public.shared_status for update using (user_id = auth.uid() and public.in_crew(crew_id));
create policy "read my nudges" on public.nudges for select using (public.in_crew(crew_id) and (to_user = auth.uid() or from_user = auth.uid()));
create policy "send nudges" on public.nudges for insert with check (from_user = auth.uid() and public.in_crew(crew_id) and public.is_crewmate(to_user));

alter publication supabase_realtime add table public.shared_status, public.nudges, public.app_docs;
```

## Crew flow
1. Ethan's app (Crew tab, already built and tested): "Create crew" → calls `create_crew('Locked In')` → shows a 6-character invite code.
2. Friend's app: "Join crew" → enter code → calls `join_crew(code)`.
3. Each app subscribes with Supabase Realtime to `shared_status` (filter `crew_id=eq.<id>`) and to `nudges` (filter `to_user=eq.<my id>`).

## shared_status contract (both apps write and read this)
Each app upserts its row for today's local date whenever these change (debounced; at most one write every few seconds).

```json
{
  "schedule": [
    {"start": "03:45", "end": "04:45", "label": "Gym: Push", "kind": "gym"}
  ],
  "checkin": {
    "gym": true,
    "plan_followed": true,
    "top3_done": 2,
    "note": "Docstar emails out. Locked in.",
    "at": "2026-11-02T05:10:00-08:00"
  },
  "stats": {
    "streak_days": 5,
    "workouts_week": 2,
    "share_money": false
  }
}
```

- `schedule[].kind` is one of: `gym`, `work`, `trading`, `school`, `free`, `other`. Times are 24-hour local `HH:MM`. Each app decides how much detail to share in labels.
- `checkin` fields may be missing or `null` when not answered yet. `top3_done` is 0–3. `note` is at most 280 characters.
- `stats` always has `streak_days`, `workouts_week`, and `share_money`. App-specific keys are allowed; each app shows unknown keys as "label: value".
  - Command Center adds: `docstar_sent`, `docstar_replies`, `docstar_customers`, and `mtd_net` (only when `share_money` is true).
  - Trader app suggested: `sessions_week`, `rules_followed_pct`, `trades_today`, and `pnl_today` / `pnl_week` (only when `share_money` is true).
- A streak day counts when the person checks in with `plan_followed: true`.

## What each app shows for the crewmate
A "Crew" card: their name, today's schedule next to yours (so you can line up gym and work blocks), their check-in status, streak, the stats above, and a nudge button. Missing data shows as "No check-in yet", never invented.

## AI (if used)
Neither app exposes an API key in the browser. AI calls go through a server function (Vercel or Supabase Edge Function) that holds the Anthropic key and checks the user's Supabase session first.
