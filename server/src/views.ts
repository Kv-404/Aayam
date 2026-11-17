import { batchYear, cohortChoices, cohortLabel, DEFAULT_COHORT_CHOICES, lectureInCohort, type CohortChoice } from "../../shared/cohort.ts";
import { changeMatchesFaculty, DEFAULT_FACULTY_NAMES, lectureMatchesFaculty, listFacultyNames } from "../../shared/faculty.ts";
import { matchChoice, type ReadScope } from "../../shared/scope.ts";
import type { BootstrapResponse, ChangeEvent, PublicLecture, SavedWeek, SheetLink } from "../../shared/types.ts";
import { spreadsheetUrl, type AppConfig, type SheetSource } from "./config.ts";
import { readSyncState, readWeekBackupsByIds, readWeekSummaries, type AppDatabase, type SyncState, type WeekBackupRecord, type WeekBackupSummary } from "./db.ts";
import type { StoredLecture } from "./model.ts";
import { listChanges } from "./services/changeHistoryService.ts";
import { persistCancelledRemovals } from "./services/persistCancelled.ts";
import { presentLecture } from "./services/presentLecture.ts";
import { restoreRemovedLectures } from "./services/restoreRemoved.ts";
import { loadSnapshot } from "./services/timetableSnapshotService.ts";
import { preferOneWeekCopies } from "./services/weekBackup.ts";
import { zonedParts } from "./time.ts";

/**
 * Every public response, as pure functions over the working database. The sync job renders these into D1
 * snapshots. Each view has a `prepare` step (reads and presents every lecture once) and a cheap per-scope step.
 */

export type ViewConfig = Pick<
  AppConfig,
  "collegeName" | "schoolName" | "courseName" | "spreadsheetId" | "spreadsheetTitle" | "spreadsheets" | "timezone" | "highlightHours" | "syncIntervalSeconds"
>;

export interface WeekResponse {
  lectures: PublicLecture[];
  changes: ChangeEvent[];
  spreadsheetUrl: string | null;
}

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

function summaryInScope(week: { course: string; batch: string }, filter: ReadScope | undefined, choices: CohortChoice[]) {
  if (!filter || filter.faculty) return true;
  if (filter.division) {
    const choice = choices.find((item) => item.division === filter.division);
    if (!choice) return true;
    return week.course === choice.course && week.batch === choice.batch;
  }
  if (filter.course && week.course.toLowerCase() !== filter.course.toLowerCase()) return false;
  if (filter.batch && week.batch.toLowerCase() !== filter.batch.toLowerCase()) return false;
  return true;
}

function dominantSheetId(weeks: WeekBackupRecord[]) {
  const counts = new Map<string, number>();
  for (const week of weeks) {
    for (const lecture of week.lectures) {
      if (!lecture.spreadsheetId) continue;
      counts.set(lecture.spreadsheetId, (counts.get(lecture.spreadsheetId) ?? 0) + 1);
    }
  }
  let best = "";
  let count = 0;
  for (const [id, n] of counts) {
    if (n > count) {
      best = id;
      count = n;
    }
  }
  return best;
}

/** A cancelled card of a class that is still on that day is the same lecture twice. */
function withoutRepeatedCancels<T extends { displayStatus: string; kind: string; date: string | null; division: string; subject: string }>(lectures: T[]) {
  const kept = new Set<string>();
  for (const lecture of lectures) {
    if (lecture.kind !== "lecture" || lecture.displayStatus === "cancelled") continue;
    kept.add(`${lecture.date ?? ""}\0${lecture.division}\0${lecture.subject.trim().toLowerCase()}`);
  }
  return lectures.filter((lecture) => {
    if (lecture.kind !== "lecture" || lecture.displayStatus !== "cancelled") return true;
    return !kept.has(`${lecture.date ?? ""}\0${lecture.division}\0${lecture.subject.trim().toLowerCase()}`);
  });
}

function presentBackup(week: WeekBackupRecord, now: Date, highlightHours: number, restoredIds: Set<string>): SavedWeek {
  const lectures = withoutRepeatedCancels(week.lectures.map((lecture) => presentLecture(lecture, now, highlightHours))).sort(byLecture);
  const lectureIds = new Set(lectures.map((lecture) => lecture.id));
  const divisions = new Set(lectures.map((lecture) => lecture.division));
  const changes = (week.changes ?? [])
    .filter((change) => {
      if (lectures.length === 0) return false;
      if (change.lectureId && lectureIds.has(change.lectureId)) return true;
      if (change.division) return divisions.has(change.division);
      return true;
    })
    .map((change): ChangeEvent => {
      const cancelled = Boolean(change.lectureId && restoredIds.has(change.lectureId) && change.type === "removed");
      const subject = change.previous?.subject || "A lecture";
      return {
        id: change.id,
        detectedAt: change.detectedAt,
        type: cancelled ? "cancelled" : change.type,
        lectureId: change.lectureId,
        division: change.division,
        course: change.course,
        semester: change.semester,
        tabName: change.tabName,
        date: change.date,
        weekday: change.weekday,
        summary: cancelled ? `${subject} lecture cancelled.` : change.summary,
        previous: change.previous,
        next: change.next,
        fields: change.fields ?? [],
      };
    });
  return { id: week.id, course: week.course, batch: week.batch, start: week.start, end: week.end, lectures, changes };
}

