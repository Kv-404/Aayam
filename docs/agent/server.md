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
| `faculty_directory`, `admin_password`, `admin_sessions`, `rate_limits` | Worker | Worker |
| `mcp_oauth_clients`, `mcp_oauth_transactions`, `mcp_oauth_codes`, `mcp_oauth_refresh_tokens`, `mcp_oauth_revocations` (`migrations/0002_mcp_oauth.sql`) | Worker (`edge/oauthStore.ts`) | Worker |

Timestamps are ISO strings (`toISOString()`), compared as text. `rate_limits.reset_at` is epoch ms. The `mcp_oauth_*` tables store only SHA-256 hashes of codes, refresh tokens, transaction ids, and client secrets; every row has `expires_at` and expired rows are deleted in the same batch as OAuth writes.

## Snapshots (the read model)

Keys come only from `shared/scope.ts`: `scopeKey(scope, index)` turns a request into `all`, `none`, `b:<course>|<batch>`, `d:<division>`, or `f:<faculty>` (lowercased; faculty and division are resolved with `matchFaculty` / `matchChoice`). The job writes with the same function, so a request lands on the row the job wrote.

| Key | Body |
| --- | --- |
| `index` | `SnapshotIndex`: choices, faculties, batches, timezone |
| `sync` | `SyncInfo` without `refreshing` |
| `changes` | `{"changes":[...]}`, newest 200 |
| `boot:<scope>` | `BootstrapResponse` without `now`, `today`, `sync`, `notices` |
| `week:<monday>:<scope>` | `/api/week` body. Omitted when empty |
| `ics:<scope>` | ICS text, `d:` and `f:` only |

The job renders with `server/src/views.ts` (`buildBootstrap`, week and calendar views; golden output in `server/test/views.test.ts`) and writes only rows whose hash changed (`server/src/job/snapshots.ts`). An unchanged run writes about 3 rows.

## Worker routes (`server/src/edge/`)

| Route | Behaviour |
| --- | --- |
| `GET /api/bootstrap` | `?division=` (alias `cohort`), `?faculty=`, `?course=`, `?batch=`, `?all=1`. One D1 round trip. Adds `now`, `today` (in `index.timezone`), `sync.refreshing`, and `notices` (student scopes: course/batch match, 14 days, newest 5). ETag + 304, `Cache-Control: no-cache`. 503 + `Retry-After` before the first job run. A read older than 12 min asks for a sync in the background |
| `POST /api/sync` | Records a user request, dispatches the job (at most once a minute), returns the current bootstrap with `refreshing: true` |
| `GET /api/week?monday=` | Stored body, scoped like bootstrap. Missing → empty lists |
| `GET /api/calendar.ics` | `?division=` or `?faculty=`, `download=1` sets Content-Disposition |
| `GET /api/changes`, `/api/health`, `/api/db-status` | From snapshots; D1 ping |
| `/api/auth/config`, `/me`, `/google`, `/logout` | Google ID token via tokeninfo, allowed domains, `faculty_directory` (case-insensitive, active). HMAC session with `AUTH_SECRET`, cookie `timetable_faculty_session`, or `Authorization: Bearer`. 8 tries / 10 min / IP |
| `/api/admin/session`, `/login`, `/logout`, `/password` | Hash `hmac-sha256:<salt>:<digest>` keyed by `AUTH_SECRET` (scrypt does not fit 10 ms). Seeded from secret `ADMIN_PASSWORD` when empty or when an old scrypt hash is found. 5 failures / 15 min / IP. Cookie `aayam_admin`, 12 h. The only read of `password_hash` is in `edge/admin.ts` |
| `POST /api/admin/sheets` | Checks the public xlsx export starts with `PK`, stores the link, asks for a sync. Response has `syncing: true` |
| `POST /api/admin/notices` | Stores the notice (`pushed_at` NULL), asks for a sync; the job sends the push. Response has `queued: true` |
| `GET /api/push/public-key`, `POST /api/push/subscribe` | VAPID public key; upsert subscription |
| `GET /.well-known/oauth-protected-resource` (also `/mcp`, `/api/mcp` suffixes) | RFC 9728 metadata. `resource` is `<origin>/mcp`; origin is `MCP_PUBLIC_URL` or the request's. CORS `*` |
| `GET /.well-known/oauth-authorization-server`, `/openid-configuration` | RFC 8414 metadata: CIMD (`client_id_metadata_document_supported`), DCR, PKCE `S256` only, `none`/`client_secret_post`/`client_secret_basic`. Unknown `/.well-known/*` falls through to assets |
| `POST /oauth/register` | Dynamic client registration (`mcp_<random>`, 30 days; HTTPS or loopback redirect URIs). 12 / 10 min / IP |
| `GET /oauth/authorize` → `GET /oauth/callback` → `POST /oauth/consent` | Client by id or by `https://` client ID metadata document (fetched, cached 10 min; private/loopback hosts refused). PKCE S256 required, RFC 8707 `resource` must be this server's `/mcp` or `/api/mcp`. A valid `timetable_faculty_session` **cookie** skips Google and goes straight to consent; else, with `GOOGLE_CLIENT_SECRET`, Google code flow (PKCE + nonce, redirect `<origin>/oauth/callback`); else a "sign in on Aayam first" page. Consent is CSRF-protected, CSP `frame-ancestors 'none'`. Active `faculty_directory` row required |
| `POST /oauth/token` | `authorization_code` (single-use, 90 s, `DELETE … RETURNING`) and rotating `refresh_token` (30 days; replay revokes the family). Access token: 1 h stateless HMAC (key derived from `AUTH_SECRET`, `typ: mcp_at`; a web session never verifies). 60 / 5 min / IP |
| `POST /oauth/revoke` | Refresh token revokes its family; access token revoked by `jti` until expiry |
| `POST /mcp`, `POST /api/mcp` | Stateless Streamable HTTP, JSON responses only (no SSE, no sessions). Bearer token → audience, revocation, and live `faculty_directory` row checked in one D1 read; scopes cut to what the account may have now. Origin allow-list (self, claude.ai, chatgpt.com, `CLIENT_ORIGIN`, localhost). `GET`/`DELETE` → 405 |

