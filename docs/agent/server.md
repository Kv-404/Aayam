# Server and shared model

Express API in `server/src`. Local entry `server/src/index.ts`. Vercel entry `server/src/vercel.ts`. Tests are `server/test/*.test.ts`, run with `npm test`. There is no client test suite.

## Request path

`createApp` in `server/src/app.ts`.

| Route | Behaviour |
| --- | --- |
| `GET /api/bootstrap` | Sync if the last success is older than the interval, then the public payload. Accepts optional `?division=`, `?faculty=`, `?course=`, `?batch=` to scope lectures and changes |
| `POST /api/sync` | Sync now, return the same payload |
| `GET /api/calendar.ics` | `?division=` one cohort, or `?faculty=` every matching lecture. Faculty events put the cohort in `SUMMARY`. `download=1` sets Content-Disposition |
| `GET /api/changes` | Recent change rows |
| `GET /api/health` | 200 after a successful sync, else 503 |
| `POST /api/auth/pin-verify` | Verify 6-digit student batch access PIN against Neon PostgreSQL `batch_access_codes` |
| `POST /api/auth/google` | Verify Google ID token, restrict to allowed domains (`@itm.edu`, `@isu.ac.in`), match `faculty_directory` in Neon PostgreSQL, issue HttpOnly session cookie and return the same token for the client to keep |
| `GET /api/auth/me` | Current authenticated faculty session. Accepts the cookie or `Authorization: Bearer` |
| `POST /api/auth/logout` | Clear faculty session cookie |
| `GET /api/auth/config` | Returns Google OAuth client ID |

`buildBootstrap` presents each stored lecture through `presentLecture`, restores removed lectures as cancelled, and sorts by date, time, division, subject. `BootstrapResponse` is `shared/types.ts`. The client must not depend on fields that are not on that type.

## Sync

`server/src/services/syncScheduler.ts` is the only place that turns a download into a snapshot.

1. `hydrateArchive` if this process has an empty database and `DATABASE_URL` is set.
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

## Archive

`durableState.ts` reads and writes state in Neon PostgreSQL (`timetable_archive` table). `timetableArchive.ts` merges two archives. A non-overlapping saved week is replaced; its change log is not reattached. The outgoing week is kept in `week_backups` and on `BootstrapResponse.savedWeeks`, up to 8 weeks per course and batch, so the client can still open it. Same-week removals stay cancelled. `server/test/archive.test.ts` and `sync.test.ts` cover this. Extend those tests when the rule changes.

SQLite is `server/src/db.ts`. Local file defaults to `server/data/timetable.sqlite` (gitignored). Vercel uses `/tmp/timetable.sqlite`, wiped on cold start, then refilled from Neon.

## Parser

`timetableParser.ts` reads the xlsx. A yellow fill on an empty subject cell is a lunch break. A red fill on a subject cell marks that lecture cancelled and keeps the subject. Other fills are ignored.

Weekday tabs are a grid. Column A labels the row (`classify`): time range, `Timing` header, faculty, classroom/room, status, reason, semester/batch/date meta. Cohort names are the header cells. A merged day-level value (OFF, or a holiday name) is inherited by later time slots. Faculty and room rows must not inherit that merge (`valueAt` with `allowTimeMerge`).

There is also a row-based reader for a tab that has subject/faculty/room columns instead of cohort columns. `server/test/parser.test.ts` uses `server/fixtures/cohort-week.xlsx`.

`timetableNormalizer.ts` assigns ids, slot keys, course fallback, and canonical faculty/room text. Slot key is tab, date, division, and time. Do not change the key shape without a migration story: it is how a lecture is the same lecture next sync.

## Faculty names

`shared/faculty.ts`:

- Split a cell on `&`, `,`, `/`, or `and`.
- `personMatch` treats a trailing initial as the same person (`Dr. Aarti P` and `Dr. Aarti`). A shorter name must contain a space, so `Prof. H` does not match `Prof. Harshal`.
- `listFacultyNames` shows one row per person and keeps the longer form.
- `lectureMatchesFaculty` is what the grid and `/api/calendar.ics?faculty=` both use.
- `changeMatchesFaculty` keeps an update when the lecture id is still theirs, or the previous/next faculty field matches. A room change often has no faculty on the event, so the id check matters.

Tests: `server/test/faculty.test.ts`.

## Calendar file

`shared/calendar.ts` `calendarFile`. Breaks are omitted. Full-day OFF collapses the same way as the grid. Faculty feeds pass `{ includeCohort: true }` so the summary is `Subject · Cohort`. Student titles stay the subject only. Cancelled events are `STATUS:CANCELLED`.

## Presenting a lecture

`presentLecture.ts` turns a stored row into `PublicLecture`: display status, highlight window (`HIGHLIGHT_HOURS`, default 72), previous values, and the public id. The client colours and badges from `displayStatus` and `kind` (`lecture`, `break`, `off`).
