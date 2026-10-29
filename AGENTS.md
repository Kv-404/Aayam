# Timetable

Live college timetable. One public Google Sheet is the only source. The server downloads its xlsx export and never writes back. Students pick a cohort. Faculty pick their name and see every lecture under it.

This file is injected every turn. It is the rulebook, not the encyclopedia. Open **one** file under `docs/agent/` for the task, then only the source files that file names. Do not list the repo, do not grep the whole tree, and do not open `node_modules/`, `server/data/*.sqlite`, or `api/[[...path]].js` (that bundle is generated).

## Which context file

| Task | Read |
| --- | --- |
| Setup, cohort or faculty mode, week or day view, colours, notifications, filters | `docs/agent/client.md` |
| Sync, parser, cancellations, change log, SQLite, blob archive | `docs/agent/server.md` |
| Sheet layout, what counts as OFF, week rollover | `docs/agent/sheet.md` |
| Env, Vercel, the committed API bundle, production sheet id | `docs/agent/deploy.md` |

Shared types and faculty-name matching are in `docs/agent/server.md`. Read a second context file only when the task crosses that boundary.

## Invariants

- Do not add Supabase, another database, or a write path to Google Sheets.
- The sheet stays shared so anyone with the link can view. The browser never gets a Google key.
- A lecture removed from a day that is still published stays on the grid as cancelled. It keeps its subject colour, with strikethrough and a Cancelled label. It must survive a process restart through the blob archive.
- A new sheet whose dates do not overlap the saved week is a fresh baseline: no added, removed, or cancelled events, and change rows from other weeks are dropped.
- Only the text `OFF`, `cancelled`, or `holiday` is a cancellation. A full-day merged label such as Dussehra is that subject on every slot, including lunch.
- Monday and Saturday off days are white cells in the sheet, not a special fill. Cancellation is text, not cell colour.
- Faculty names can share a cell (`Dr. Aarti & Ms. Kashmira`). Match people with `shared/faculty.ts`. Do not invent a second matcher.
- Phone timetable stays sparse: subject, cohort or faculty, compact room. Do not add extra lines to lecture cards.
- Cancelled cards keep the subject colour. Graphite is only for OFF. Do not bring back a solid danger fill.
- Production deploys from `main`. Live site: https://timetable.kv404.dev. Repo: https://github.com/Kv-404/Clg-timetable.git.
- `batch_access_codes` table in Neon PostgreSQL stores batch access PINs.
- Student authentication flow: PIN entered via `<CodeSlots />`, verified via `/api/auth/pin-verify`, restricts student cohort choices to that batch.
- Student logout clears `timetable-student-batch`, `timetable-role`, `timetable-cohort`, `timetable-setup`, and cleans the URL to `/`.

## Commands

```bash
npm install
npm run dev      # client http://localhost:5173, API http://localhost:8787, /api proxied
npm test         # server tests only
npm run typecheck
npm run build    # client dist, then api/[[...path]].js
```

`package.json` engines say Node 24. This machine may be newer. Run the test that covers the change. For a UI change, exercise the flow in the browser when browser tools exist.

## How to edit

- Match the surrounding file. React function components, hooks, two-space indent, no new dependency unless the task needs one.
- Client imports shared code as `@shared/...`. Server imports it as `../../shared/<file>.ts`.
- Local prefs live in `client/src/lib/prefs.ts`. Add a key there instead of a new storage call.
- After a server change that ships to Vercel, `npm run build:api` must be committed. Vercel looks for `api/[[...path]].js` before the build. Do not hand-edit that file.
- `.env` loads before `.env.local` and only fills unset keys. Do not commit either file.
- README's deploy section is stale about cold starts. Trust `docs/agent/deploy.md`.

## Do not

- Do not set the Vercel Production `SPREADSHEET_ID` on an instance that is still running old code. A warm old process would switch sheets without the week-baseline logic. The sheet id for production is the fallback in `server/src/config.ts`, baked in by rebuilding the API bundle.
- Do not treat a disappeared whole day as cancelled classes. If the day tab is gone, those lectures drop off the grid.
- Do not re-emit a cancelled removal on later syncs. `compareSnapshots` keeps one cancelled event.
- Do not show faculty their own name on every card. Show the cohort. Students see the faculty name.
- Do not reset a returning student's theme or cohort when adding a setup step. Role is `timetable-role`. Missing role shows "Who are you?" once.
