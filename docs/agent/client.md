# Client

Vite + React + Tailwind. Entry `client/src/main.tsx` → `App.tsx` → `Dashboard.tsx`. Dev server proxies `/api` to port 8787 (`client/vite.config.ts`). Path alias `@` is `client/src`, `@shared` is `../shared`.

## Boot

`App.tsx` loads `GET /api/bootstrap` with React Query and refetches every `max(sync.intervalSeconds, 300)` seconds while the tab is visible (never while hidden), and on focus at most once a minute. While `sync.refreshing` is true it checks every 20 s for up to 3 minutes after the user taps Refresh, otherwise every 90 s. Do not add cache-busting params or `no-store`: the Worker answers 304 to the browser's ETag revalidation, and the free plan allows 100k API requests a day. Bootstrap carries the current published week only, and the app always shows that week. There is no past-week view; `Dashboard` keeps only the latest week of `data.lectures` (`splitByLatestWeek`). `useNow` ticks every 15s. Theme, class colours, and bold colours apply on `documentElement` from `client/src/lib/prefs.ts`.

A saved faculty sign-in opens that faculty's timetable when the address is `/` or `/?faculty=`, including a phone home-screen icon. The public home page stays for a visit with no faculty token. That page is a short gate: "I am", then Student or Faculty, with a small Admin link at the top right. A student then picks B.Tech or MCA, a batch such as 2025–29, a cohort, and a theme. Tapping the batch starts that batch’s sheet only. Faculty sign-in reads every sheet. A student request does not download the other batches. Faculty sign in with Google. The product pitch lives at `/pitch`. Admin sign-in, sheet links, and student notices live at `/admin`. Motion on the gate is a short fade between steps and is off when the user prefers reduced motion. The icon is a standalone web app (`manifest.webmanifest`). Install icons are PNG (`apple-touch-icon.png`, `icon-192.png`, `icon-512.png`) because a phone home screen ignores an SVG. An icon added before those files existed must be removed and added again, or the phone keeps the old empty icon.

`Dashboard.tsx` owns setup, filters, week/day/updates, and the header. A phone opens on Day. A wider screen opens on Week. Faculty open on Week. The day control stays in the header line that is already there. Do not split that state into a new store.

Setup shows when `readSetup()` is false or `hasChosenRole()` is false, or the saved cohort/faculty is no longer on the sheet.

1. Who are you? Student or Teacher (`Setup.tsx`).
2. Student: pick a batch, then a section. Teacher: Google OAuth sign-in restricted to `@itm.edu` and `@isu.ac.in`.
3. Student: only the authenticated batch's cohorts (e.g., BTech 2025-29 lists its divisions). Teacher: Google sign-in. A coordinator opens on their cohorts. `can_see_all_faculty` opens on every class. Anyone else opens on their own name.
4. Theme, class colours, bold colours, and whether the Meet button opens or copies.

The header cohort menu for students lists cohorts restricted to their authenticated batch.

`saveSetup` writes `timetable-role`, and the cohort or faculty name, then `timetable-setup=1`. It does not clear the theme, colours, or Meet choice. Student logout in the settings menu clears `timetable-student-batch`, `timetable-unlocked-batches` (legacy, still cleared), `timetable-cohort`, `timetable-role`, `timetable-setup`, and cleans the URL to `/`.

## Page transitions

`renderPage` in `App.tsx` names each screen (home, loading, timetable, privacy, terms, access-denied, not-found, unavailable). `AnimatePresence` fades between names and returns to the top of the page. Use opacity only here: a transform on the wrapper breaks the fixed bottom bar and sticky header. A scope change keeps the name `timetable`, so `Dashboard` keeps its state. Finishing setup fades in with `page-fade`.

## localStorage

