# Command Center: your private app

It's the same app you've been using, now running on your own server instead of inside Claude. It has its own icon and login, syncs between iPhone, Mac, and PC, and works offline. Your mentor runs through your own AI key, and the Crew tab connects you with your friend's app.

Nobody can sign up. Only accounts you create yourself can log in.

**Time:** about 30 minutes, once.
**Cost:** Supabase and Vercel are free. The AI is pay-as-you-go on your Anthropic key: a normal chat is a few cents, and you set a monthly cap.

---

## What's in this folder

| Path | What it is |
|---|---|
| `public/` | The app: page, login layer, offline cache, icons |
| `api/` | Three small server functions: the AI mentor (holds your key), config, and the app manifest |
| `supabase/setup.sql` | The database: tables, privacy rules, and crew functions. Run it once |
| `src/command-center.html` | App source, the same as your Claude version |
| `tools/build.py` | Rebuilds `public/index.html` from `src/` after updates |
| `docs/CREW_SPEC.md` | The contract your friend's app follows so the two connect |

---

## Step 1: Supabase (database + login)

1. Go to **supabase.com** → **Start your project** → sign in with GitHub.
2. **New project**:
   - Name: `command-center`
   - Database password: generate one and save it somewhere
   - Region: **West US (North California)**
   - Click **Create new project** and wait about 2 minutes.
3. Left sidebar → **SQL Editor** → **New query**. Open `supabase/setup.sql`, copy all of it, paste it in, and click **Run**. You should see "Success. No rows returned."
4. Turn off public sign-ups: left sidebar → **Authentication** → **Sign In / Providers** (on some dashboards: **Providers → Email**). Turn **off** "Allow new users to sign up", then **Save**.
5. Create your login: **Authentication** → **Users** → **Add user** → **Create new user**.
   - Enter your email and a strong password.
   - Tick **Auto Confirm User**, then **Create user**.
6. Get two values from **Project Settings** (gear icon) → **API** or **API Keys**:
   - **Project URL**, like `https://abcdxyz.supabase.co` (also under **Data API**)
   - **anon public key**: a long `eyJ...` string. Newer dashboards keep it under the **Legacy API keys** tab. If you only see a "publishable" key, use that.

Paste both into a note. You'll need them in Step 4.

## Step 2: Anthropic (the AI mentor)

1. Go to **console.anthropic.com** and sign up.
2. **Billing** → add $10 in credit → set a **monthly spend limit** (for example, $20).
3. **API Keys** → **Create Key** → name it `command-center` → copy the key (starts with `sk-ant-`).
   - You only see it once. It goes in Vercel only. Never put it in the code or send it to anyone.

## Step 3: GitHub (stores the code)

1. **github.com** → **+** → **New repository** → name it `command-center` → choose **Private** → **Create repository**.
2. On the new repo page, click **uploading an existing file**.
3. Unzip this package. Open the `command-center-app` folder, select **everything inside it** (not the folder itself), and drag it into the page.
   - That's `api`, `public`, `src`, `supabase`, `tools`, `docs`, `package.json`, `vercel.json`, and `README.md`.
4. Click **Commit changes**.

## Step 4: Vercel (puts it online)

1. **vercel.com** → **Sign Up** → **Continue with GitHub**.
2. **Add New…** → **Project** → find `command-center` → **Import**.
3. Leave Framework Preset as **Other**. Open **Environment Variables** and add:

| Name | Value |
|---|---|
| `SUPABASE_URL` | the Project URL from Step 1 |
| `SUPABASE_ANON_KEY` | the anon public key from Step 1 |
| `ANTHROPIC_API_KEY` | the `sk-ant-…` key from Step 2 |
| `ALLOWED_EMAILS` | your login email. Only these emails can use the AI, so your friend can't run up your bill |
| `APP_NAME` | `Command Center`, or any name you want |

4. Click **Deploy**. In about a minute you get a link like `command-center-xyz.vercel.app`.
   - Optional: **Settings → Domains** lets you change it to a nicer `.vercel.app` name or your own domain.
5. Open the link and sign in with the email and password from Step 1.

If you change an environment variable later, go to **Deployments** → **⋯** on the latest one → **Redeploy**.

## Step 5: Bring your data over from the Claude version

