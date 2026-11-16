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

---

## 3. Phase 6 Extension Debate: Supabase Egress Crisis & Remote MCP with OAuth 2.1

### Topic 4: Why Supabase Egress Limits Are Exhausting & How Redis Eliminates Them
- **Systems Hacker**: "Found the bleeding artery in `durableState.ts` and `neonRows.ts`. Every single Vercel serverless cold start has an empty `/tmp/timetable.sqlite`, so `hydrateArchive()` calls `readRemote()` — which executes **both** `readBlob()` (downloading the entire `timetable_archive` JSONB blob) **and** `readNeonRows()` (downloading all 2,781+ lectures across live + 15 historical weeks, plus 827 changes)! Even worse, `publishArchive()` runs `readRemote()` *again* on cold lambdas because `lastSignature` is module-local, and `lastSyncBySheet` + rate limiters are in-memory `Map`s! With 4s client polling and serverless fan-out, we're pulling megabytes from Supabase on every cold start and sync!"
- **Commercial Strategist**: "That's unsustainable on Supabase's egress quota and slows down cold starts. Putting **Upstash Redis** (supporting both REST for zero-connection Vercel lambdas and `REDIS_URL` TCP for flexibility) in front of Supabase fixes everything:
  1. **Gzipped Archive in Redis**: Cold starts hydrate from Redis in ~15ms -> **0 bytes of Supabase egress**.
  2. **Stop Double-Reading & Stop Loading Past Weeks on Cold Start**: Only load `live` rows + week summaries on cold miss; load past weeks on demand via `GET /api/week` and cache each week in Redis.
  3. **Shared Redis Signature, Sync Cooldown & Lock**: Eliminate duplicate sync storms and redundant `readRemote()` calls in `publishArchive()`.
  4. **Redis Response Cache + HTTP `ETag`/`304` + Auth Lookup Cache**: Cache `/api/bootstrap`, `/api/week`, `faculty_directory`, `batch_access_codes`, and rate-limiter counters in Redis."

### Topic 5: Remote MCP Server with Proper OAuth 2.1 for Confidential Data
- **Commercial Strategist**: "Faculty want to ask Claude, Cursor, or ChatGPT about their schedule, room availability, and department coverage. But `faculty_directory` (staff emails, `can_see_all_faculty` flags, login timestamps) and cross-faculty schedules are **confidential**! We cannot expose an unauthenticated MCP server or hand-roll insecure bearer strings."
- **Systems Hacker**: "Agreed. Let's embed a **Remote Streamable-HTTP MCP Server** (`/mcp`) right inside our Vercel Express API using `@modelcontextprotocol/sdk` (`McpServer` + `StreamableHTTPServerTransport` in stateless mode) and a full **OAuth 2.1 Authorization Server** (supporting **CIMD** `client_id_metadata_document_supported: true` + **DCR** `/oauth/register` + **PKCE S256** + **RFC 8707 `resource` audience binding** + **refresh token rotation** stored in Redis) backed by **Google OAuth + `faculty_directory`**! Every token carries verified faculty identity and exact DB-derived scopes (`timetable:read`, `faculty:self`, plus `faculty:all` / `faculty:directory` strictly when `can_see_all_faculty = true`)."

### Updated Executive Mandate (Phase 6–10)
- **P0 (Immediate)**:
  1. Implement dual-driver Redis service (Upstash REST + `REDIS_URL` TCP + in-memory test/dev fallback).
  2. Fix Supabase egress: Redis-first compressed archive hydration, eliminate `readBlob()` + `readNeonRows()` double-read, on-demand past-week loading, Redis signature short-circuit in `publishArchive`, shared Redis sync lock/cooldown, HTTP `ETag`/`304`, and Redis-cached auth/rate-limiting.
  3. Build OAuth 2.1 Authorization Server (CIMD + DCR + PKCE S256 + RFC 8707 + Google OAuth + consent page + Redis token store).
  4. Build Remote Streamable-HTTP MCP Server (`/mcp`) with RBAC-enforced faculty & timetable tools.
  5. Add in-app **Connect AI (`McpConnectModal`)** install prompts, one-click deeplinks (Cursor / VS Code), exact JSON/CLI configs (Claude, Claude Code, ChatGPT, Windsurf, Gemini CLI), and role-aware starter prompts so faculty can connect in seconds.
- **P1 (Quality & Verification)**:
  1. Comprehensive unit & integration test coverage for Redis caching, egress minimization, OAuth 2.1 security checks (PKCE, audience, DCR/CIMD, scopes), and MCP tool authorization.
  2. Update `vercel.json`, `.env.example`, `npm run typecheck`, `npm test`, and `npm run build` (`api/[[...path]].js`).