### MCP tools (`server/src/edge/mcp.ts`)

Scopes: `timetable:read`, `faculty:self` for everyone; `coordinator:read` for coordinators (`shared/coordinators.ts`) and all-access; `faculty:all`, `faculty:directory` for `can_see_all_faculty`. Tools: `get_my_profile`, `get_my_schedule`, `get_cohort_timetable`, `list_cohorts_and_weeks`, `get_timetable_changes`, `find_free_rooms_or_slots`, `get_faculty_schedule`, `list_faculty_directory`, `get_calendar_subscription_info`, `refresh_timetable_sync` (records a user sync request and dispatches the job, like `POST /api/sync`). Each tool reads one scoped `boot:<scope>` / `week:<monday>:<scope>` row (resolved with `scopeKey`), `changes`, or `index`. Nothing parses `boot:all`: the two tools that need every cohort ask D1 for just the fields with `json_extract` / `json_each`. `server/test/edgeBench.test.ts` holds the heaviest tool under 3 ms CPU. Tests: `mcpServer.test.ts`, `mcpOAuth.test.ts`.

`scheduled` (cron `*/5`) only dispatches the job. Cron and stale reads never set `refreshing`; only `/api/sync` and admin actions do (`server/src/edge/sync.ts`).

## Sync job (`server/src/job/pipeline.ts`)

1. Read `timetable_sync.revision` from D1. The working DB is `server/data/job.sqlite` (cached between Actions runs); hydrate it from the D1 archive only when the cached revision or database id differs.
2. Resolve sheet sources: D1 `timetable_sheet_links` first, then env, then the fallbacks in `server/src/config.ts`. A program whose stored lectures came from another workbook was repointed by an admin: sync it with `replaceProgram`.
3. `runSync` (`server/src/services/syncScheduler.ts`, the only place that turns a download into a snapshot):
   1. Download the public xlsx (`googleSheetsService.ts`), `parseTimetableSource`, `normalizeWorkbook`.
   2. `persistCancelledRemovals` so a removal already recorded stays cancelled.
   3. A tab that failed to parse and produced no lectures keeps its last good copy.
   4. Same content hash: touch sync state, emit nothing.
   5. Bootstrapped and the new dates share nothing with the saved dates: `replacesPublishedWeek` replaces the snapshot, saves the outgoing week, clears the live change log, emits no events.
   6. Otherwise `compareSnapshots`, save, `recordChanges`.
   7. Download or parse failure: keep the last snapshot, set `lastError`. The `sync` snapshot is still published, so the client shows the error and the old grid.
4. `publishToD1` (`server/src/job/archive.ts`): only changed rows (tracked in `published_rows`), deletes then upserts then the sync row with `revision + 1`. Safe to repeat after a crash.
5. Render and write snapshots, send queued pushes (`pushes.ts`: `pushed_at` set before sending, 404/410 subscriptions deleted, notices older than 24 h are marked without a push), set `job_state.finished_at` (always).

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

`archiveRows.ts` maps the working DB to rows and back; `timetableArchive.ts` merges two archives. A non-overlapping saved week is a fresh baseline: its change rows leave the live log and stay on that week. The outgoing week is kept, up to 8 past weeks per course and batch, and the published week is stored too. `views.ts` collapses overlapping copies of one week (`preferOneWeekCopies`). The client hides the published week from `savedWeeks`. Same-week removals stay cancelled across job runs and cache loss because the archive is in D1. `server/test/archive.test.ts`, `sync.test.ts`, `weeks.test.ts`, `job.test.ts` cover this.
