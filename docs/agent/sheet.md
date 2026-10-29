# Sheet

The live sheet is public and read-only. Id fallback in `server/src/config.ts`: `1Fzv6FWD0EAWWZFcByFkEYTyIu3eMS4tM3BEkW2Gl1j8`. Title shape: `BTech Cohort Planning weekly | 2025-29 - 26th Oct to 31st Oct 2026`. Export URL is `https://docs.google.com/spreadsheets/d/{id}/export?format=xlsx`. A pasted `docs.google.com/spreadsheets` URL in the product is how a human switches the weekly source; the server only accepts an id.

Cohorts are columns, not tabs. Current columns are Sam Altman 2025, Jeff Bezos 2025, Larry Page 2025, and Demis Hassabis 2025. Do not hardcode that list. The client reads `lecture.division`.

Each weekday is a tab: Monday through Saturday. Dates are `DD/MM/YYYY` (`DATE_ORDER=DMY`). Timezone for "today" and the clock is `Asia/Kolkata`.

## Grid

Under the Timing header, each time range is a block:

- The time row holds the subject for each cohort column. A merge across the day repeats that text on every slot it covers, including lunch.
- The next labelled row is faculty.
- The next is classroom.
- Status and reason rows are optional.

An empty subject is a free period. It is not a cancellation.

Lunch and other breaks are their own rows. They are not lectures. Faculty mode hides them.

## What is cancelled

Text only. The October 2026 sheet has no red fills and no tab colours used as status. Fills that do exist are orange, amber, yellow, and white. Monday and Saturday OFF cells are white.

These words cancel a slot: `OFF`, `cancelled`, `holiday` (matched by the parser, not by colour).

These do not:

- A holiday name merged down the day, such as Dussehra. That name is the subject of every slot in the merge, including lunch.
- A blank cell.
- A row that vanished because the whole day tab was replaced. That is a new day, not a set of cancellations.

`OFF` stays on the grid until the sheet text changes. The client renders a full OFF day as one off state, not as a stack of struck-through classes. See `docs/agent/client.md`.

## Week change

When someone publishes next week's sheet, its dates do not overlap this week's dates. Sync treats that as a new baseline: the old change log is dropped, nothing is marked cancelled, and the new grid is the starting point. Same-week edits still diff.

Deleting `server/data/timetable.sqlite` and restarting local dev also starts clean, but the blob still has the old week if `BLOB_READ_WRITE_TOKEN` is set. Overlap rules in `mergeArchives` then decide whether that history reattaches. See `docs/agent/server.md`.

## People

Faculty text is whatever the faculty row says, including `Mr. Lokesh (VF)` and joint cells with `&`. The faculty picker splits joint cells and keeps the longer name. Both people see that lecture.

Rooms look like `Classroom - 39` or `Room 201`. The client shows `Cr 39`.
