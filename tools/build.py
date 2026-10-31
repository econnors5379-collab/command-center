#!/usr/bin/env python3
"""Build public/index.html from the app source (src/command-center.html).

Run from the repo root:  python3 tools/build.py
Then commit and push; Vercel redeploys automatically.
"""
import pathlib, re, sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
SRC = ROOT / 'src' / 'command-center.html'
OUT = ROOT / 'public' / 'index.html'
SUPABASE_JS = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.js'

# User-facing text that mentions Claude -> standalone wording.
REPLACE = [
    ('Claude access is off for this app. Allow it from the artifact’s Permissions menu.', 'AI access is off for this account. Add your email to ALLOWED_EMAILS in Vercel.'),
    ('Claude isn’t available on this account here.', 'The AI isn’t set up yet. Add ANTHROPIC_API_KEY in Vercel.'),
    ('Sign in to Claude again, then retry.', 'Sign in again, then retry.'),
    ('Claude declined that request.', 'The AI declined that request.'),
    ('Claude returned nothing.', 'The AI returned nothing.'),
    ('Couldn’t reach Claude.', 'Couldn’t reach the AI.'),
    ('Saved privately to your Claude account under your own user space. Nobody else who opens this app, including other people it’s shared with, can read it. It syncs between your iPhone and desktop.',
     'Saved privately to your account. Only you can read it; your crew only sees the daily check-in you share. It syncs between your iPhone, Mac, and PC.'),
    ('Saving on this device only. Open the app from your Claude account to sync privately.', 'Saving on this device only. Sign in to sync privately.'),
    ('Saved privately to your Claude account. Only you can see it.', 'Saved privately to your account. Only you can see it.'),
    ('You’re viewing this outside your Claude account, so data will save on this device only. Open it from Claude to sync privately between your iPhone and desktop.',
     'You’re offline or signed out, so data will save on this device only. Sign in to sync between your iPhone, Mac, and PC.'),
    ('Open this app from Claude and allow it to use Claude to talk with your mentor.', 'The in-app mentor is off (no AI key set). You can turn it on later; see README, Step 2.'),
    ('<h2>AI is off in this view</h2>', '<h2>Mentor chat is off</h2>'),
    ('Claude reads your schedule', 'Your mentor reads your schedule'),
    ('AI isn’t available in this view. Open the app from Claude to get a daily game plan.', 'The AI game plan is off in this version. Your schedule and top 3 below still run the day.'),
    ('AI isn’t available in this view.', 'AI is off in this version.'),
    ('AI is off in this view.', 'AI is off in this version.'),
    ("'off in this view.'", "'off (no AI key set).'"),
    ('. Each AI request uses your own Claude usage.', '. AI requests are billed to your Anthropic API key.'),
    ('connect the new inbox to Claude', 'connect the new inbox to an automation tool'),
]

HEAD = '''<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="robots" content="noindex, nofollow">
<meta name="theme-color" content="#07080A">
<meta name="color-scheme" content="dark">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="apple-mobile-web-app-title" content="Command Center">
<link rel="manifest" href="/manifest.webmanifest">
<link rel="apple-touch-icon" href="/icons/apple-touch-icon.png">
<link rel="icon" type="image/png" href="/icons/favicon-64.png">
<title>Command Center</title>
<script src="''' + SUPABASE_JS + '''"></script>
<script src="/shim.js"></script>
'''
TAIL = '''
<script>if ('serviceWorker' in navigator) window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => {}));</script>
</body>
</html>
'''

def main():
    s = SRC.read_text(encoding='utf-8')
    for a, b in REPLACE:
        s = s.replace(a, b)
    s = re.sub(r'<title>.*?</title>\s*', '', s, count=1, flags=re.S)
    s = re.sub(r'<meta name="claude:[^>]*>\s*', '', s)
    s = s.replace('/* ================= crew (standalone app only; hidden inside Claude) ================= */', '/* ================= crew ================= */')
    left = [m.group(0) for m in re.finditer(r'.{0,50}Claude.{0,50}', s)]
    if left:
        print('Text still mentions Claude; add a replacement in tools/build.py:', *left, sep='\n  ')
        sys.exit(1)
    # Source is a fragment: styles + markup + script. Put <style>/<link> in head, the rest in body.
    m = re.search(r'</style>', s)
    head_part, body_part = (s[:m.end()], s[m.end():]) if m else ('', s)
    OUT.write_text(HEAD + head_part + '\n</head>\n<body>\n' + body_part.strip() + '\n' + TAIL, encoding='utf-8')
    print('Built', OUT.relative_to(ROOT), f'({OUT.stat().st_size // 1024} KB)')

if __name__ == '__main__':
    main()
