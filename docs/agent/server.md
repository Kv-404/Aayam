# Server and shared model

Two programs share `server/src` and `shared/`:

| Program | Entry | Runs on | Does |
| --- | --- | --- | --- |
| **Worker** | `server/src/edge/index.ts` | Cloudflare Workers Free | Static SPA plus a thin `/api/*` over D1. Never parses a sheet, never builds a timetable |
| **Sync job** | `server/src/job/run.ts` | GitHub Actions (`.github/workflows/sync.yml`), Node 24 | Downloads and parses the sheets, diffs, archives, renders every API response into D1, sends queued web pushes |

Why split: Workers Free allows 10 ms CPU per invocation (cron included). ExcelJS takes 150–400 ms per sheet. The Worker therefore looks up a prebuilt row and concatenates strings; it never `JSON.parse`s a timetable. A ~400 KB bootstrap assembles in about 0.3 ms (`server/test/edgeBench.test.ts` fails above 1 ms). Keep it that way: any new read feature is rendered by the job and stored as a snapshot.

The Worker must stay free of `node:` imports, `process`, and npm packages. It may import `shared/*.ts`, `server/src/config.ts` (keep that file free of Node built-ins), and `server/src/d1/sql.ts`. Check with `npm run check:worker` (bundle is ~37 KB gzip).

## Database: D1 `timetable`, binding `DB`

Schema is `migrations/*.sql`, applied by `wrangler d1 migrations apply timetable` (deploy does it). Add a new numbered file; never edit an applied one. Every reader and writer goes through `SqlDb` (`server/src/d1/sql.ts`): `fromD1` in the Worker, `d1RestDb` (`server/src/d1/rest.ts`, D1 REST API, chunked, retried) in the job, `sqliteDb` (`server/src/d1/sqlite.ts`, node:sqlite + migrations) in tests and local dev.

| Tables | Written by | Read by |
| --- | --- | --- |
| `timetable_sync`, `timetable_lectures`, `timetable_changes`, `timetable_weeks` (the archive; `week_id = 'live'` or a saved week id) | job | job |
| `snapshots` (key, body, hash) | job | Worker |
| `job_state` (requested/dispatched/finished) | both | both |
| `timetable_sheet_links` | Worker (admin) | job |
| `student_notices`, `push_subscriptions`, `push_vapid` | Worker; job sets `pushed_at` and prunes dead subscriptions | both |
| `app_push_devices`, `app_push_state` (`migrations/0005_app_push.sql`) | Worker upserts phone tokens; job sends, moves `changes_after`, prunes dead tokens | job |
| `app_settings` (`exam_mode` = `"1"`/`"0"`) | Worker (admin toggle) | Worker, inside the bootstrap query |
| `faculty_directory`, `admin_password`, `admin_sessions`, `rate_limits` | Worker | Worker |
| `mcp_oauth_*` (`migrations/0002_mcp_oauth.sql`) | nothing: the MCP server was removed; the empty tables stay because migrations are additive | — |

Timestamps are ISO strings (`toISOString()`), compared as text. `rate_limits.reset_at` is epoch ms.

## Snapshots (the read model)

Keys come only from `shared/scope.ts`: `scopeKey(scope, index)` turns a request into `all`, `none`, `b:<course>|<batch>`, `d:<division>`, or `f:<faculty>` (lowercased; faculty and division are resolved with `matchFaculty` / `matchChoice`). The job writes with the same function, so a request lands on the row the job wrote.

| Key | Body |
| --- | --- |
| `index` | `SnapshotIndex`: choices, faculties, batches, timezone |
| `sync` | `SyncInfo` without `refreshing` |
| `changes` | `{"changes":[...]}`, newest 200 |
| `boot:<scope>` | `BootstrapResponse` without `now`, `today`, `sync`, `notices` |
| `ics:<scope>` | ICS text, `d:` and `f:` only |

The job renders with `server/src/views.ts` (`buildBootstrap` and calendar views; golden output in `server/test/views.test.ts`) and writes only rows whose hash changed (`server/src/job/snapshots.ts`). An unchanged run writes about 3 rows. Keys it no longer produces are deleted, so old `week:` rows go on the first run. Past weeks are archived in D1 but never published as snapshots.

## Worker routes (`server/src/edge/`)