function programLinkKey(course: string, batch: string) {
  return `${course.trim().toLowerCase()}\0${batch.trim().toLowerCase()}`;
}

/** One edit link per course and batch. Lecture ids win; configured workbooks fill the rest. */
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

  for (const lecture of lectures) {
    if (lecture.spreadsheetId) put(lecture.course, lecture.batch, lecture.spreadsheetId);
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
  liveKeys: Set<string>;
  summaries: WeekBackupSummary[];
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

  const liveKeys = new Set<string>();
  const liveDates = new Map<string, string[]>();
  for (const lecture of allLectures) {
    if (!lecture.date) continue;
    const key = `${lecture.course}\0${lecture.batch}`;
    const list = liveDates.get(key) ?? [];
    list.push(lecture.date);
    liveDates.set(key, list);
  }
  for (const [key, list] of liveDates) {
    list.sort();
    liveKeys.add(`${key}\0${list[0]}\0${list[list.length - 1]}`);
  }
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
    liveKeys,
    summaries: readWeekSummaries(db),
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
  const savedWeeks: SavedWeek[] = base.summaries
    .filter((week) => !base.liveKeys.has(`${week.course}\0${week.batch}\0${week.start}\0${week.end}`))
    .filter((week) => summaryInScope(week, filter, choices))
    .map((week) => ({
      id: week.id,
      course: week.course,
      batch: week.batch,
      start: week.start,
      end: week.end,
      lectures: [],
      changes: [],
    }))
    .sort((a, b) => b.end.localeCompare(a.end) || b.start.localeCompare(a.start));
  return {
    collegeName: config.collegeName,
    schoolName: config.schoolName,
    courseName: config.courseName,
    spreadsheetId: config.spreadsheetId,
    spreadsheetTitle: state.spreadsheetTitle || config.spreadsheetTitle,
    spreadsheetUrl: spreadsheetUrl(config.spreadsheetId),
    sheets: sheetLinks(restored.lectures, config.spreadsheets),
    timezone: config.timezone,
    today: base.today,
    now: now.toISOString(),
    weekStart: dates[0] ?? null,
    weekEnd: dates[dates.length - 1] ?? null,
    savedWeeks,
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

/** Saved weeks, read and presented once per Monday. */
export interface WeekBase {
  choices: CohortChoice[];
  summaries: WeekBackupSummary[];
  restoredIds: Set<string>;
  now: Date;
  highlightHours: number;
}

export function prepareWeeks(db: AppDatabase, config: Pick<ViewConfig, "highlightHours">, now = new Date()): WeekBase {
  const snapshot = loadSnapshot(db);
  return {
    choices: cohortChoices(snapshot.map((lecture) => presentLecture(lecture, now, config.highlightHours))),
    summaries: preferOneWeekCopies(readWeekSummaries(db)),
    restoredIds: restoreRemovedLectures(snapshot, listChanges(db, 80)).restoredIds,
    now,
    highlightHours: config.highlightHours,
  };
}

/** Mondays that have at least one saved week. */
export function savedMondays(base: WeekBase) {
  return [...new Set(base.summaries.map((week) => mondayOf(week.start)))].sort();
}

export interface OpenedMonday {
  base: WeekBase;
  summaries: WeekBackupSummary[];
  records: Array<{ record: WeekBackupRecord; presented: SavedWeek }>;
}

export function openMonday(db: AppDatabase, base: WeekBase, monday: string): OpenedMonday {
  const summaries = base.summaries.filter((week) => mondayOf(week.start) === monday);
  const records = preferOneWeekCopies(readWeekBackupsByIds(db, summaries.map((week) => week.id)));
  return {
    base,
    summaries,
    records: records.map((record) => ({ record, presented: presentBackup(record, base.now, base.highlightHours, base.restoredIds) })),
  };
}

/** The `/api/week` payload for one scope. */
export function weekFor(opened: OpenedMonday, filter: ReadScope): WeekResponse {
  const { choices } = opened.base;
  const ids = new Set(opened.summaries.filter((week) => summaryInScope(week, filter, choices)).map((week) => week.id));
  const inScope = opened.records.filter((entry) => ids.has(entry.record.id));
  const lectures = inScope.flatMap((entry) => entry.presented.lectures);
  const weekChanges = inScope.flatMap((entry) => entry.presented.changes);
  const sheetId = dominantSheetId(inScope.map((entry) => entry.record));
  const faculty = filter.faculty?.trim() ?? "";
  const division = filter.division?.trim() ?? "";
  const scopedLectures = faculty
    ? lectures.filter((lecture) => lecture.kind !== "break" && lectureMatchesFaculty(lecture.faculty, faculty))
    : division
      ? lectures.filter((lecture) => {
          const choice = choices.find((item) => item.division === division);
          return choice ? lectureInCohort(lecture, choice) : lecture.division === division;
        })
      : lectures;
  return { lectures: scopedLectures, changes: weekChanges, spreadsheetUrl: sheetId ? spreadsheetUrl(sheetId) : null };
}

export function weekView(db: AppDatabase, config: Pick<ViewConfig, "highlightHours">, monday: string, filter: ReadScope, now = new Date()): WeekResponse {
  return weekFor(openMonday(db, prepareWeeks(db, config, now), monday), filter);
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
