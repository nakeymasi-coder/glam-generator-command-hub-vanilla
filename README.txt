GLAM GENERATOR COMMAND HUB — PLAIN HTML / CSS / JAVASCRIPT VERSION
==================================================================

WHAT CHANGED
- React and Vite were removed from the front-end.
- No npm install or npm run dev is required to VIEW the app.
- index.html now uses relative files:
    style.css
    config.js
    script.js
- You can double-click index.html to open the interface directly in Edge.

FILES TO EDIT IN VS CODE
1. index.html  = page structure
2. style.css   = all visual styling
3. script.js   = app interactions, navigation, TTS, Supabase account actions
4. config.js   = public Supabase browser configuration only

LOCAL PREVIEW
Double-click index.html.
Click "Preview Dashboard Locally" to inspect and test the interface without an account.
Local preview data stays in that browser only and is NOT your production database.

CONNECT REAL MULTI-USER ACCOUNTS
1. Create a Supabase project.
2. Run supabase/migrations/001_initial.sql in Supabase SQL Editor.
3. Open config.js.
4. Add your Supabase Project URL and anon/publishable key.
5. NEVER put a service-role key, OpenAI key, TTS secret, or any other private API key in config.js/script.js/index.html.

SECURITY
The SQL migration includes Row Level Security for user-owned records. Production AI requests must go through the server/Edge Function scaffolds under supabase/functions.

NOTE ABOUT FILE://
The interface can be viewed from index.html directly. Some authentication email redirects work more reliably after the site is hosted on HTTPS because email providers need a normal redirect URL. This does not affect editing or previewing the front-end locally.
