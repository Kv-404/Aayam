# Client

Vite + React + Tailwind. Entry `client/src/main.tsx` → `App.tsx` → `Dashboard.tsx`. Dev server proxies `/api` to port 8787 (`client/vite.config.ts`). Path alias `@` is `client/src`, `@shared` is `../shared`.

## Boot

`App.tsx` loads `GET /api/bootstrap` with React Query and refetches on `sync.intervalSeconds`. `useNow` ticks every 15s. Theme, class colours, and bold colours apply on `documentElement` from `client/src/lib/prefs.ts`.

A saved faculty sign-in opens that faculty's timetable when the address is `/` or `/?faculty=`, including a phone home-screen icon. The public home page stays for a visit with no faculty token. The icon is a standalone web app (`manifest.webmanifest`). An icon added before that file existed must be removed and added again, or the phone keeps the old empty store.

`Dashboard.tsx` owns setup, filters, week/day/updates, and the header. Do not split that state into a new store.

Setup shows when `readSetup()` is false or `hasChosenRole()` is false, or the saved cohort/faculty is no longer on the sheet.

1. Who are you? Student or Teacher (`Setup.tsx`).
2. Student: 6-digit PIN entered via `<CodeSlots />`, verified via `/api/auth/pin-verify` against Neon PostgreSQL `batch_access_codes`. Teacher: Google OAuth sign-in restricted to `@itm.edu` and `@isu.ac.in`.
3. Student: only the authenticated batch's cohorts (e.g., BTech 2025-29 lists its divisions). Teacher: Google sign-in. A coordinator opens on their cohorts. `can_see_all_faculty` opens on every class. Anyone else opens on their own name.
4. Theme, class colours, bold colours, and whether the Meet button opens or copies.

The header cohort menu for students lists cohorts restricted to their authenticated batch.

`saveSetup` writes `timetable-role`, and the cohort or faculty name, then `timetable-setup=1`. It does not clear the theme, colours, or Meet choice. Student logout in the settings menu clears `timetable-student-batch`, `timetable-unlocked-batches`, `timetable-cohort`, `timetable-role`, `timetable-setup`, and cleans the URL to `/`.

## localStorage

| Key | Values |
| --- | --- |
| `timetable-setup` | `"1"` after setup |
| `timetable-role` | `student` or `faculty`. Absent means ask again |
| `timetable-student-batch` | JSON `{ course, batch }` for verified student PIN |
| `timetable-unlocked-batches` | JSON array of unlocked `course:batch` pairs |
| `timetable-can-see-all-faculty` | `"1"` or `"0"` for faculty permissions |
| `timetable-faculty-email` | Signed-in faculty email. Used to recognise a coordinator |
| `timetable-faculty-lens` | JSON view: `self`, `all`, `cohorts`, one `cohort`, or one `faculty` |
| `timetable-cohort` | division string, year included (`Sam Altman 2025`) |
| `timetable-faculty` | display name from `listFacultyNames` |
| `timetable-faculty-session` | Signed faculty session token. Kept so a home-screen shortcut stays signed in when the cookie is dropped. A second copy is in the `timetable_faculty_device` cookie and in IndexedDB. Cleared on faculty sign-out |
| `timetable-theme` | theme id. Old value `calendar` migrates to `light` |
| `timetable-colors` | `"0"` off, anything else on |
| `timetable-bold` | `"1"` on. Default off |
| `timetable-meet` | `copy` or anything else, including absent, which means open. Do not clear it when saving setup |
| `timetable-notify` | `"1"` after opt-in. Removed when the settings switch turns alerts off |
| `timetable-notified-ids` | JSON array of change ids already alerted |
| `timetable-search-history` | JSON array, newest first, at most 8 searches |

`timetable-layout` is removed on theme apply. Do not reintroduce it.

## Who sees what

Student scope is one division, plus the default course and semester from `defaultFilters`. A regular teacher sees `lectureMatchesFaculty` across every division, `kind !== "break"`. A coordinator (`shared/coordinators.ts`) sees every lecture in the cohorts they own, and can open any faculty member's lectures. `can_see_all_faculty` sees every class, every cohort, and every faculty. Their bootstrap is unscoped (`scope.all`) and the grid filters on the client. Course and semester filters are hidden. A cohort filter is optional. `showDivision` is true for a faculty schedule and for more than one cohort: the card foot shows the cohort and the room. One cohort shows the faculty name and the room, same as a student. Phone cards stay one line.

`compactRoom` turns `Classroom - N`, `Classroom No. - N`, and `Room N` into `Cr N`. A `meet.google.com` room is a Meet button (`LectureRoom` in `MeetLink.tsx`), not a text line. The setting `timetable-meet` chooses open (new tab) or copy. The full URL stays on the tooltip. The Now line uses the same control so it does not print the raw URL.

Week grid: `WeeklyView.tsx`. Desktop is a time × date table. Phone (`sm` and below) is a day-grouped list, not stacked `TodayView` cards. Day view: `TodayView.tsx`. Updates: `RecentChanges.tsx`.

Now/next line is one truncated line in `HeaderStatus` in `Dashboard.tsx`, beside the cohort on a wide screen and on its own line on a phone. Faculty includes the cohort. The week grid uses the window width.

Empty faculty on OFF and breaks means those rows do not appear on a faculty timetable. Lunch is not their lecture.

