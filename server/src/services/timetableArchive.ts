import type { StoredChange, SyncState, WeekBackupRecord } from "../db.ts";
import type { StoredLecture } from "../model.ts";

/** Saved timetable, change log, and sync cursor. This is what survives a server restart. */
export interface TimetableArchive {
  version: 1;
  savedAt: string;
  lectures: StoredLecture[];
  changes: StoredChange[];
  sync: SyncState;
  /** Past weeks kept after a sheet moved to a new set of dates. Missing on older blobs. */
  weeks?: WeekBackupRecord[];
}

export function archiveSignature(archive: TimetableArchive) {
  const lectures = archive.lectures
    .map((lecture) => `${lecture.id}\t${lecture.sourceStatus}\t${lecture.subject}\t${lecture.faculty}\t${lecture.room}\t${lecture.startMinutes}`)
    .sort()
    .join("\n");
  const changes = archive.changes.map((change) => `${change.dedupeKey}\t${change.type}\t${change.summary}`).sort().join("\n");
  const weeks = (archive.weeks ?? []).map((week) => week.id).sort().join("\n");
  return `${archive.sync.contentHash ?? ""}\n${lectures}\n${changes}\n${weeks}`;
}

function mergeWeeks(newer: TimetableArchive, older: TimetableArchive): WeekBackupRecord[] {
  const byId = new Map<string, WeekBackupRecord>();
  for (const week of older.weeks ?? []) byId.set(week.id, week);
  for (const week of newer.weeks ?? []) byId.set(week.id, week);
  const byProgram = new Map<string, WeekBackupRecord[]>();
  for (const week of byId.values()) {
    const key = `${week.course}\0${week.batch}`;
    const list = byProgram.get(key) ?? [];
    list.push(week);
    byProgram.set(key, list);
  }
  const kept: WeekBackupRecord[] = [];
  for (const list of byProgram.values()) {
    list.sort((a, b) => b.end.localeCompare(a.end) || b.start.localeCompare(a.start));
    kept.push(...list.slice(0, 8));
  }
  return kept;
}

function dayKey(lecture: StoredLecture) {
  return `${lecture.tabName}|${lecture.date ?? ""}`;
}

/**
 * The newer snapshot wins. A cancelled lecture from the older copy is kept
 * when that day is still published and the newer copy no longer lists it.
 */
function publishedDates(archive: TimetableArchive) {
  return new Set(archive.lectures.map((lecture) => lecture.date).filter((date): date is string => Boolean(date)));
}

export function mergeArchives(left: TimetableArchive, right: TimetableArchive): TimetableArchive {
  const leftAt = left.sync.lastSuccessAt ?? "";
  const rightAt = right.sync.lastSuccessAt ?? "";
  const newer = rightAt >= leftAt ? right : left;
  const older = newer === right ? left : right;
  const newerDates = publishedDates(newer);
  const olderDates = publishedDates(older);
  const sameWeek = newerDates.size === 0 || olderDates.size === 0 || [...newerDates].some((date) => olderDates.has(date));
  // A new weekly sheet replaces the saved week. Last week's edits are not part of this baseline.
  if (!sameWeek) {
    return {
      ...newer,
      changes: newer.changes.filter((change) => !change.date || newerDates.has(change.date)),
      weeks: mergeWeeks(newer, older),
    };
  }
  const ids = new Set(newer.lectures.map((lecture) => lecture.id));
  const days = new Set(newer.lectures.filter((lecture) => lecture.kind !== "break" && lecture.date).map(dayKey));
  const kept = older.lectures.filter(
    (lecture) =>
      lecture.kind === "lecture" &&
      lecture.sourceStatus === "cancelled" &&
      !ids.has(lecture.id) &&
      days.has(dayKey(lecture)),
  );
  const changes = new Map<string, StoredChange>();
  const keep = (change: StoredChange) => newerDates.size === 0 || !change.date || newerDates.has(change.date);
  for (const change of newer.changes) {
    if (keep(change)) changes.set(change.dedupeKey, change);
  }
  for (const change of older.changes) {
    if (!keep(change)) continue;
    const current = changes.get(change.dedupeKey);
    if (!current) {
      changes.set(change.dedupeKey, change);
      continue;
    }
    if (current.type === "removed" && change.type === "cancelled") {
      changes.set(change.dedupeKey, { ...change, id: current.id });
    }
  }
  return {
    version: 1,
    savedAt: newer.savedAt >= older.savedAt ? newer.savedAt : older.savedAt,
    lectures: [...newer.lectures, ...kept],
    changes: uniqueChangeIds([...changes.values()]),
    sync: newer.sync,
    weeks: mergeWeeks(newer, older),
  };
}

/** Local and saved logs each number rows from 1. Keep the first id and give later clashes a new one. */
export function uniqueChangeIds(changes: StoredChange[]) {
  const used = new Set<number>();
  let nextId = changes.reduce((highest, change) => Math.max(highest, change.id || 0), 0);
  return changes.map((change) => {
    if (change.id > 0 && !used.has(change.id)) {
      used.add(change.id);
      return change;
    }
    nextId += 1;
    used.add(nextId);
    return { ...change, id: nextId };
  });
}