| Route | Behaviour |
| --- | --- |
| `GET /api/bootstrap` | `?division=` (alias `cohort`), `?faculty=`, `?course=`, `?batch=`, `?all=1`. One D1 round trip. Adds `now`, `today` (in `index.timezone`), `sync.refreshing`, `notices` (student scopes: course/batch match, 14 days, not past `expires_at`, newest 5) and `examMode` (from `app_settings`, same query). ETag + 304, `Cache-Control: no-cache`; the ETag hashes notice ids, `updated_at` and `expires_at`, plus the exam flag. 503 + `Retry-After` before the first job run. A read older than 12 min asks for a sync in the background |
| `POST /api/sync` | Records a user request, dispatches the job (at most once a minute), returns the current bootstrap with `refreshing: true` |
| `GET /api/calendar.ics` | `?division=` or `?faculty=`, `download=1` sets Content-Disposition |
| `GET /api/changes`, `/api/health`, `/api/db-status` | From snapshots; D1 ping |
| `/api/auth/config`, `/me`, `/google`, `/logout` | Google ID token via tokeninfo, allowed domains, `faculty_directory` (case-insensitive, active). HMAC session with `AUTH_SECRET`, cookie `timetable_faculty_session`, or `Authorization: Bearer`. 8 tries / 10 min / IP |
| `/api/admin/session`, `/login`, `/logout`, `/password` | Hash `hmac-sha256:<salt>:<digest>` keyed by `AUTH_SECRET` (scrypt does not fit 10 ms). Seeded from secret `ADMIN_PASSWORD` when empty or when an old scrypt hash is found. 5 failures / 15 min / IP. Cookie `aayam_admin`, 12 h. The only read of `password_hash` is in `edge/admin.ts` |
| `POST /api/admin/sheets` | Checks the public xlsx export starts with `PK`, stores the link, asks for a sync. Response has `syncing: true` |
| `POST /api/admin/notices` | New: stores the notice (`pushed_at` NULL, `expires_at` = now + `expiresInDays`, 1–30, default 3), asks for a sync; the job sends the push. `id` edits it (and resets `expires_at`); with `push: true` it clears `pushed_at` and asks for a sync, without it no sync runs. `id` + `delete: true` removes it. Rows past expiry by 30 days are pruned. Response has `queued` |
| `POST /api/admin/settings` | `{ examMode }` upserts `app_settings.exam_mode`. No sync: the bootstrap reads it live |
| `GET /api/push/public-key`, `POST /api/push/subscribe` | VAPID public key; upsert subscription |
| `POST /api/push/app-register`, `/app-unregister` | Phone app (`edge/appPush.ts`). Only `ExponentPushToken[…]`. A student sends course, batch, division; a faculty device must send its session (Bearer) and the name comes from the session, never the body. Plain upsert or delete |

`scheduled` (cron `*/5`) only dispatches the job. Cron and stale reads never set `refreshing`; only `/api/sync` and admin actions do (`server/src/edge/sync.ts`).

## Sync job (`server/src/job/pipeline.ts`)

1. Read `timetable_sync.revision` from D1. The working DB is `server/data/job.sqlite` (cached between Actions runs); hydrate it from the D1 archive only when the cached revision or database id differs.
2. Resolve sheet sources from D1 `timetable_sheet_links` only (`resolveSheetSources` → `sheetSources` maps rows onto `COHORT_TEMPLATES`). There is no env or code fallback: a batch with no valid row is logged and skipped (it keeps its last synced lectures); no rows at all skips the sync. A program whose stored lectures came from another workbook was repointed by an admin: sync it with `replaceProgram`. The bootstrap's `sheets` links take the D1 id over the lectures' `spreadsheetId`, and the top-level `spreadsheetUrl` is the D1 link for 2025-29 (else the first), so the header link moves as soon as the job runs after an admin save.
3. `runSync` (`server/src/services/syncScheduler.ts`, the only place that turns a download into a snapshot):
   1. Download the public xlsx (`googleSheetsService.ts`), `parseTimetableSource`, `normalizeWorkbook`.
   2. `persistCancelledRemovals` so a removal already recorded stays cancelled.
   3. A tab that failed to parse and produced no lectures keeps its last good copy.
   4. Same content hash: touch sync state, emit nothing.
   5. Bootstrapped and the new dates share nothing with the saved dates: `replacesPublishedWeek` replaces the snapshot, saves the outgoing week, clears the live change log, emits no events.
   6. Otherwise `compareSnapshots`, save, `recordChanges`.
   7. Download or parse failure: keep the last snapshot, set `lastError`. The `sync` snapshot is still published, so the client shows the error and the old grid.
