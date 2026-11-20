import { batchYear, cohortChoices, cohortLabel, DEFAULT_COHORT_CHOICES, lectureInCohort, type CohortChoice } from "../../shared/cohort.ts";
import { changeMatchesFaculty, DEFAULT_FACULTY_NAMES, lectureMatchesFaculty, listFacultyNames } from "../../shared/faculty.ts";
import { matchChoice, type ReadScope } from "../../shared/scope.ts";
import type { BootstrapResponse, ChangeEvent, PublicLecture, SheetLink } from "../../shared/types.ts";
import { spreadsheetUrl, type AppConfig, type SheetSource } from "./config.ts";
import { readSyncState, type AppDatabase, type SyncState } from "./db.ts";
import type { StoredLecture } from "./model.ts";
import { listChanges } from "./services/changeHistoryService.ts";
import { persistCancelledRemovals } from "./services/persistCancelled.ts";
import { presentLecture } from "./services/presentLecture.ts";
import { restoreRemovedLectures } from "./services/restoreRemoved.ts";
import { loadSnapshot } from "./services/timetableSnapshotService.ts";
import { zonedParts } from "./time.ts";

/**
 * Every public response, as pure functions over the working database. The sync job renders these into D1
 * snapshots. Each view has a `prepare` step (reads and presents every lecture once) and a cheap per-scope step.
 */

export type ViewConfig = Pick<
  AppConfig,
  "collegeName" | "schoolName" | "courseName" | "spreadsheetId" | "spreadsheetTitle" | "spreadsheets" | "timezone" | "highlightHours" | "syncIntervalSeconds"
>;

