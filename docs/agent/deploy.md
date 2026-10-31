# Deploy and env

## Local

`npm run dev` runs the API (`tsx watch server/src/index.ts`, port 8787) and Vite (port 5173) together. The client calls `/api` on its own origin.

Env files, first existing wins for each key: repo `.env`, then `.env.local`, then `server/.env`. Only unset keys are filled (`server/src/env.ts`). The Vercel bundle is CommonJS and skips these files; the host supplies env. Copy `.env.example` to `.env`. No Google key is required.

| Variable | Default | Role |
| --- | --- | --- |
| `SPREADSHEET_ID` | id in `server/src/config.ts` | Public sheet id, not a URL |
| `SYNC_INTERVAL_SECONDS` | 45 (clamped 15–3600) | Re-read interval |
| `HIGHLIGHT_HOURS` | 72 | How long an inferred edit stays highlighted |
| `TIMEZONE` | `Asia/Kolkata` | Today and the clock |
| `DATE_ORDER` | `DMY` | Numeric dates in the sheet |
| `DATABASE_PATH` | `./data/timetable.sqlite` | Local SQLite |
| `DATABASE_URL` | Neon connection string | Neon PostgreSQL database for faculty auth directory and timetable state archive across cold starts |
| `COLLEGE_NAME` | ITM Skills University | Shown in bootstrap |
| `CLIENT_ORIGIN` | unset | CORS when the client is on another origin |

## Production

Vercel project `time-table` (`prj_0cuPp3TGh4uyEVqCZzDZ13U8c3g5`), team `team_Ue3RQTiJ5uTaebnHUYaE6r15`. `vercel.json` builds with `npm run build`, output `client/dist`, function `api/**/*.js` max 30s. Pushes to `main` deploy https://timetable.kv404.dev. https://clg-timetable.vercel.app also served this app; https://clg-timetable-kv-404.vercel.app returned 404. Do not assume the `*.vercel.app` alias.

`npm run build` is `vite build` plus `npm run build:api`:

```bash
esbuild server/src/vercel.ts --bundle --platform=node --format=cjs --outfile=api/[[...path]].js --packages=external
```

Commit that outfile. Vercel resolves the function before the build runs, so a source-only push does not update the API. Do not edit the bundle by hand.

On Vercel, SQLite is `/tmp/timetable.sqlite` and dies on cold start. `syncOnRead` is on. Before compare, `hydrateArchive` loads Neon. Rows in `timetable_lectures`, `timetable_changes`, `timetable_weeks`, and `timetable_sync` are the stored timetable. `timetable_archive` remains so a build that still reads the single JSON document keeps working. `publishArchive` writes both after a successful sync. `DATABASE_URL` is set on Production, Preview, and Development. A removed lecture stays cancelled across cold starts because of that Neon archive.

## Changing the sheet

`getConfig` uses `process.env.SPREADSHEET_ID` when it is set, otherwise the hardcoded fallback in `server/src/config.ts`.

Production does not have `SPREADSHEET_ID` set. Only the Development env does. Production therefore uses the fallback inside the committed bundle. To point production at a new sheet:

1. Change the fallback in `server/src/config.ts` (and `.env` / `.env.example` for local).
2. `npm run build:api` and commit `api/[[...path]].js` with the source.
3. Push `main`.

Do not set Production `SPREADSHEET_ID` while an old deployment can still be warm. That process would switch sheets without the week-baseline logic in `replacesPublishedWeek`.

The new sheet's dates must not overlap the saved week, or last week's rows will diff as cancellations and additions. Overlap of zero dates is a fresh baseline.

README says a Vercel cold start is a fresh baseline and that you should set `SPREADSHEET_ID` on the project. That is out of date. The blob is the baseline, and production takes the id from the bundle.