| Key | Values |
| --- | --- |
| `timetable-setup` | `"1"` after setup |
| `timetable-role` | `student` or `faculty`. Absent means ask again |
| `timetable-student-batch` | JSON `{ course, batch }` for the batch the student picked |
| `timetable-push-synced` | Last day a push subscription and cohort were sent to `/api/push/subscribe`, so it is re-sent at most daily |
| `timetable-can-see-all-faculty` | `"1"` or `"0"` for faculty permissions |
| `timetable-faculty-email` | Signed-in faculty email. Used to recognise a coordinator |
| `timetable-faculty-lens` | JSON view: `self`, `all`, `cohorts`, one `batch` (`course` + `batch`), one `cohort`, or one `faculty` |
| `timetable-cohort` | division string, year included (`Sam Altman 2025`) |
| `timetable-faculty` | display name from `listFacultyNames` |
| `timetable-faculty-session` | Signed faculty session token. Kept so a home-screen shortcut stays signed in when the cookie is dropped. A second copy is in the `timetable_faculty_device` cookie and in IndexedDB. Cleared on faculty sign-out |
| `timetable-theme` | theme id. Old value `calendar` migrates to `light` |
| `timetable-colors` | `"0"` off, anything else on |
| `timetable-bold` | `"1"` on. Default off |
| `timetable-meet` | `copy` or anything else, including absent, which means open. Do not clear it when saving setup |
| `timetable-notify` | `"1"` after opt-in. Removed when the settings switch turns alerts off |
| `timetable-notify-hint` | `"1"` after the phone hint is closed or used |
| `timetable-exam-notice` | `"1"` after the AT/KT exam banner is closed. Reset to `"0"` once `examMode` is off, so the banner returns next exam time. The banner shows only while `examMode` is on; the Exam button is red then and plain otherwise |
| `timetable-app-prompt` | Time (ms) until which the phone "Get the Aayam app" hint (`app-prompt`) stays hidden. Download or Dismiss sets it 14 days ahead. The hint shows only in an Android phone browser (not standalone, not a webview), after setup, ahead of `notify-hint`. Link: `ANDROID_APP_URL` in `client/src/lib/appPrompt.ts` (GitHub Releases); no iOS link yet |
| `timetable-notified-ids` | JSON array of change ids already alerted |
| `timetable-search-history` | JSON array, newest first, at most 8 searches |

`timetable-layout` is removed on theme apply. Do not reintroduce it.

## Who sees what

Student scope is one division, plus the default course and semester from `defaultFilters`. A regular teacher sees `lectureMatchesFaculty` across every division, `kind !== "break"`. `FacultyScopeMenu` shows faculty and batches side by side, each scrolling on its own. A phone shows one at a time behind Faculty and Batches tabs. A wide view must hold `scope.all`: `Dashboard` restores it if anything narrows the download, and `App` keeps a teacher's scope on Back or Forward. A coordinator (`shared/coordinators.ts`) sees every lecture in the cohorts they own, and can open any faculty member's lectures. `can_see_all_faculty` sees every class, every batch (a "Whole batch" row heads each batch in the menu), every cohort, and every faculty. Their bootstrap is unscoped (`scope.all`) and the grid filters on the client. Course and semester filters are hidden. A cohort filter is optional. A teacher opens on Week, because one day can hide their other batches, and students open on Day. One person's schedule shows the batch on each card and a per-batch class count above the grid (`batch-summary`). `showDivision` is true for a faculty schedule and for more than one cohort: the card foot shows the cohort and the room. One cohort shows the faculty name and the room, same as a student. All classes and My cohorts (`showFaculty`) also name the teacher, on the same line as the cohort. A phone week card truncates that line. Phone cards stay one line.

`compactRoom` turns `Classroom - N`, `Classroom No. - N`, and `Room N` into `Cr N`. A `meet.google.com` room is a solid `Google Meet` pill with a video icon (`LectureRoom` in `MeetLink.tsx`, `.class-meet`), not a text line; it stays solid in bold colours and on the live card. The setting `timetable-meet` chooses open (new tab) or copy. The full URL stays on the tooltip. The Now line uses the same control so it does not print the raw URL.

Week grid: `WeeklyView.tsx`. From `sm` up it is a calendar time grid (`TimeGrid.tsx`): hour gutter, one column per date, lectures placed by start and end time, overlaps side by side (3 lanes, then a `+N` that widens the column), and a red now line on today. Cards use the same `classNameFor` card as the phone list. Back-to-back periods of one class (same cohort, subject, teacher, room, status, at most 15 min apart) stay two cards with their own name, joined by a strip that reads `10 min break`. Breaks are `BreakBand`: a dashed band with an icon and the time; the same break on neighbouring days is one band across them. The wide Day view uses the same grid with one column. All classes, Whole batch and My cohorts (`board.byCohort`, no cohort chip picked) are a cohort board instead: day tabs (`board-days`), then one column per cohort for that day (`cohortColumns`, sorted by course, batch, name), headed by the cohort and its batch. Cards drop the cohort, keep the teacher and room, and clamp the subject to two lines (`.wk-board`); hover shows the rest. The wide Day view of those scopes uses the same board. A phone shows only the picked day's list. Phone (`sm` and below) is a day-grouped list, not stacked `TodayView` cards. Day view: `TodayView.tsx`. Updates: `RecentChanges.tsx`.

Now/next line is one truncated line in `HeaderStatus` in `Dashboard.tsx`, beside the cohort on a wide screen and on its own line on a phone. Faculty includes the cohort. The week grid uses the window width.

Empty faculty on OFF and breaks means those rows do not appear on a faculty timetable. Lunch is not their lecture.

## Lecture cards

