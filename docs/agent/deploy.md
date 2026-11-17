# Deploy, env, and the domain

Everything runs on Cloudflare's free plan plus free GitHub Actions minutes (the repo is public). There is no Vercel, Supabase, or Redis any more.

| Thing | Where |
| --- | --- |
| Worker `timetable` (SPA + `/api/*`) | https://aayam.kv404.dev (custom domain), https://timetable.kv404.workers.dev |
| D1 database `timetable` (APAC) | id `b11cefa5-4ea3-4c4c-984a-9718843fc49b`, binding `DB`, schema in `migrations/` |
| Sync job | `.github/workflows/sync.yml`, dispatched by the Worker cron every 5 min, own `*/15` backup schedule |
| Deploy | `.github/workflows/deploy.yml` on every push to `main`: typecheck, test, build, D1 migrations, `wrangler deploy`, then one sync |
| Repo | https://github.com/Kv-404/Aayam |

`kv404.dev` and `www.kv404.dev` are a separate portfolio that stays on Vercel. Never touch those DNS records or that Vercel project from this repo.

## Free plan budget

| Limit | Free | This app |
| --- | --- | --- |
| Worker CPU per request / cron | 10 ms | bootstrap ≈ 0.3 ms; cron = 1 GitHub API call |
| Worker requests | 100k/day | Only `/api/*` counts; static assets are free and unmetered. A visible tab makes ~12 API calls/hour, a hidden tab 0 |
| Subrequests per request | 50 | ≤ 2 |
| D1 rows read / written | 5M / 100k per day | ~3 rows written per unchanged job run (~900/day); a sheet edit rewrites only changed snapshots |
| D1 storage | 5 GB | ~30 MB |
| Actions minutes | unlimited (public repo) | ~1 min per run |

Do not move sheet parsing, JSON parsing of timetables, scrypt, or push fan-out into the Worker. Each one alone blows the 10 ms budget.

## Secrets and vars

Worker (`npx wrangler secret put <NAME>`): `AUTH_SECRET` (≥ 32 chars; signs faculty sessions and keys the admin hash), `GOOGLE_CLIENT_ID`, `ALLOWED_EMAIL_DOMAINS` (comma separated; `itm.edu` and `isu.ac.in` are always allowed), `ADMIN_PASSWORD` (≥ 12 chars; seeds the admin password), `GITHUB_TOKEN` (fine-grained PAT, this repo only, **Actions: read and write**; lets the Worker dispatch the sync job). Plain vars live in `wrangler.jsonc`: `COLLEGE_NAME`, `TIMEZONE`, `GITHUB_REPO`, `GITHUB_WORKFLOW`, optional `CLIENT_ORIGIN`.

GitHub repo secrets (Settings → Secrets and variables → Actions): `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, `D1_DATABASE_ID`.

Without `GITHUB_TOKEN` the site still serves, but only the `*/15` Actions schedule refreshes it (GitHub often runs that late), and admin changes wait for it.

Local: `.env` feeds the job only (see `.env.example`). Worker secrets for `wrangler dev` go in `.dev.vars`. Neither file is committed.

## Local

```bash
npm install
npm run dev     # local D1 migrations, wrangler dev on :8787 (Worker + local D1), the job every 120 s, Vite on :5173
```

Vite proxies `/api` to `:8787`. The job writes `wrangler dev`'s local D1 file (`--local-auto`), so the first page load may 503 for a few seconds until it finishes.

## One-time setup (owner)

1. **Cloudflare API token for CI**: dash.cloudflare.com → My Profile → API Tokens → Create Token → template **Edit Cloudflare Workers** → add permission **Account · D1 · Edit** → Zone Resources: `kv404.dev` → create. Put it in the GitHub secret `CLOUDFLARE_API_TOKEN`. Account id `8a94f3cbdca559e207f44875697856c2` → `CLOUDFLARE_ACCOUNT_ID`. D1 id above → `D1_DATABASE_ID`.
2. **GitHub token for the Worker**: github.com → Settings → Developer settings → Fine-grained tokens → repository access *Only Kv-404/Aayam* → permission **Actions: Read and write** → expiry 1 year (calendar a renewal). Then `npx wrangler secret put GITHUB_TOKEN`.
3. **Admin password**: `npx wrangler secret put ADMIN_PASSWORD`. The old Supabase hash was scrypt and cannot be checked within 10 ms, so the first login replaces it from this secret. After logging in once you may change it at `/admin`.
4. **Google sign-in**: Google Cloud Console → APIs & Services → Credentials → the OAuth web client → Authorized JavaScript origins must include `https://aayam.kv404.dev` (and `https://timetable.kv404.workers.dev` for testing).
5. Push `main`. The deploy workflow ships and runs one sync.

