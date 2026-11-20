import type { StoredChange, WeekBackupRecord, AppDatabase } from "../db.ts";
import { readWeekBackups, replaceWeekBackups } from "../db.ts";
import type { StoredLecture } from "../model.ts";
import { programKey } from "../program.ts";

const CAP = 8;

function dated(lectures: Array<{ date: string | null }>) {
  return lectures.map((lecture) => lecture.date).filter((date): date is string => Boolean(date)).sort();
}

/** A program whose next dates share nothing with its previous dates. Same-week edits are ignored. */
export function replacedWeeks(
  previous: StoredLecture[],
  next: Array<{ course: string; batch: string; date: string | null }>,
): WeekBackupRecord[] {
  const previousGroups = new Map<string, StoredLecture[]>();
  for (const lecture of previous) {
    const key = programKey(lecture.course, lecture.batch);
    const group = previousGroups.get(key) ?? [];
    group.push(lecture);
    previousGroups.set(key, group);
  }
  const nextDates = new Map<string, Set<string>>();
  for (const lecture of next) {
    if (!lecture.date) continue;
    const key = programKey(lecture.course, lecture.batch);
    const dates = nextDates.get(key) ?? new Set<string>();
    dates.add(lecture.date);
    nextDates.set(key, dates);
  }
  const backups: WeekBackupRecord[] = [];
  for (const [key, lectures] of previousGroups) {
    const previousDates = dated(lectures);
    const incoming = nextDates.get(key);
    if (previousDates.length === 0 || !incoming || incoming.size === 0) continue;
    if (previousDates.some((date) => incoming.has(date))) continue;
    const sample = lectures[0];
    if (!sample) continue;
    const start = previousDates[0]!;
    const end = previousDates[previousDates.length - 1]!;
    backups.push({
      id: `${sample.course}|${sample.batch}|${start}|${end}`,
      course: sample.course,
      batch: sample.batch,
      start,
      end,
      lectures,
      changes: [],
    });
  }
  return backups;
}

/** One saved timetable per course and batch, using the dates those lectures actually span. */
export function weeksFromLectures(lectures: StoredLecture[]): WeekBackupRecord[] {
  const groups = new Map<string, StoredLecture[]>();
  for (const lecture of lectures) {
    const key = programKey(lecture.course, lecture.batch);
    const group = groups.get(key) ?? [];
    group.push(lecture);
    groups.set(key, group);
  }
  const weeks: WeekBackupRecord[] = [];
  for (const group of groups.values()) {
    const dates = dated(group);
    const sample = group[0];
    if (!sample || dates.length === 0) continue;
    const start = dates[0]!;
    const end = dates[dates.length - 1]!;
    weeks.push({
      id: `${sample.course}|${sample.batch}|${start}|${end}`,
      course: sample.course,
      batch: sample.batch,
      start,
      end,
      lectures: group,
      changes: [],
    });
  }
  return weeks;
}

/** Keep the updates that happened on this week's dates, matched to its cohorts. */
export function changesForWeek(week: WeekBackupRecord, changes: StoredChange[], weeks: WeekBackupRecord[]) {
  const divisions = new Set(week.lectures.map((lecture) => lecture.division));
  const dates = new Set(dated(week.lectures));
  return changes.filter((change) => {
    if (change.date) {
      if (!dates.has(change.date)) return false;
      return !change.division || divisions.has(change.division);
    }
    if (change.division) return divisions.has(change.division);
    if (change.course && change.course.toLowerCase() !== week.course.toLowerCase()) return false;
    const siblings = weeks.filter((item) => programKey(item.course, item.batch) === programKey(week.course, week.batch));
    return siblings.length <= 1 || siblings[0]?.id === week.id;
  });
}

function capWeeks(weeks: WeekBackupRecord[], currentIds: Set<string>) {
  const byProgram = new Map<string, WeekBackupRecord[]>();
  for (const week of weeks) {
    const key = programKey(week.course, week.batch);
    const list = byProgram.get(key) ?? [];
    list.push(week);
    byProgram.set(key, list);
  }
  const kept: WeekBackupRecord[] = [];
  for (const list of byProgram.values()) {
    const current = list.filter((week) => currentIds.has(week.id));
    const past = list.filter((week) => !currentIds.has(week.id));
    past.sort((a, b) => b.end.localeCompare(a.end) || b.start.localeCompare(a.start));
    kept.push(...current, ...past.slice(0, CAP));
  }
  return kept;
}

export function rememberReplacedWeeks(
  db: AppDatabase,
  previous: StoredLecture[],
  next: Array<{ course: string; batch: string; date: string | null }>,
  changes: StoredChange[] = [],
) {
  const fresh = replacedWeeks(previous, next);
  if (fresh.length === 0) return;
  for (const week of fresh) week.changes = changesForWeek(week, changes, fresh);
  const merged = new Map(readWeekBackups(db).map((week) => [week.id, week]));
  for (const week of fresh) merged.set(week.id, week);
  replaceWeekBackups(db, capWeeks([...merged.values()], new Set()));
}

/** Store the published week in its current form. Same dates update that week. A later week does not erase it. */
export function rememberPublishedWeeks(db: AppDatabase, lectures: StoredLecture[]) {
  const current = weeksFromLectures(lectures);
  if (current.length === 0) return;
  const merged = new Map(readWeekBackups(db).map((week) => [week.id, week]));
  for (const week of current) {
    const existing = merged.get(week.id);
    merged.set(week.id, existing ? { ...week, changes: existing.changes } : week);
  }
  replaceWeekBackups(db, capWeeks([...merged.values()], new Set(current.map((week) => week.id))));
}
