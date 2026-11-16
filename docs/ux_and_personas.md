# UX Research, Personas & Microcopy Specification

## 1. User Personas

### Persona 1: Dr. Aarti Pardesi (Senior Faculty Member)
- **Role**: Professor teaching across Year 1, Year 2, and MCA batches.
- **Goals**: Check where she needs to be in 15 minutes, which room is booked, whether any lecture was rescheduled, and link directly to Google Meet if online.
- **Pain Points**: "When I open the app, I don't want to see 40 classes from other professors taking up my entire screen. If I click All Faculty, the page turns into a chaotic scroll fest."
- **Key Need**: Fast personal schedule lookup, clean cohort badges on her cards, and zero clutter.

### Persona 2: Prof. Gaurav Deshmukh (Class Coordinator)
- **Role**: Coordinator for Demis Hassabis and Jensen Huang cohorts.
- **Goals**: Check whether classes in his assigned cohorts are running smoothly, verify faculty attendance, and detect room collisions.
- **Pain Points**: "When multiple batches update their timetables at different dates, the app opens on last week's earliest dates instead of the current week. It takes 4 clicks just to find the latest timetable."
- **Key Need**: Instant default to the latest published timetable week; clean cohort filters.

### Persona 3: Samarth Patel (B.Tech Year 2 Student)
- **Role**: Student in Sam Altman division.
- **Goals**: View today's classes on his mobile phone before rushing to campus.
- **Pain Points**: Strikethrough cancellations must remain visible so he knows class was cancelled rather than simply vanishing.

---

## 2. End-to-End User Journeys

### Journey 1: Coordinator Opens "All Faculty" Mode
1. Coordinator logs in via Google OAuth (`@itm.edu`).
2. App defaults to their assigned cohorts (`My cohorts`) or `All classes` if given all-access.
3. System detects multiple timetables from different batches and strictly displays **only the latest week**.
4. The weekly grid presents multi-cohort time slots in an organized, balanced card layout without giant stretched cells.
5. Coordinator can filter down to any specific cohort using the quick-filter bar in one tap.

### Journey 2: Seamless Week Rollover
1. College administration uploads next week's sheet for BTech Year 1 on Thursday, while Year 2 uploads on Saturday.
2. The sync engine recognizes multiple ranges across workbooks.
3. Rather than defaulting to the earliest week (which would show outdated or mixed schedules), the UI defaults to the **latest published week** (`max(monday)`).
4. Earlier weeks remain accessible under "Past weeks" in the menu.

---

## 3. Human Microcopy Style Guide

Avoid robotic system jargon. Use tactile, conversational, human language.

| Scenario | Avoid (Sterile / Robotic) | Use (Human / Tactile) |
|---|---|---|
| Latest timetable active | `DISPLAYING LATEST DATASET RANGE` | `Viewing latest timetable: 2 Nov – 7 Nov` |
| Multiple weeks detected | `CONFLICTING TIME RANGE RECORDS DETECTED` | `Showing the latest week. Older schedules are in Past Weeks.` |
| All classes mode | `GLOBAL_SCHEDULE_AGGREGATE_VIEW` | `All classes across cohorts` |
| Multi-class cell overflow | `OVERFLOW_COUNT: +5 ROWS` | `+5 more cohorts` |
| Class cancelled | `STATUS_FLAG_TERMINATED` | `Cancelled · Prof unavailable` |
| Off day | `NON_OPERATIONAL_PERIOD` | `Whole day OFF` |
