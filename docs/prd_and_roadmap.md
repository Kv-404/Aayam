# Product Requirements Document (PRD) & Engineering Roadmap

## 1. Objective
Refine the Aayam timetable portal to ensure:
1. **Latest Timetable Default**: When multiple timetables of different ranges exist across batches/tabs, only the latest timetable is shown by default.
2. **Faculty View & All-Classes UI Polish**: Eliminate giant cell stretching in `WeeklyView`, resolve multi-column CSS overflow bugs in `FacultyScopeMenu`, and streamline header navigation for faculty.
3. **Database Guidance**: Document MCP server migration requirements between Neon and Supabase while respecting existing repository invariants.

---

## 2. Success Criteria
- [x] Server and client logic cleanly isolates the latest week range when disparate dates exist.
- [x] Default active day in Day view and left-most column in Week view correspond to the latest published timetable.
- [x] All-Faculty / All-Classes weekly view renders without visual distortion, cell stretching, or column clipping.
- [x] `FacultyScopeMenu` replaces CSS columns with a responsive grid.
- [x] Full build (`npm run build`) and test suites (`npm test`, `npm run typecheck`) pass with 0 errors.

---

## 3. Phased Roadmap

### Phase 1: Specifications & Documentation
- Document UI tokens, UX flows, founder debates, and tech architecture in `docs/`.
- Establish granular implementation checklist.

### Phase 2: Latest Timetable Range Isolation Engine
- Implement `latestWeek` determination in `view.ts` and ensure client and server filter live lectures to the latest week range when multiple ranges exist.
- Ensure `weekStart` / `weekEnd` and `days` correspond to the latest week.

### Phase 3: All-Faculty UI & Layout Reconstruction
- Refactor `WeeklyView.tsx` multi-class cell rendering to prevent cell height blowup.
- Fix `FacultyScopeMenu.tsx` CSS layout from `columns-2` to `grid`.
- Polish header stability and cohort filtering.

### Phase 4: Quality Gate & Verification
- Run server unit test suite (`npm test`).
- Run TypeScript compiler checks (`npm run typecheck`).
- Run production build (`npm run build`) and API bundle generation.

---

## 4. Phase 6–9 Expansion: Redis Egress Mitigation & Remote MCP Server with OAuth 2.1

### Objective
1. **Eliminate Repeated Supabase Egress Limit Hits**: Replace uncoordinated Vercel cold-start full-database dumps with a Redis-first caching architecture (`@upstash/redis` REST + `ioredis` TCP dual-driver), scoped Postgres reads/writes, distributed sync locks/cooldowns, HTTP `ETag`/`304`, and cached auth lookups.
2. **Remote Streamable-HTTP MCP Server (`/mcp`)**: Expose timetable, room-finding, change-tracking, faculty schedule, and directory tools over Streamable HTTP compatible with Claude Desktop, Claude.ai, Claude Code, ChatGPT, and Cursor on Vercel Serverless.
3. **OAuth 2.1 Authorization Server for Confidential Data**: Implement full MCP-spec OAuth 2.1 (CIMD + DCR + PKCE S256 + RFC 8707 audience binding + refresh token rotation) backed by Google Workspace OAuth (`@itm.edu`, `@isu.ac.in`), `faculty_directory` permissions (`can_see_all_faculty`), a clean HTML consent screen, and Redis-backed ephemeral/token state.

### Roadmap Phases
- **Phase 6: Redis Integration & Supabase Egress Fix**
  - Dual-driver Redis client + gzip payload helpers (`server/src/services/redis.ts`).
  - Redis-first archive hydration, live-only Postgres cold-start read + on-demand week backup loading, differential `writeNeonRows`, Redis signature short-circuit, distributed sync lock & cooldown, HTTP `ETag`/cache middleware, and Redis-cached faculty/PIN auth + rate limiting.
- **Phase 7: OAuth 2.1 Authorization Server (CIMD + DCR + PKCE + Google)**
  - RFC 9728 & RFC 8414 discovery endpoints (`/.well-known/*`).
  - CIMD SSRF-safe fetcher + DCR `/oauth/register` + Redis store.
  - `/oauth/authorize` -> Google OAuth `/oauth/callback` -> consent page `/oauth/consent` -> `/oauth/token` (PKCE S256, RFC 8707 audience, refresh token rotation) -> `/oauth/revoke`.
- **Phase 8: Remote Streamable-HTTP MCP Server (`/mcp`)**
  - Stateless `McpServer` + `StreamableHTTPServerTransport` mounted in Express + Vercel rewrites (`vercel.json`).
  - Strict Bearer verifier (`requireMcpAuth`) + RBAC-scoped timetable, faculty schedule, room-finder, and confidential `faculty_directory` tools.
- **Phase 9: Verification, Docs & Production Bundle Gate**
  - Comprehensive tests for Redis cache hits/egress avoidance, distributed rate limit/lock, OAuth 2.1 flow & security invariants, and MCP tool RBAC.
  - Update `.env.example`, `docs/agent/server.md` / `docs/agent/deploy.md`, run `npm test`, `npm run typecheck`, `npm run build`, and check off `docs/implementation_checklist.md`.
- **Phase 10: AI Agent & App MCP Install UI**
  - Client install config generator (`client/src/lib/mcpInstall.ts`) and accessible modal (`client/src/components/McpConnectModal.tsx`) with one-click Cursor/VS Code deeplinks, copyable commands/JSON configs for Claude, Claude Code, ChatGPT, Windsurf, and Gemini CLI, plus starter prompts.
  - Integrate triggers into `Dashboard.tsx` header, `AppearanceMenu` Settings (mobile & desktop), and `HomePage.tsx`.