## Lecture cards

- Class name comes from `useColors` / `calendarTone.ts`. `toneFor` returns graphite only for OFF.
- Live lecture: `is-now`, a Now mark, and a glow. `slotPhase` in `client/src/lib/view.ts`.
- Cancelled, and not OFF: subject colour, strikethrough, Cancelled label. No solid danger chip.
- Full-day OFF: phone week is one red line, `Monday Off` or `Saturday Off`, with no per-slot list. Desktop week says Off in red on each row, weekday and date in `text-danger`. `TodayView` hides the clock when the id ends with `-off`.
- `collapseFullOffDays` folds a day that is entirely OFF into one row. Do not paint that as a cancelled strikethrough of every slot.
- Bold colours: `documentElement.dataset.bold`. On is solid `var(--cal)` / `var(--cal-ink)`. Off is the soft tint. The switch is `bold-toggle`, shown only when class colours are on.
- Colour changes fade. `index.css` registers `--cal`, `--cal-ink`, `--tone-*`, `--ink-*` and transitions them over 240ms.

## Header

Sticky and left-aligned. There is no "Timetable" title and no max-width column. The cohort or faculty menu is on the left. Now or Next is one truncated line beside it on a wide screen (word, subject, time, room). On a phone that line is full width under the cohort, not squeezed between the icons. Tools on the right are search, add week, sheet link, refresh, and settings.

Search is an icon button (`search-button`). It slides open a panel from that button: the field (aria-label "Search the timetable"), past searches, and `TimetableFilters`. History is `timetable-search-history` (most recent 8). Each entry can be removed. Clear all empties the list. The filters button is gone. The panel's Clear still resets filters.

On a wide screen, the top bar is a single straight line: logo and cohort or faculty menu on the left, Now or Next pill in the center, and the Day/Week/Updates segment alongside the actions toolbar on the right. In Day view, a sleek second row displays the weekday `RubberSegment`. On a phone, Day/Week/Updates sits in the fixed bottom bar (along with the day selector when in Day view), and the bell stays in the header. The current weekday is bold with an indicator dot. When `savedWeeks` is present, a week menu lists the live sheet and each backed-up week. The tabs root stays, without a tabs list.

Add week uses `client/src/lib/calendar.ts`. Student feed is `/api/calendar.ics?division=`. Faculty feed is `?faculty=`. Outlook, Google, Apple, Proton, and a downloaded `.ics`. Proton copies the feed URL and opens Proton Calendar.

Notifications: `useChangeNotifications` + `notifyChanges.ts`, and `useLectureReminders` + `shared/reminders.ts`. `NotifyControl` shows `BellToggle` only while opted out. The click writes `timetable-notify`, plays the on face, then the header button unmounts. `Notification.requestPermission` runs from that click. Do not ask on load. Turning off is the Notifications switch in the appearance menu (`notify-toggle`), which removes the key. The browser permission stays as it is. The first opt-in baselines existing changes and alerts nothing. Later change alerts are the types listed in `notifyChanges.ts`. Unknown types are ignored.

Lecture reminders run only while opted in, for today's lectures in the current scope (one cohort, or every lecture of that faculty). A lecture is told three times, once each: 10 minutes before, 5 minutes before, and when it has just started (the first two minutes). Opening the page inside a window sends only the tighter one. Sent keys live in `sessionStorage` (`timetable-reminded`) so a refresh does not repeat them. The in-app `notify-notice` prefers a reminder over a change notice. System alerts go through `/sw.js`, then a page `Notification`, then that notice. iPhone system alerts need the site on the Home Screen. Faculty alerts are changes whose lecture id is still theirs, or whose previous/next faculty matches (`changeMatchesFaculty`). A faculty reminder names the cohort. A student reminder does not name the faculty.

The theme step is roomy cards (swatch, name, blurb) in 2, 3, or 4 columns, and the setup page widens to `max-w-4xl` on that step only. Back and Save stay on screen. The Meet choice there is the full control. The appearance menu uses the same cards in two columns.

## Files worth opening

| Change | File |
| --- | --- |
| Setup steps | `client/src/components/Setup.tsx` |
| Filtering, header, now line | `client/src/components/Dashboard.tsx` |
| Week grid and phone list | `client/src/components/WeeklyView.tsx` |
| One day | `client/src/components/TodayView.tsx` |
| Filter controls | `client/src/components/TimetableFilters.tsx` |
| Card foot on the day view | `client/src/components/ClassMeta.tsx` |
| Meet button and open or copy setting | `client/src/components/MeetLink.tsx` |
| Prefs | `client/src/lib/prefs.ts` |
| Filter logic | `client/src/lib/view.ts` |
| Subject colour | `client/src/lib/calendarTone.ts`, `client/src/lib/palettes.ts`, `client/src/lib/colorState.tsx` |
| Clock and room text | `client/src/lib/time.ts` |
| Day, Week, Updates | `client/src/components/RubberSegment.tsx` |
| Notify bell | `client/src/components/BellToggle.tsx` |
| Lecture start reminders | `client/src/hooks/useLectureReminders.ts`, `shared/reminders.ts` |

Cohort display names drop a trailing year in `shared/cohort.ts` (`Sam Altman 2025` → `Sam Altman`). Stored division strings keep the year.