- Class name comes from `useColors` / `calendarTone.ts`. `toneFor` returns graphite only for OFF.
- Live lecture: `is-now`, a Now mark, and a glow. All classes shows none of this unless one cohort is filtered, because many run at once. The same rule turns off its lecture reminders and the Now or Next pill, which is just the clock there. Change alerts still run. `slotPhase` in `client/src/lib/view.ts`.
- Cancelled, and not OFF: subject colour, strikethrough, Cancelled label. No solid danger chip.
- Full-day OFF: phone week is one red line, `Monday Off` or `Saturday Off`, with no per-slot list. Desktop week says Off in red on each row, weekday and date in `text-danger`. `TodayView` hides the clock when the id ends with `-off`.
- `collapseFullOffDays` folds a day that is entirely OFF into one row. It runs before the filters, so a filter that leaves one OFF slot cannot make a day look off. Use `isFoldedOff` to recognise that row. Do not paint that as a cancelled strikethrough of every slot.
- Bold colours: `documentElement.dataset.bold`. On is solid `var(--cal)` / `var(--cal-ink)`. Off is the soft tint. The switch is `bold-toggle`, shown only when class colours are on.
- Colour changes fade. `index.css` registers `--cal`, `--cal-ink`, `--tone-*`, `--ink-*` and transitions them over 240ms.

## Header

Sticky and left-aligned. There is no "Timetable" title and no max-width column. The cohort or faculty menu is on the left. Now or Next is one truncated line beside it on a wide screen (word, subject, time, room). On a phone that line is full width under the cohort, not squeezed between the icons. Tools on the right are search, add week, sheet link, refresh, and settings. The sheet link is the picked cohort's or batch's workbook (`sheetUrlFor`, `board.sheet`); a batch with no link hides it rather than opening another batch's sheet.

Open menus blur the page through `useMenuBackdrop` (`lib/menuBackdrop.ts`) and one backdrop in `Dashboard.tsx`, under the header. The search panel lifts the blur once a search or filter is active, so results stay readable.

Search is an icon button (`search-button`). It slides open a panel from that button: the field (aria-label "Search the timetable"), past searches, and `TimetableFilters`. History is `timetable-search-history` (most recent 8). Each entry can be removed. Clear all empties the list. The filters button is gone. The panel's Clear still resets filters.

At `xl` and wider, the top bar is a single straight line: logo and cohort or faculty menu on the left, Now or Next pill in the center (faculty from `2xl`, their menu is wider), and the Day/Week/Updates segment alongside the actions toolbar on the right. From `sm` to `xl` the segment, bell, and Now or Next pill drop to a second row. In Day view, a sleek second row displays the weekday `RubberSegment`. On a phone, Day/Week/Updates sits in the fixed bottom bar (along with the day selector when in Day view), and notifications are the Settings switch plus a small dismissible hint above the bar (`notify-hint`). The hint stays gone once closed (`timetable-notify-hint`). Faculty sign-out, Refresh, and Open sheet are in the settings menu on a phone, which leaves the cohort name room. On a screen under 500px tall (`short:`, a phone in landscape) the header scrolls away, and the day selector and the notify hint hide. Fields are 16px on a phone so iPhone Safari does not zoom in. The current weekday is bold with an indicator dot. There is no week picker in the header or the settings menu. Updates always show `data.changes`. The tabs root stays, without a tabs list.

Add week uses `client/src/lib/calendar.ts`. Student feed is `/api/calendar.ics?division=`. Faculty feed is `?faculty=`. Outlook, Google, Apple, Proton, and a downloaded `.ics`. Proton copies the feed URL and opens Proton Calendar.

Notifications: `useChangeNotifications` + `notifyChanges.ts`, and `useLectureReminders` + `shared/reminders.ts`. Opt-in is the Notifications switch in the appearance menu (`notify-toggle`), plus a dismissible "Turn on" hint on phones (`notify-hint`, closed state in `timetable-notify-hint`) while opted out. Either click writes `timetable-notify` and runs `Notification.requestPermission` from that click. Do not ask on load. Turning the switch off removes the key. The browser permission stays as it is. The first opt-in baselines existing changes and alerts nothing. Later change alerts are the types listed in `notifyChanges.ts`. Unknown types are ignored.

Lecture reminders run only while opted in, for today's lectures in the current scope (one cohort, or every lecture of that faculty). A lecture is told three times, once each: 10 minutes before, 5 minutes before, and when it has just started (the first two minutes). Opening the page inside a window sends only the tighter one. Sent keys live in `sessionStorage` (`timetable-reminded`) so a refresh does not repeat them. The in-app `notify-notice` prefers a reminder over a change notice. System alerts go through `/sw.js`, then a page `Notification`, then that notice. iPhone system alerts need the site on the Home Screen. Faculty alerts are changes whose lecture id is still theirs, or whose previous/next faculty matches (`changeMatchesFaculty`). A faculty reminder names the cohort. A student reminder does not name the faculty.