1. In the Claude version, open **Settings** (gear, top right) → **Export everything (.json)** and save the file.
   - If it shows the text instead of downloading, tap **Copy**.
2. In the new app: **Settings** → **Restore from backup** → pick the file (or paste the text) → **Restore** → tap again to confirm.

Your schedule, tasks, training, money, deals, mentor history, and learning progress all come across.

## Step 6: Install it like a real app

- **iPhone:** open the link in **Safari** → **Share** button → **Add to Home Screen** → **Add**. Always open it from the new icon: it runs full screen, with no Safari bars.
- **Mac:** open the link in **Safari** → menu bar **File** → **Add to Dock**.
  - With Chrome instead: **⋮** → **Cast, save, and share** → **Install page as app**.
- **PC:** open the link in **Chrome** or **Edge** → click the install icon at the right end of the address bar (a small monitor with an arrow).
  - Or: Chrome **⋮** → **Cast, save, and share** → **Install page as app**. Edge: **⋯** → **Apps** → **Install this site as an app**.

All three share the same account and sync live. Change something on your phone and it shows up on your Mac within a second or two.

---

## Connect with your friend (Crew)

The two apps connect by sharing **one** Supabase project, the one you just made.

1. **Make his login:** Supabase → **Authentication** → **Users** → **Add user**, with his email and a password. Tick **Auto Confirm User**.
2. **Give his app the same two values:** your `SUPABASE_URL` and `SUPABASE_ANON_KEY`. Whoever is building his app needs them, along with `docs/CREW_SPEC.md`.
   - **His app must not run its own setup SQL.** Your `setup.sql` already created everything both apps need. Running it again would fail.
3. In your app, open **Crew**:
   - Set your display name.
   - **Create crew**.
   - Send him the 6-character invite code.
4. He enters the code in his app's join screen. You'll both see each other's schedule, daily check-in, streak, and stats, and can nudge each other ("Gym in 10", "Locked in", "You good?").

**What he can't see:** your tasks, money, deals, mentor chats, and everything else. Only the daily check-in card is shared. Money numbers stay hidden unless you tick **Share money stats** on the Crew tab.

The privacy rules are enforced by the database itself, not just the app. I tested them: he can't read your private data even with direct database access, and someone outside the crew sees nothing.

---

## Renaming it

Change `APP_NAME` in Vercel, then redeploy. On iPhone you can also type any name when you tap **Add to Home Screen**.

## Updating the app later

When I change the app in Claude, I'll give you a new `src/command-center.html`. Then:

1. Put it in `src/`.
2. Run `python3 tools/build.py`. It creates `public/index.html`.
3. Upload both files to GitHub (**Add file → Upload files → Commit**). Vercel redeploys automatically.

Or just ask me for the finished `public/index.html` and upload only that. The installed app picks up the new version the next time you open it with internet.

## Costs and limits

- **Supabase free tier** pauses a project after about 7 days with no activity. Daily use keeps it awake. If it pauses, click **Restore** in the dashboard and nothing is lost.
- **Vercel free tier** is plenty for two people. Mentor replies have a 60-second limit per message.
- **Anthropic** charges per message. The spend limit you set in Step 2 is a hard cap.
- Models default to Sonnet for chat and Haiku for quick jobs. You can override them with the `MODEL_MAIN` and `MODEL_QUICK` variables in Vercel.

## If something's off

| You see | Fix |
|---|---|
| "Setup isn't finished: SUPABASE_URL…" | The env vars are missing or misspelled in Vercel. Fix them, then redeploy |
| "Wrong email or password" | Check the user exists in Supabase **Authentication → Users** and is confirmed. Reset the password there if needed |
| Mentor says "AI access is off for this account" | Your login email isn't in `ALLOWED_EMAILS`. Add it and redeploy |
| Mentor says "The AI isn't set up yet" | `ANTHROPIC_API_KEY` is missing or wrong, or your Anthropic credit ran out |
| Crew: "Couldn't create the crew" | `setup.sql` didn't run fully. Check Supabase **Table Editor** for a `crews` table |
| Friend's code "didn't work" | Codes are letters 0–9 and A–F. Make sure he's on the same Supabase project |
| Changes not syncing | Check the dot next to "Synced privately" at the top. Pull to refresh or reopen the app |