export function mondayOf(iso: string) {
  const date = new Date(`${iso}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() - ((date.getUTCDay() + 6) % 7));
  return date.toISOString().slice(0, 10);
}

function plusDays(iso: string, days: number) {
  const date = new Date(`${iso}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function programLinkKey(course: string, batch: string) {
  return `${course.trim().toLowerCase()}\0${batch.trim().toLowerCase()}`;
}

/**
 * One edit link per course and batch. The D1 sheet link wins, so a batch an admin repointed links to the
 * new workbook even while its lectures still carry the old id; lecture ids only fill batches with no link.
 */
function sheetLinks(lectures: Array<{ spreadsheetId?: string; course: string; batch: string }>, sources: SheetSource[]): SheetLink[] {
  const seen = new Map<string, SheetLink>();
  const put = (course: string, batch: string, id: string) => {
    const cleanCourse = course.trim();
    const cleanBatch = batch.trim();
    const cleanId = id.trim();
    if (!cleanCourse || !cleanBatch || !cleanId) return;
    const key = programLinkKey(cleanCourse, cleanBatch);
    if (seen.has(key)) return;
    seen.set(key, {
      spreadsheetId: cleanId,
      spreadsheetUrl: spreadsheetUrl(cleanId),
      course: cleanCourse,
      batch: cleanBatch,
    });
  };

  const linked = new Map<string, string>();
  for (const source of sources) {
    if (source.batch) linked.set(programLinkKey(source.course, source.batch), source.id);
  }
  for (const lecture of lectures) {
    const id = linked.get(programLinkKey(lecture.course, lecture.batch)) ?? lecture.spreadsheetId;
    if (id) put(lecture.course, lecture.batch, id);
  }
  for (const source of sources) {
    if (source.batch) put(source.course, source.batch, source.id);
  }
  return [...seen.values()];
}

function byLecture(a: PublicLecture, b: PublicLecture) {
  const date = (a.date ?? "").localeCompare(b.date ?? "");
  if (date !== 0) return date;
  if (a.startMinutes !== b.startMinutes) return a.startMinutes - b.startMinutes;
  const division = a.division.localeCompare(b.division);
  if (division !== 0) return division;
  return a.subject.localeCompare(b.subject);
}

/** Everything `buildBootstrap` reads once, before any scope is applied. */
export interface BootstrapBase {
  config: ViewConfig;
  now: Date;
  state: SyncState;
  today: string;
  changes: ChangeEvent[];
  restored: { lectures: StoredLecture[]; restoredIds: Set<string> };
  allLectures: PublicLecture[];
  choices: CohortChoice[];
  faculties: string[];
}

export function prepareBootstrap(db: AppDatabase, config: ViewConfig, now = new Date()): BootstrapBase {
  const state = readSyncState(db);
  const zone = zonedParts(now, config.timezone);
  persistCancelledRemovals(db);
  const changes = listChanges(db, 80);
  const restored = restoreRemovedLectures(loadSnapshot(db), changes);
  const allLectures = restored.lectures
    .map((lecture) => presentLecture(lecture, now, config.highlightHours))
    .sort(byLecture);

  const parsedChoices = cohortChoices(allLectures);
  const seenDivisions = new Set(parsedChoices.map((c) => c.division));
  const choices = [
    ...parsedChoices,
    ...DEFAULT_COHORT_CHOICES.filter((c) => !seenDivisions.has(c.division)),
  ].sort((a, b) => {
    const course = a.course.localeCompare(b.course);
    if (course !== 0) return course;
    const year = batchYear(b.batch) - batchYear(a.batch);
    if (year !== 0) return year;
    const batch = b.batch.localeCompare(a.batch);
    if (batch !== 0) return batch;
    return cohortLabel(a.division).localeCompare(cohortLabel(b.division));
  });

  const faculties = listFacultyNames([
    ...allLectures.filter((lecture) => lecture.kind !== "break").map((lecture) => lecture.faculty),
    ...DEFAULT_FACULTY_NAMES,
  ]);

  return {
    config,
    now,
    state,
    today: zone.iso,
    changes,
    restored,
    allLectures,
    choices,
    faculties,
  };
}

export function bootstrapFor(base: BootstrapBase, filter?: ReadScope): BootstrapResponse {
  const { config, now, state, changes, restored, allLectures, choices, faculties } = base;

  const scopeOf = (rows: PublicLecture[]) => {
    if (filter?.faculty) {
      const faculty = filter.faculty;
      return rows.filter((lecture) => lecture.kind !== "break" && lectureMatchesFaculty(lecture.faculty, faculty));
    }
    if (filter?.division) {
      const division = filter.division;
      const choice = matchChoice(division, choices);
      return choice
        ? rows.filter((lecture) => lectureInCohort(lecture, choice))
        : rows.filter((lecture) => lecture.division.toLowerCase() === division.trim().toLowerCase());
    }
    if (filter?.course || filter?.batch) {
      return rows.filter((lecture) =>
        (!filter.course || lecture.course.toLowerCase() === filter.course.toLowerCase()) &&
        (!filter.batch || lecture.batch.toLowerCase() === filter.batch.toLowerCase()),
      );
    }
    return rows;
  };

  let lectures = allLectures;
  let relevantChanges = changes;

  if (filter?.faculty) {
    const targetFaculty = filter.faculty;
    const facultyPool = scopeOf(allLectures);
    lectures = facultyPool;
    const facultyIds = new Set(facultyPool.map((l) => l.id));
    relevantChanges = changes.filter((change) => changeMatchesFaculty(change, targetFaculty, facultyIds));
  } else if (filter?.division) {
    const targetDivision = filter.division;
    const choice = matchChoice(targetDivision, choices);
    lectures = scopeOf(allLectures);
    const watchedDivisions = new Set(choice ? [choice.division, ...choice.also] : [targetDivision]);
    relevantChanges = changes.filter((change) => !change.division || watchedDivisions.has(change.division));
  } else if (filter?.course || filter?.batch) {
    lectures = scopeOf(allLectures);
    relevantChanges = changes.filter((change) =>
      (!filter.course || change.course?.toLowerCase() === filter.course.toLowerCase())
    );
  }

  const dated = lectures.map((lecture) => lecture.date).filter((date): date is string => Boolean(date)).sort();
  const latest = dated[dated.length - 1];
  if (latest) {
    const weekStartDate = mondayOf(latest);
    const weekEndDate = plusDays(weekStartDate, 6);
    lectures = lectures.filter((lecture) => lecture.date && lecture.date >= weekStartDate && lecture.date <= weekEndDate);
    relevantChanges = relevantChanges.filter((change) => !change.date || (change.date >= weekStartDate && change.date <= weekEndDate));
  }

  const dates = lectures.map((lecture) => lecture.date).filter((date): date is string => Boolean(date)).sort();
  const sheets = sheetLinks(restored.lectures, config.spreadsheets);
  return {
    collegeName: config.collegeName,
    schoolName: config.schoolName,
    courseName: config.courseName,
    spreadsheetId: config.spreadsheetId,
    spreadsheetTitle: state.spreadsheetTitle || config.spreadsheetTitle,
    spreadsheetUrl: config.spreadsheetId ? spreadsheetUrl(config.spreadsheetId) : (sheets[0]?.spreadsheetUrl ?? ""),
    sheets,
    timezone: config.timezone,
    today: base.today,
    now: now.toISOString(),
    weekStart: dates[0] ?? null,
    weekEnd: dates[dates.length - 1] ?? null,
    sync: {
      lastSuccessAt: state.lastSuccessAt,
      lastAttemptAt: state.lastAttemptAt,
      lastError: state.lastError,
      stale: Boolean(state.lastError) || !state.lastSuccessAt,
      bootstrapped: state.bootstrapped,
      intervalSeconds: config.syncIntervalSeconds,
      highlightHours: config.highlightHours,
      tabNames: state.tabNames,
      contentHash: state.contentHash,
      source: "google-sheets-xlsx-export",
    },
    parseIssues: state.parseIssues,
    choices,
    faculties,
    lectures,
    changes: relevantChanges.map((change) => {
      if (!change.lectureId || !restored.restoredIds.has(change.lectureId) || change.type !== "removed") return change;
      const subject = change.previous?.subject || "A lecture";
      return { ...change, type: "cancelled", summary: `${subject} lecture cancelled.` };
    }),
  };
}

/** The `/api/bootstrap` payload, without notices or `sync.refreshing`. */
export function buildBootstrap(db: AppDatabase, config: ViewConfig, now = new Date(), filter?: ReadScope): BootstrapResponse {
  return bootstrapFor(prepareBootstrap(db, config, now), filter);
}

/**
 * Lectures for `/api/calendar.ics`. `snapshot` is the unscoped bootstrap. Returns null when the feed would be
 * empty (the old handler answered 404).
 */
export function calendarLectures(snapshot: Pick<BootstrapResponse, "lectures">, scope: { division?: string; faculty?: string }) {
  const division = scope.division?.trim() ?? "";
  const faculty = scope.faculty?.trim() ?? "";
  const choice = division ? cohortChoices(snapshot.lectures).find((item) => item.division === division) : undefined;
  const lectures = faculty
    ? snapshot.lectures.filter((lecture) => lectureMatchesFaculty(lecture.faculty, faculty))
    : choice
      ? snapshot.lectures.filter((lecture) => lectureInCohort(lecture, choice))
      : division
        ? snapshot.lectures.filter((lecture) => lecture.division === division)
        : [];
  if ((!faculty && !division) || lectures.length === 0) return null;
  return { lectures, name: faculty || cohortLabel(division), includeCohort: Boolean(faculty) };
}