The theme step is roomy cards (swatch, name, blurb) in 2, 3, or 4 columns, and the setup page widens to `max-w-4xl` on that step only. Back and Save stay on screen. The Meet choice there is the full control. The appearance menu uses the same cards in two columns.

## Files worth opening

| Change | File |
| --- | --- |
| Public gate | `client/src/components/HomePage.tsx` |
| Product pitch at `/pitch` | `client/src/components/HomePitch.tsx`, `client/src/components/PitchPage.tsx` |
| Admin sheet links, notices (edit, push again, delete, expiry), exam toggle | `client/src/components/AdminPage.tsx` |
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
| Notification opt-in | `client/src/hooks/useNotifications.ts`, `client/src/components/Dashboard.tsx` (`notify-toggle`, `notify-hint`) |
| Lecture start reminders | `client/src/hooks/useLectureReminders.ts`, `shared/reminders.ts` |

Cohort display names drop a trailing year in `shared/cohort.ts` (`Sam Altman 2025` → `Sam Altman`). Stored division strings keep the year.

## Phone app sign-in (`/app-auth`)

`AppAuthPage.tsx` is faculty sign-in for the Expo app in `mobile/`. The app opens `/app-auth?state=<random>` in the system browser. After Google sign-in the page calls `/api/auth/google` with `credentials: "omit"` (the browser is not signed in), then goes to the fixed `aayam://auth#state=…&token=…`. The redirect is hard-coded so the page cannot send a token anywhere else; the app drops a reply whose `state` does not match. `syncUrl` in `App.tsx` keeps the query on this route.

## Phone app (`mobile/`)

Expo, its own `package.json` (not a workspace). The app's UI **is the site**: `App.tsx` loads `https://aayam.kv404.dev` in a `react-native-webview`, so every web deploy reaches the phone with no new build. Do not build native screens again. Only the site's host opens inside the app; other links (Meet, exam site, calendars) go to the phone's apps. Android back goes back in the page first.

Bridge (`mobile/src/bridge.ts` ↔ `client/src/lib/nativeApp.ts`): a script injected before the page loads wraps `localStorage` and posts the setup, role, cohort, batch, faculty, look and faculty-session keys to the phone, which copies them into AsyncStorage/SecureStore under the same names. That drives push registration, reminders and widgets. The page asks the phone through `window.ReactNativeWebView.postMessage({ type: "signin" | "notify" | "notify-state", id })`; the reply comes back as a `aayam-native` window event with the same `id`. In the app, `FacultyLoginModal` shows a plain "Sign in with Google" button that runs the browser sign-in below (Google blocks sign-in in webviews), and the alerts switch turns phone notifications on or off. The install prompt never shows inside the app. Faculty sign-in needs a development or store build: Expo Go cannot receive `aayam://`.

Phone notifications (`mobile/src/notify.ts`): permission is asked only from the Settings switch or the notify hint, never on load (`timetable-notify`, `timetable-notify-hint`, same as the site). On opt-in the phone registers its Expo push token with `/api/push/app-register`; the job pushes changes and notices. Lecture reminders are local scheduled notifications (10 min, 5 min, start; `shared/reminders.ts` wording), re-planned after every refresh so a cancelled class drops its reminders, at most 60 ahead (iOS keeps 64). Sign-out unregisters the token and clears reminders. Android channels: `changes`, `notices`, `reminders`. Push on Android needs Firebase (FCM V1) credentials on EAS and `google-services.json`; without them reminders still work.

The app matches the site's views: teachers get My classes, My cohorts (a coordinator, `shared/coordinators.ts`) and All classes (`can_see_all_faculty`); coordinators and full access download `?all=1` and filter on the phone. Students see the newest admin notice until "Got it" (`timetable-notice-ids`, an edited notice shows again). Exam season shows a red Exam button and a closable banner (`timetable-exam-notice`, reset when exam time ends). A Meet room is a solid "Google Meet" pill. Settings opens only the student's own batch sheet. The last bootstrap is kept on the phone (`timetable-app-last-bootstrap`) and shown, marked offline, when the network is gone.

Android home-screen widgets (`mobile/src/widgets/`, `react-native-android-widget`; `expo-widgets` has no background refresh on Android): Next class (2×2: the class on now or next today, or "No more classes today") and Today (4×3 list). Both show the person's own classes only (cohort, or the teacher's own lectures, never All classes), cohort for faculty and faculty for students, and the app theme. Cancelled keeps the subject colour with a Cancelled label (widget text has no strikethrough). The headless handler (registered in `index.ts`) redraws from `timetable-app-last-bootstrap`, and every 30 min (`updatePeriodMillis` in `app.json`) fetches `/api/bootstrap`. The bridge redraws them whenever the page changes a mirrored key and when the app comes to the front. A tap opens the app. Needs a new build.
