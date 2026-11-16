# Co-Founders Debate & Executive Strategy

## 1. The Debate: Systems Hacker vs Commercial Growth Strategist

### Topic 1: Neon vs Supabase Migration & Database Invariants
- **Systems Hacker**: "Look, our codebase talks standard PostgreSQL via `pg` / `@neondatabase/serverless` connection pooling. In `AGENTS.md`, we explicitly stated: *'Do not add Supabase, another database, or a write path to Google Sheets.'* Supabase is awesome, but why break our operational invariants when Neon is already holding our `batch_access_codes` and `timetable_archive` across Vercel cold starts without a hitch? If we migrate, we need PostgreSQL MCP and Supabase MCP to replicate tables and verify zero-downtime, but architecturally it's just swapping `DATABASE_URL`. Let's strictly answer the user's inquiry, provide the exact MCP tools needed, and keep the database rock solid."
- **Commercial Strategist**: "Agreed. Migrating the production database in the middle of active semester scheduling without user-supplied credentials would risk down-time for 2,000+ students. Let's document the exact MCP tooling (`@modelcontextprotocol/server-postgres` and `@supabase/mcp-server`), explain the exact procedure, and respect the invariant."

### Topic 2: Multi-Range Week Desynchronization
- **Commercial Strategist**: "Students and faculty are complaining: when different departments upload sheets at different times, the portal opens on the earliest (oldest) timetable by default. Teachers arrive at classrooms expecting last week's schedule! This is a P0 UX failure."
- **Systems Hacker**: "The root cause is in `dates.sort()` and `WeeklyView` using ascending chronological sort. `dates[0]` is the oldest Monday. If Year 1 is on Week 44 and Year 2 is on Week 45, the system defaulted to Week 44. The fix is mathematically simple: group lectures by their Monday date (`mondayOf(date)`), identify the maximum Monday (`latestMonday`), and ensure the active live view strictly renders the latest week. Any earlier week goes to the `savedWeeks` archive."

### Topic 3: The "All Faculty" Grid Disaster
- **Systems Hacker**: "Have you seen `WeeklyView` in All Classes mode? There are 12 cohorts. Each cell has 12 cards stacked inside `<div className="space-y-2">`. The cell is 1,800 pixels tall! And CSS `columns-2` in the faculty scope menu is randomly clipping buttons."
- **Commercial Strategist**: "Total mess. Deans and coordinators need a high-altitude cockpit, not an unreadable vertical pile. We must:
  1. Fix the CSS multi-column glitch by converting `FacultyScopeMenu` to a clean CSS Grid.
  2. In `WeeklyView`, introduce compact multi-lecture cards so that cells remain balanced.
  3. Provide an instant cohort filter bar so coordinators can isolate individual batches in one tap."

---

## 2. Executive Mandate

### P0 (Must Have & Ship Immediately)
1. **Latest Timetable Isolation**: Ensure that whenever multiple date ranges exist across workbooks or tabs, the system isolates and displays **only the latest timetable week** by default.
2. **Faculty Grid Sanitization**: Prevent gigantic cell height blowups in `WeeklyView` when viewing all classes; replace broken `columns-2` in `FacultyScopeMenu` with CSS Grid.
3. **Database Guidance**: Clearly document MCP server requirements for Supabase migration while upholding the `AGENTS.md` PostgreSQL invariant.

### P1 (High Priority Polish)
1. Cohort quick-filter chips in All Classes view.
2. Header layout stability at desktop `xl` breakpoint (preventing status line row drops).

### P2 (Future Optimizations)
1. Automated week-rollover notifications.
2. Enhanced offline IndexedDB caching for faculty lens preferences.