4. `publishToD1` (`server/src/job/archive.ts`): only changed rows (tracked in `published_rows`), deletes then upserts then the sync row with `revision + 1`. Safe to repeat after a crash.
5. Render and write snapshots, send queued pushes (`pushes.ts`: `pushed_at` set before sending, 404/410 subscriptions deleted, notices saved (`COALESCE(updated_at, created_at)`) over 24 h ago or past `expires_at` are marked without a push), then phone pushes (`appPushes.ts`, Expo push service): live changes with `detected_at > app_push_state.changes_after` of the site's alert types, matched by `deviceWantsChange` (students by cohort, faculty by `changeMatchesFaculty`), several per phone folded into one message; plus the notices `sendPendingPushes` claimed, to students only. The first run sets the cursor to now and sends nothing; a change found over 6 h late is skipped; `DeviceNotRegistered` tokens are deleted. Web-push failure does not stop phone pushes. Set `job_state.finished_at` (always).

Run it: `npm run sync` (needs `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_API_TOKEN`, `D1_DATABASE_ID`), or `npm run sync -- --local-auto` against `wrangler dev`'s local D1, `--local <file>`, `--watch <s>`, `--data-dir <dir>`. A run takes 3–6 s, mostly downloading and parsing.

## Cancellations

`changeDetectionService.ts`:

- Same slot key and same core: no event.
- A lecture that disappears while another non-break class remains on that tab and date becomes one cancelled event. It is not re-emitted later.
- If the whole day is gone, it is a removed event and drops off the grid. Replacing a whole day must not mark the old classes cancelled.
- `restoreRemoved.ts` writes that removed lecture back into the snapshot as cancelled. `persistCancelled.ts` rewrites the change row from `removed` to `cancelled`. Both run on sync and when the job renders a bootstrap.
- A faculty+room change on the same subject is a different session, not a move (`pairMoves`).

Change types the client may alert: `cancelled`, `restored`, `rescheduled`, `room_change`, `faculty_change`, `subject_change`, `details_changed`, `replaced`, `added`, `removed`, `reverted`, `tab_added`, `tab_removed`.

## Parser

`timetableParser.ts` reads the xlsx. A yellow fill on an empty subject cell is a lunch break. A red fill on a subject cell marks that lecture cancelled and keeps the subject. Other fills are ignored.

Weekday tabs are a grid. Column A labels the row (`classify`): time range, `Timing` header, faculty, classroom/room, status, reason, semester/batch/date meta. Cohort names are the header cells. A merged day-level value (OFF, or a holiday name) is inherited by later time slots. Faculty and room rows must not inherit that merge (`valueAt` with `allowTimeMerge`).

There is also a row-based reader for a tab that has subject/faculty/room columns instead of cohort columns. `server/test/parser.test.ts` uses `server/fixtures/cohort-week.xlsx`.

`timetableNormalizer.ts` assigns ids, slot keys, course fallback, and canonical faculty/room text. Slot key is tab, date, division, and time. Do not change the key shape without a migration story: it is how a lecture is the same lecture next sync.

## Faculty names

`shared/faculty.ts`:

- Split a cell on `&`, `,`, `/`, or `and`.
- `personMatch` ignores `(VF)` tags and full stops. It matches `Dr. Aarti`, `Dr. Aarti P`, and `Dr. Aarti Pardesi` as one person, because sheets spell names differently and `faculty_directory` may hold the full name. The first name must be written out, so `Prof. H` does not match `Prof. Harshal`. Later words must agree or be an initial, and two different titles never match.
- `listFacultyNames` shows one row per person and keeps the longer form.
- `lectureMatchesFaculty` is what the grid and `/api/calendar.ics?faculty=` both use.
- `changeMatchesFaculty` keeps an update when the lecture id is still theirs, or the previous/next faculty field matches. A room change often has no faculty on the event, so the id check matters.

Tests: `server/test/faculty.test.ts`.

## Calendar file

`shared/calendar.ts` `calendarFile`. Breaks are omitted. Full-day OFF collapses the same way as the grid. Faculty feeds pass `{ includeCohort: true }` so the summary is `Subject · Cohort`. Student titles stay the subject only. Cancelled events are `STATUS:CANCELLED`.

## Presenting a lecture

`presentLecture.ts` turns a stored row into `PublicLecture`: display status, highlight window (`HIGHLIGHT_HOURS`, default 72), previous values, and the public id. The client colours and badges from `displayStatus` and `kind` (`lecture`, `break`, `off`).

## Archive and weeks

`archiveRows.ts` maps the working DB to rows and back; `timetableArchive.ts` merges two archives. A non-overlapping saved week is a fresh baseline: its change rows leave the live log and stay on that week. The outgoing week is kept, up to 8 past weeks per course and batch, and the published week is stored too. The archive is internal: no route or snapshot exposes past weeks, and `BootstrapResponse` has no `savedWeeks`. Same-week removals stay cancelled across job runs and cache loss because the archive is in D1. `server/test/archive.test.ts`, `sync.test.ts`, `weeks.test.ts`, `job.test.ts` cover this.