## Connecting kv404.dev (registered at Spaceship) without transferring it

The domain stays registered and billed at Spaceship. Only its DNS moves to Cloudflare (free). Cloudflare's free plan cannot attach a Worker to a domain whose DNS is elsewhere, so a nameserver change is the way to "connect".

1. **Add the site.** dash.cloudflare.com → Account home → **Onboard a domain** (Add a site) → `kv404.dev` → "Quick scan for DNS records" → plan **Free**.
2. **Check the imported records before anything else.** Records Cloudflare must hold, all set to **DNS only (grey cloud)** so Vercel keeps issuing their certificates:

   | Type | Name | Content | Proxy |
   | --- | --- | --- | --- |
   | A | `kv404.dev` (@) | `216.198.79.1` | DNS only |
   | CNAME | `www` | `9a17fb0d281e2c04.vercel-dns-017.com` | DNS only |
   | TXT | `kv404.dev` (@) | `google-site-verification=sgBIOrvW8rY529S9guF8AmISTAS1aKtRpP5G74gQPDw` | — |

   Do **not** recreate `aayam` (it was the Vercel CNAME `63dd4ac811c697be.vercel-dns-017.com`); delete it if the scan imported it. The Worker creates its own record for `aayam` in step 6. Compare against Spaceship's DNS page, and add any record the scan missed (for example MX if you later add mail).
3. **SSL mode.** SSL/TLS → Overview → **Full (strict)**.
4. **Switch nameservers at Spaceship.** spaceship.com → Domain Manager → `kv404.dev` → **Nameservers** → change from "Spaceship nameservers" to **Custom** → paste the two `*.ns.cloudflare.com` names Cloudflare showed you → Save. If DNSSEC is on at Spaceship, turn it off first (re-enable later from Cloudflare → DNS → Settings → DNSSEC, then paste the DS record back at Spaceship).
5. **Wait for "Active".** Cloudflare emails you, or press "Check nameservers" on the overview page. Usually minutes, at most 24 h. The portfolio keeps working throughout because the records match.
6. **Attach the Worker.** In `wrangler.jsonc` uncomment `"routes": [{ "pattern": "aayam.kv404.dev", "custom_domain": true }]` and push `main` (or `npm run deploy`). Cloudflare creates the `aayam` DNS record and certificate itself. Equivalent dashboard path: Workers & Pages → `timetable` → Settings → Domains & Routes → Add → Custom domain → `aayam.kv404.dev`.
7. **Verify.** `curl -s https://aayam.kv404.dev/api/health` returns `{"ok":true,...}` and `dig +short NS kv404.dev` shows Cloudflare.

Rollback before step 6: set Spaceship nameservers back to "Spaceship nameservers". Nothing else changes.

## After cutover: removing the old hosting

Only once `aayam.kv404.dev` serves from Cloudflare and a sync has run:

- **Vercel**: delete only the project that served `aayam.kv404.dev` (the timetable, formerly `time-table`). Keep the portfolio project for `kv404.dev`/`www`.
- **Supabase**: everything was copied to D1 (archive merged from the rows and the legacy JSON document, faculty directory, push subscriptions, VAPID keys, notices). Take a final backup (Database → Backups, or `pg_dump`) and then pause or delete the project.
- **Upstash Redis**: delete the database if one exists; nothing reads it.
- Google OAuth client secret: no longer used, can be rotated or deleted.

## Changing the sheet

Preferred: an admin pastes the new link at `/admin`. The Worker checks the export is a public xlsx, stores it in D1 `timetable_sheet_links`, and dispatches the job; the new sheet appears in about a minute. Admin links win over everything else.

Otherwise change the fallback id in `server/src/config.ts` and push `main`; the job uses it on its next run. A new sheet whose dates do not overlap the saved week is a fresh baseline (no events), and the outgoing week is kept under "past weeks".

## Operating

- Force a refresh: Actions → Sync timetable → Run workflow, or the Refresh button in the app.
- Watch it: `npx wrangler tail timetable` (Worker logs; observability is on at 20 % sampling); Actions run logs for the job (`[job] done in … ms …`).
- Query D1: `npx wrangler d1 execute timetable --remote --command "SELECT key, length(body) FROM snapshots ORDER BY 2 DESC LIMIT 5"`.
- A schema change is a new `migrations/000N_*.sql`. Deploy applies it before the new Worker goes live, so keep migrations additive.
