import type { CohortChoice } from "./cohort.ts";
import { facultyParts, personMatch } from "./faculty.ts";

/**
 * A read scope, as the client sends it on `/api/bootstrap` and `/api/calendar.ics`.
 * Priority is faculty, then division, then course/batch, then everything. Same order as `buildBootstrap`.
 */
export interface ReadScope {
  division?: string;
  faculty?: string;
  course?: string;
  batch?: string;
}

/**
 * The small document the sync job publishes as snapshot key `index`. The Worker reads it to turn a
 * request into a snapshot key without parsing a timetable.
 */
export interface SnapshotIndex {
  choices: CohortChoice[];
  faculties: string[];
  /** Every `course|batch` pair, lowercased, that has a `boot:b:` snapshot. */
  batches: string[];
  timezone: string;
}

/** Same resolution as the server always used: exact, then without a trailing year, then prefix. */
export function matchChoice(division: string, choices: CohortChoice[]): CohortChoice | undefined {
  const norm = division.trim().toLowerCase();
  if (!norm) return undefined;
  const bare = norm.replace(/\s+20\d{2}$/, "");
  return (
    choices.find((item) => item.division.toLowerCase() === norm) ??
    choices.find((item) => item.division.toLowerCase().replace(/\s+20\d{2}$/, "") === bare) ??
    choices.find((item) => item.division.toLowerCase().startsWith(norm) || norm.startsWith(item.division.toLowerCase()))
  );
}

/** The faculty name in the published list that a request means, or undefined. */
export function matchFaculty(query: string, faculties: string[]): string | undefined {
  const wanted = facultyParts(query);
  if (wanted.length === 0) return undefined;
  const lower = query.trim().toLowerCase();
  return (
    faculties.find((name) => name.toLowerCase() === lower) ??
    faculties.find((name) => wanted.some((part) => personMatch(part, name)))
  );
}

const clean = (value: string | undefined) => (value ?? "").trim().toLowerCase();

/**
 * Scope part of a snapshot key. Both the job (when writing) and the Worker (when reading) call this,
 * so a request lands on exactly the row the job wrote.
 *
 * - `f:<faculty name lowercased>`
 * - `d:<choice division lowercased>`
 * - `b:<course>|<batch>` (either side may be empty)
 * - `all`
 * - `none` for a faculty or division that does not exist. The job writes a `none` snapshot too.
 */
export function scopeKey(scope: ReadScope, index: Pick<SnapshotIndex, "choices" | "faculties">): string {
  if (clean(scope.faculty)) {
    const name = matchFaculty(scope.faculty!, index.faculties);
    return name ? `f:${name.toLowerCase()}` : "none";
  }
  if (clean(scope.division)) {
    const choice = matchChoice(scope.division!, index.choices);
    return choice ? `d:${choice.division.toLowerCase()}` : "none";
  }
  if (clean(scope.course) || clean(scope.batch)) {
    return `b:${clean(scope.course)}|${clean(scope.batch)}`;
  }
  return "all";
}

/** Snapshot keys. One row each in D1 `snapshots`. */
export const snapshotKeys = {
  index: "index",
  /** `SyncInfo` without `refreshing`. The Worker adds `refreshing` from `job_state`. */
  sync: "sync",
  changes: "changes",
  bootstrap: (scope: string) => `boot:${scope}`,
  calendar: (scope: string) => `ics:${scope}`,
};
