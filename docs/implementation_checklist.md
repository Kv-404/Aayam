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
