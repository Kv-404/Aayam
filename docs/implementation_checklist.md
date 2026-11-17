# Implementation Checklist

## Phase 1: Planning & Architecture Documentation
- [x] Create UI design specifications in `docs/design.md`
- [x] Create UX personas and copy guide in `docs/ux_and_personas.md`
- [x] Create founders debate and executive strategy in `docs/founders_debate_and_strategy.md`
- [x] Create technical architecture in `docs/tech_architecture.md`
- [x] Create master PRD and roadmap in `docs/prd_and_roadmap.md`

## Phase 2: Latest Timetable Range Isolation Engine
- [x] Add `filterToLatestWeek` and `splitByLatestWeek` utility in `client/src/lib/view.ts`
- [x] Ensure `Dashboard.tsx` filters live feed (`lectureFeed`) to only the latest week when multiple ranges exist
- [x] Ensure `WeeklyView.tsx`, `Dashboard.tsx`, and `app.ts` compute default active day and week bounds from the latest week
- [x] Verify older week ranges are cleanly preserved under `savedWeeks` without polluting the live grid

## Phase 3: All-Faculty UI & Layout Reconstruction
- [x] Replace `lg:columns-2` in `FacultyScopeMenu.tsx` with CSS Grid (`grid grid-cols-1 lg:grid-cols-2`) to fix clipping and element tears
- [x] Update `WeeklyView.tsx` multi-class cell rendering: compact card layout for slots with $>2$ simultaneous cohort lectures with `ClassCellGroup` and `CompactCell`
- [x] Add cohort quick-filter pills when viewing All Classes in `Dashboard.tsx`
- [x] Stabilize faculty header layout at `xl` breakpoint to avoid unnecessary second row drops

## Phase 4: Production Quality Gate & Verification
- [x] Run server tests (`npm test`) and ensure 100% pass rate (84/84 tests pass)
- [x] Run TypeScript checks (`npm run typecheck`) with 0 errors
- [x] Run production build (`npm run build`) including `npm run build:api`
- [x] Update checklist items to `[x]` upon verification

## Phase 5: Database Migration to Supabase
- [x] Full backup export of Neon database (`batch_access_codes`, `faculty_directory`, `timetable_archive`, `timetable_lectures`, `timetable_changes`, `timetable_weeks`, `timetable_sync`)
- [x] DDL schema and indexes created on Supabase project `rdykolxvwbopkhsblggy`
- [x] Automated data seeding into Supabase: all 2,781 lectures, 827 changes, 22 faculty records, 5 batch PINs, 15 weeks, and full archive seeded
- [x] Application backend integrated with `@supabase/supabase-js` (`supabaseClient.ts`, `durableState.ts`, `auth.ts`) with seamless fallback support
- [x] End-to-end verification of PIN authentication, faculty authentication, and archive hydration against Supabase
- [x] Vercel serverless bundle re-built and verified (`npm run build:api`)

## Phase 6: Redis Caching & Supabase Egress Mitigation
- [x] Install `@upstash/redis`, `ioredis`, `@modelcontextprotocol/sdk`, and `zod` in `server`
- [x] Implement dual-driver Redis service (`server/src/services/redis.ts`) supporting Upstash REST, `REDIS_URL` TCP, gzip helpers, and in-memory test/dev fallback
- [x] Refactor `durableState.ts` & `neonRows.ts` for Redis-first archive hydration, elimination of redundant `readBlob()` + `readNeonRows()` double-read, on-demand past-week reads, Redis archive signature check, and differential `writeNeonRows`
- [x] Add distributed Redis sync cooldown, sync lock (`tt:v2:sync:lock`), scoped HTTP response caching, and `ETag`/`304 Not Modified` handling in `app.ts`
- [x] Move `pinRateLimiter` / `loginRateLimiter` to Redis-backed rate limiting and cache `faculty_directory` / `batch_access_codes` lookups in `auth.ts` (with throttled `last_login_at` updates)

## Phase 7: OAuth 2.1 Authorization Server (CIMD + DCR + PKCE + Google)
- [x] Implement Redis-backed OAuth 2.1 store (`server/src/mcp/oauthStore.ts`) for DCR clients, CIMD cache, auth transactions, single-use codes, access tokens, and rotating refresh tokens
- [x] Implement OAuth 2.1 discovery endpoints (`/.well-known/oauth-protected-resource`, `/.well-known/oauth-authorization-server`, `/.well-known/openid-configuration`) with `client_id_metadata_document_supported: true`
- [x] Implement CIMD URL validator (SSRF protection) and rate-limited DCR endpoint (`POST /oauth/register`)
- [x] Implement `/oauth/authorize` -> Google OAuth `/oauth/callback` -> CSRF-protected faculty consent screen (`POST /oauth/consent`) -> `/oauth/token` (PKCE S256, RFC 8707 `resource` validation, refresh rotation) -> `/oauth/revoke`
- [x] Implement strict `requireMcpAuth` middleware rejecting non-MCP tokens, expired/revoked tokens, and inactive faculty

## Phase 8: Remote Streamable-HTTP MCP Server (`/mcp`)
- [x] Implement stateless `McpServer` + `StreamableHTTPServerTransport` (`server/src/mcp/server.ts`) mounted on `/mcp` and `/api/mcp` with DNS-rebinding `Origin` checks and MCP CORS headers
- [x] Implement public/self-scoped timetable tools (`get_my_profile`, `get_my_schedule`, `get_cohort_timetable`, `list_cohorts_and_weeks`, `get_timetable_changes`, `find_free_rooms_or_slots`, `get_calendar_subscription_info`)
- [x] Implement confidential RBAC-gated tools (`get_faculty_schedule`, `list_faculty_directory`, `refresh_timetable_sync`) enforcing `can_see_all_faculty` and coordinator permissions
- [x] Update `vercel.json` rewrites (`/.well-known/*`, `/mcp`, `/oauth/*`) and `.env.example`

## Phase 9: Quality Gate, Tests & Production Bundle
- [x] Add unit & integration tests (`server/test/redisCache.test.ts`, `server/test/mcpOAuth.test.ts`, `server/test/mcpServer.test.ts`)
- [x] Update `docs/agent/server.md` and `docs/agent/deploy.md` to document Redis & MCP OAuth env/routes
- [x] Run `npm test`, `npm run typecheck`, and `npm run build` (`api/[[...path]].js`) and verify all pass
- [x] Tick `[x]` on all completed items in `docs/implementation_checklist.md`

## Phase 10: AI Agent & App MCP Install Prompts UI
- [x] Create `client/src/lib/mcpInstall.ts` generating verified install links, CLI commands, and host-specific JSON configs (Claude, Claude Code, Cursor, VS Code, ChatGPT, Windsurf, Gemini CLI) + starter prompts
- [x] Create `client/src/components/McpConnectModal.tsx` with accessible tablist, copy actions, Cursor/VS Code deeplinks, and role-aware OAuth status
- [x] Wire `Connect AI` triggers into `Dashboard.tsx` header & Settings (`AppearanceMenu`) and `HomePage.tsx` / `PitchClose.tsx`
- [x] Update `docs/agent/client.md` and pass `npm run typecheck`, `npm test`, and `npm run build`
- [x] Tick `[x]` on all completed Phase 10 items in `docs/implementation_checklist.md`
