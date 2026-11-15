# Design System & UI Specification: All-Faculty & Multi-Range Timetable

## 1. Visual Language & Tone

Aayam's design language combines typographic clarity, high density information architecture, and tactile micro-interactions. The interface draws inspiration from Swiss modernist transit schedules, Dieter Rams' industrial ergonomics, and high-performance financial terminals.

### Core Aesthetic Pillars
- **Surgical Precision**: Monospace labels for timestamps (`font-mono`, `text-[11px]`, `tracking-wider`), tabular numbers, and sharp 1px borders.
- **Dynamic Color Density**: Soft tinted category badges for lectures, sharp emerald accents for live classes, high-contrast danger strikethrough for cancellations, and muted graphite for breaks/OFF.
- **Spatial Balance**: Compact cell density that does not stretch tables disproportionately when many classes occur simultaneously.

---

## 2. Design Tokens & Color Palette

### Base Surfaces & Inks
- `bg-background`: Base canvas (`hsl(var(--background))`)
- `bg-card` / `bg-muted`: Secondary elevation and cell fills
- `border-border`: Subtle hairline borders (`1px solid hsl(var(--border) / 0.7)`)
- `text-foreground`: Primary text, crisp contrast
- `text-muted-foreground`: Secondary meta information (timing, room, batch)

### Status & Tone Tokens
- **Live / Now**: `emerald-500` pulse indicator, `bg-emerald-500/10`, `text-emerald-600 dark:text-emerald-400`
- **Cancelled**: `danger` / `red-500` strikethrough (`line-through decoration-danger decoration-2`) with uppercase `text-danger` badge
- **Rescheduled / Changed**: `amber-500/15` tint with `text-amber-600 dark:text-amber-400`
- **Break / Recess**: `bg-muted/40 text-muted-foreground font-mono`

---

## 3. UI Component Redesigns

### A. All-Faculty Weekly Grid (`WeeklyView`)
When viewing "All classes" (`active.kind === "all"`) or multi-cohort scopes:
1. **Multi-Class Cell Compaction**:
   - Instead of stacking 10+ standard lecture cards vertically (which inflates table row height to >1500px), multi-class cells switch to a high-density stacked card format:
     - Max 3 visible cards per slot by default with a sleek "+N more cohorts" drawer toggle, or a compact 2-column mini-card grid inside the cell.
     - Each mini-card displays: `[Cohort Chip]` `Subject` `Teacher` `Room`.
2. **Synchronized Time Slots**:
   - Quantize/cluster overlapping time ranges (e.g. 9:00 vs 9:15) to maintain balanced grid row heights.
   - Empty periods display clean, muted dashed outlines rather than jarring collapsed gaps.

### B. Faculty Scope Menu (`FacultyScopeMenu`)
1. **Grid Replacement for Buggy CSS Columns**:
   - Replace `lg:columns-2` with `grid grid-cols-1 lg:grid-cols-2 gap-2 items-start`.
   - Each batch section becomes a distinct card with sticky headers and clean borders, eliminating split-section clipping and overflow artifacts.
2. **Search & Filter Drawer**:
   - Refined search input with instant clear button (`X`), query highlight, and keyboard navigation (`↑`, `↓`, `Enter`, `Esc`).

### C. Cohort Quick-Filter Bar
- When in "All classes" mode, render a sleek horizontal scrolling chip bar (`All Cohorts`, `Sam Altman`, `Jeff Bezos`, `Larry Page`, etc.) right below the header:
  - Lets coordinators quickly isolate any division without losing the all-faculty view context.

### D. Single Latest Timetable Focus
- Header banner prominently indicates the active week range (`e.g. 2 Nov – 7 Nov 2026 (Latest)`).
- If past ranges exist, they are tucked neatly into the `Past weeks` dropdown menu, preventing accidental display of stale or earliest timetable data.
