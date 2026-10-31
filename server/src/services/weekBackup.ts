import type { WeekBackupRecord, AppDatabase } from "../db.ts";
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
    });
  }
  return backups;
}

export function rememberReplacedWeeks(
  db: AppDatabase,
  previous: StoredLecture[],
  next: Array<{ course: string; batch: string; date: string | null }>,
) {
  const fresh = replacedWeeks(previous, next);
  if (fresh.length === 0) return;
  const merged = new Map(readWeekBackups(db).map((week) => [week.id, week]));
  for (const week of fresh) merged.set(week.id, week);
  const byProgram = new Map<string, WeekBackupRecord[]>();
  for (const week of merged.values()) {
    const key = programKey(week.course, week.batch);
    const list = byProgram.get(key) ?? [];
    list.push(week);
    byProgram.set(key, list);
  }
  const kept: WeekBackupRecord[] = [];
  for (const list of byProgram.values()) {
    list.sort((a, b) => b.end.localeCompare(a.end) || b.start.localeCompare(a.start));
    kept.push(...list.slice(0, CAP));
  }
  replaceWeekBackups(db, kept);
}
