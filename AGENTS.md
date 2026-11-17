# Aayam timetable

Live college timetable at https://aayam.kv404.dev. Public Google Sheets (one per program and batch) are the only source; the app downloads their xlsx export and never writes back. Students pick a batch, then a section. Faculty sign in with Google and see every lecture under their name. Admins repoint sheets and post notices at `/admin`.

Everything runs on **Cloudflare Workers Free + D1**, with the heavy work in a **GitHub Actions job**:

```
Google Sheets ──xlsx──▶ sync job (Node, GitHub Actions)  ──writes──▶  D1: archive + prebuilt responses
                          parse · diff · archive · render                     │
                          · send pushes                                       ▼
browser ◀── static SPA (free) + /api/* ◀── Worker (≤10 ms CPU: D1 lookup + string concat)
                                             └─ cron */5 and admin actions dispatch the job
```

This file is the rulebook, injected every turn. Open **one** context file for the task, then only the source files it names. Do not list the repo, grep the whole tree, or open `node_modules/`, `.wrangler/`, `server/data/`, or `*.sqlite`.

## Which context file

| Task | Read |
| --- | --- |
| UI, setup flow, cohort/faculty mode, week/day view, colours, notifications, filters, polling | `docs/agent/client.md` |
| Worker routes, sync job, snapshots, D1 schema, parser, cancellations, change log, saved weeks, auth, admin, push | `docs/agent/server.md` |
| Sheet layout, what counts as OFF, week rollover | `docs/agent/sheet.md` |
| Secrets, deploy, free-plan budget, the domain, changing the production sheet, operating | `docs/agent/deploy.md` |

Shared types and faculty matching are in `docs/agent/server.md`. Read a second file only when the task crosses that boundary.

## Platform rules (free plan)

- **The Worker (`server/src/edge/`) never parses a sheet, builds a timetable, or `JSON.parse`s a timetable body.** It reads a prebuilt `snapshots` row and concatenates strings. Workers Free is 10 ms CPU per request; one sheet costs 150–400 ms. New read features are rendered by the job (`server/src/views.ts`, `server/src/job/snapshots.ts`) and stored as snapshots. Only exception: MCP tools (`edge/mcp.ts`) may parse one scoped `boot:`/`week:` row and `changes`, never `boot:all` (ask D1 with `json_extract`/`json_each` instead).
- The Worker has no `node:` imports, no `process`, no npm packages. It may import `shared/*.ts`, `server/src/config.ts` (keep that file free of Node built-ins), and `server/src/d1/sql.ts`. `npm run check:worker` must pass.
- Snapshot keys come only from `shared/scope.ts` (`scopeKey`, `snapshotKeys`). Job and Worker both call it; never build a key by hand.
- D1 is the only database. Do not add another one, a KV/Redis cache, or any write path to Google Sheets. Schema changes are a new `migrations/000N_*.sql`, additive; never edit an applied migration.
- All SQL goes through `SqlDb` (`server/src/d1/sql.ts`). Timestamps are ISO strings.
- Only `/api/*` and the MCP paths (`/mcp`, `/mcp/*`, `/oauth/*`, `/.well-known/*`) run the Worker (`run_worker_first`; mirror them in `vercel.json` until cutover). Static assets stay free; do not route pages through the Worker.
- Expensive crypto (scrypt, push encryption fan-out) does not go in the Worker. Pushes are sent by the job.
- The browser never gets a Google key. Sheets stay "anyone with the link can view".

## Timetable invariants

- A lecture removed from a day that is still published stays on the grid as cancelled, with its subject colour, strikethrough, and a Cancelled label. It survives job restarts and cache loss through the D1 archive.
- A whole day that disappeared is not cancelled classes: those lectures drop off the grid.
- `compareSnapshots` keeps one cancelled event; do not re-emit a cancelled removal on later syncs.
- A new sheet whose dates do not overlap the saved week is a fresh baseline: no added/removed/cancelled events, change rows from other weeks leave the live log, and the outgoing week is kept as a saved past week.
- A slot is cancelled by the text `OFF`, `cancelled`, or `holiday`, or by a red fill on the subject cell. A red lecture keeps its subject. A full-day merged label such as Dussehra is that subject on every slot, including lunch, unless that cell is red.
- Monday and Saturday off days are white cells. The word `OFF` cancels them. Orange, amber, gold, yellow, and white fills do not.
- Faculty names can share a cell (`Dr. Aarti & Ms. Kashmira`). Match people only with `shared/faculty.ts`.

## UI invariants

- Phone timetable stays sparse: subject, cohort or faculty, compact room. No extra lines on lecture cards.
- Cancelled cards keep the subject colour. Graphite is only for OFF. No solid danger fill.
- Faculty see the cohort on cards, never their own name. Students see the faculty name.
- Students pick a batch, then a section. There is no batch PIN gate.
- Student logout clears `timetable-student-batch`, `timetable-role`, `timetable-cohort`, `timetable-setup` and cleans the URL to `/`.
- Adding a setup step must not reset a returning student's theme or cohort. Role is `timetable-role`; missing role shows "Who are you?" once.
- Polling stays cheap: about every 5 min while visible, none while hidden, and no cache-busting (the Worker answers 304s). The free plan allows 100k API requests a day.

## Commands

```bash
npm install
npm run dev           # wrangler dev :8787 (Worker + local D1) + sync job every 120 s + Vite :5173 (/api proxied)
npm test              # server, job, and Worker tests (node:test via tsx)
npm run typecheck
npm run build         # client → client/dist
npm run check:worker  # bundle the Worker as Cloudflare would (no deploy)
npm run sync          # run the sync job once against D1 (needs CLOUDFLARE_* and D1_DATABASE_ID)
npm run deploy        # build, apply D1 migrations, wrangler deploy (CI does this on push to main)
```

`package.json` engines say Node 24. Run the tests that cover the change. For UI changes, exercise the flow in a browser when browser tools exist. For Worker changes, also run `npm run check:worker`.

## How to edit

- Match the surrounding file: React function components and hooks, two-space indent, no new dependency unless the task needs one (never one in the Worker).
- Client imports shared code as `@shared/...`. Server code imports it as `../../shared/<file>.ts`.
- Local prefs live in `client/src/lib/prefs.ts`. Add a key there, not a new storage call.
- Response shapes are `shared/types.ts`. The client must not depend on fields that are not on those types.
- `.env` feeds the local job; `.dev.vars` feeds `wrangler dev`. Commit neither. Production secrets are `wrangler secret put` and GitHub repo secrets (`docs/agent/deploy.md`).

## Do not

- Do not commit PINs, staff emails, passwords or hashes, VAPID private keys, tokens, or Meet links. The repo is public.
- Do not touch the `kv404.dev` / `www` DNS records or the portfolio's Vercel project; only `aayam.kv404.dev` is this app.
- Do not bring back Express, Vercel, Supabase, Redis, or an always-on server.
- Do not show faculty their own name on every card.
- Production deploys from `main` (GitHub Actions). Repo: https://github.com/Kv-404/Aayam.
