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
