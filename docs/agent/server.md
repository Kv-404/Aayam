# Server and shared model

Express API in `server/src`. Local entry `server/src/index.ts`. Vercel entry `server/src/vercel.ts`. Tests are `server/test/*.test.ts`, run with `npm test`. There is no client test suite.

## Request path

`createApp` in `server/src/app.ts`.

| Route | Behaviour |
| --- | --- |
| `GET /api/bootstrap` | The public payload. On Vercel, a sheet older than the interval syncs in the background unless there is no saved copy to show. `?all=1` or `?faculty=` covers every sheet. Accepts optional `?division=`, `?faculty=`, `?course=`, `?batch=` to scope lectures and changes |
| `POST /api/sync` | Sync now, return the same payload |
| `GET /api/calendar.ics` | `?division=` one cohort, or `?faculty=` every matching lecture. Faculty events put the cohort in `SUMMARY`. `download=1` sets Content-Disposition |
| `GET /api/changes` | Recent change rows |
| `GET /api/health` | 200 after a successful sync, else 503 |
| `POST /api/auth/pin-verify` | Verify 6-digit student batch access PIN against Supabase Postgres `batch_access_codes` |
| `POST /api/auth/google` | Verify Google ID token, restrict to allowed domains (`@itm.edu`, `@isu.ac.in`), match `faculty_directory` in Supabase Postgres, issue HttpOnly session cookie and return the same token for the client to keep |
| `GET /api/auth/me` | Current authenticated faculty session. Accepts the cookie or `Authorization: Bearer` |
| `POST /api/auth/logout` | Clear faculty session cookie |
| `GET /api/auth/config` | Returns Google OAuth client ID |
| `POST /api/admin/login` | Check the admin password. The only read of `admin_password.password_hash` is `readAdminPasswordHash`. The response never includes the hash. Session cookie `aayam_admin` is HttpOnly |
| `POST /api/admin/sheets` | Signed-in admin replaces one batch's spreadsheet id in `timetable_sheet_links`, then syncs that sheet. A sheet that cannot be read is not kept |
| `POST /api/admin/notices` | Signed-in admin stores a student notice and sends a web push to matching subscriptions |
| `GET /api/push/public-key` | Public half of the VAPID key. The private half stays in `push_vapid` |
| `GET /.well-known/oauth-protected-resource` | RFC 9728 metadata for the `/mcp` resource server |
| `GET /.well-known/oauth-authorization-server` | RFC 8414 metadata advertising CIMD (`client_id_metadata_document_supported`), DCR, and PKCE `S256` |
| `POST /oauth/register` | Dynamic Client Registration (rate-limited, stored in Redis) |
| `GET /oauth/authorize` → `/oauth/callback` → `POST /oauth/consent` | OAuth 2.1 authorization code + PKCE `S256` + Google Workspace sign-in (`@itm.edu`, `@isu.ac.in`) + `faculty_directory` check + CSRF-protected consent page |
| `POST /oauth/token`, `POST /oauth/revoke` | Authorization code & rotating refresh token exchange (`RFC 8707` resource binding) + token revocation |
| `POST /mcp`, `POST /api/mcp` | Stateless Streamable-HTTP MCP server protected by `requireMcpAuth` with faculty/coordinator/`can_see_all_faculty` RBAC |

`buildBootstrap` presents each stored lecture through `presentLecture`, restores removed lectures as cancelled, and sorts by date, time, division, subject. `BootstrapResponse` is `shared/types.ts`. The client must not depend on fields that are not on that type.

## Sync

`server/src/services/syncScheduler.ts` is the only place that turns a download into a snapshot.

1. `hydrateArchive` if this process has an empty database and `DATABASE_URL` is set. That URL is the Supabase transaction pooler.
2. Download the public xlsx (`googleSheetsService.ts`).
3. `parseTimetableSource` then `normalizeWorkbook`.
4. `persistCancelledRemovals` so a removal already recorded stays cancelled in the snapshot.
5. If a tab failed to parse and produced no lectures, keep the last good copy of that tab.
6. Same content hash: touch sync state, publish the archive, emit nothing.
7. If bootstrapped and the new dates share nothing with the saved dates, `replacesPublishedWeek`: replace the snapshot, clear the change log, emit no events.
8. Otherwise `compareSnapshots`, save, `recordChanges`, publish the archive.
9. On download or parse failure, keep the last snapshot and set `lastError`. The client shows that error and the old grid.

One sync per database at a time (`inflight` weak map).

## Cancellations

`changeDetectionService.ts`:

- Same slot key and same core: no event.
- A lecture that disappears while another non-break class remains on that tab and date becomes one cancelled event. It is not re-emitted later.
- If the whole day is gone, it is a removed event and drops off the grid. Replacing a whole day must not mark the old classes cancelled.
- `restoreRemoved.ts` writes that removed lecture back into the snapshot as cancelled. `persistCancelled.ts` rewrites the change row from `removed` to `cancelled`. Both run on sync and on bootstrap.
- A faculty+room change on the same subject is a different session, not a move (`pairMoves`).

Change types the client may alert: `cancelled`, `restored`, `rescheduled`, `room_change`, `faculty_change`, `subject_change`, `details_changed`, `replaced`, `added`, `removed`, `reverted`, `tab_added`, `tab_removed`.

## Archive and Redis

`server/src/services/redis.ts` connects to Upstash Redis REST (`UPSTASH_REDIS_REST_URL`/`TOKEN` or `KV_REST_API_*`), standard Redis TCP (`REDIS_URL` via `ioredis`), or an in-memory fallback for local dev/tests. `durableState.ts` hydrates SQLite from gzipped Redis (`archive:live`) first, falling back to Supabase Postgres (`readNeonLiveRows` for live rows + week summaries; past weeks load lazily via `ensureWeeksHydrated` and cache under `archive:week:<id>`). `publishArchive` short-circuits via `archive:sig` in Redis so unchanged syncs do not query Supabase. `app.ts` also caches scoped responses (`/api/bootstrap`, `/api/week`, `/api/changes`, `/api/calendar.ics`) with `ETag` (`304 Not Modified`), coordinates sync cooldowns/locks in Redis, and `auth.ts` caches `faculty_directory` and `batch_access_codes` lookups plus distributed rate limits in Redis. `timetable_archive.archive` stays updated for older bundles. `server/test/archive.test.ts`, `sync.test.ts`, `weeks.test.ts`, `redisCache.test.ts`, `mcpOAuth.test.ts`, and `mcpServer.test.ts` cover this.

SQLite is `server/src/db.ts`. Local file defaults to `server/data/timetable.sqlite` (gitignored). Vercel uses `/tmp/timetable.sqlite`, wiped on cold start, then refilled from Supabase.

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
