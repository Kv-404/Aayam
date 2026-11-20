import {
  readAllChanges,
  readLectures,
  readSyncState,
  readWeekBackups,
  replaceChangeRows,
  replaceLectures,
  replaceWeekBackups,
  writeSyncState,
  type AppDatabase,
  type StoredChange,
} from "../db.ts";
import type { StoredLecture } from "../model.ts";
import type { TimetableArchive } from "./timetableArchive.ts";

/** Archive document <-> archive rows. No database client here, so the sync job and tests can use it. */

export function exportArchive(db: AppDatabase): TimetableArchive {
  return {
    version: 1,
    savedAt: new Date().toISOString(),
    lectures: readLectures(db),
    changes: readAllChanges(db),
    sync: readSyncState(db),
    weeks: readWeekBackups(db),
  };
}

export function importArchive(db: AppDatabase, archive: TimetableArchive) {
  db.exec("BEGIN");
  try {
    replaceLectures(db, archive.lectures);
    replaceChangeRows(db, archive.changes);
    replaceWeekBackups(db, archive.weeks ?? []);
    writeSyncState(db, { ...archive.sync, bootstrapped: true });
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

export const LIVE = "live";

export interface LectureRow {
  week_id: string;
  id: string;
  slot_key: string;
  tab_name: string;
  course: string;
  semester: string;
  batch: string;
  division: string;
  date: string | null;
  weekday: string;
  start_minutes: number;
  end_minutes: number;
  start_label: string;
  end_label: string;
  subject: string;
  faculty: string;
  room: string;
  kind: string;
  source_status: string;
  reason: string | null;
  explicit_mark: string | null;
  recurring: boolean;
  spreadsheet_id: string | null;
  anchor: StoredLecture["anchor"];
  highlight: StoredLecture["highlight"];
}

export interface ChangeRow {
  id: number;
  week_id: string;
  dedupe_key: string;
  detected_at: string;
  type: string;
  lecture_id: string | null;
  division: string | null;
  course: string | null;
  semester: string | null;
  tab_name: string | null;
  date: string | null;
  weekday: string | null;
  summary: string;
  previous: StoredChange["previous"];
  next: StoredChange["next"];
  fields: string[];
}

export interface WeekRow {
  id: string;
  course: string;
  batch: string;
  start_date: string;
  end_date: string;
}

export interface ArchiveRowSet {
  lectures: LectureRow[];
  changes: ChangeRow[];
  weeks: WeekRow[];
}

function lectureRow(lecture: StoredLecture, weekId: string): LectureRow {
  return {
    week_id: weekId,
    id: lecture.id,
    slot_key: lecture.slotKey,
    tab_name: lecture.tabName,
    course: lecture.course,
    semester: lecture.semester,
    batch: lecture.batch,
    division: lecture.division,
    date: lecture.date,
    weekday: lecture.weekday,
    start_minutes: lecture.startMinutes,
    end_minutes: lecture.endMinutes,
    start_label: lecture.startLabel,
    end_label: lecture.endLabel,
    subject: lecture.subject,
    faculty: lecture.faculty,
    room: lecture.room,
    kind: lecture.kind,
    source_status: lecture.sourceStatus,
    reason: lecture.reason,
    explicit_mark: lecture.explicitMark,
    recurring: lecture.recurring,
    spreadsheet_id: lecture.spreadsheetId ?? null,
    anchor: lecture.anchor,
    highlight: lecture.highlight,
  };
}

function changeRow(change: StoredChange, weekId: string): ChangeRow {
  return {
    id: change.id,
    week_id: weekId,
    dedupe_key: change.dedupeKey,
    detected_at: change.detectedAt,
    type: change.type,
    lecture_id: change.lectureId,
    division: change.division,
    course: change.course,
    semester: change.semester,
    tab_name: change.tabName,
    date: change.date,
    weekday: change.weekday,
    summary: change.summary,
    previous: change.previous,
    next: change.next,
    fields: change.fields ?? [],
  };
}

function uniqueChangeRows(rows: ChangeRow[]) {
  const seenKeys = new Set<string>();
  const seenIds = new Set<string>();
  let nextId = rows.reduce((highest, row) => Math.max(highest, row.id || 0), 0);
  const unique: ChangeRow[] = [];
  for (const row of rows) {
    const key = `${row.week_id}\0${row.dedupe_key}`;
    if (seenKeys.has(key)) continue;
    let id = row.id;
    if (id <= 0 || seenIds.has(`${row.week_id}\0${id}`)) {
      nextId += 1;
      id = nextId;
    }
    seenKeys.add(key);
    seenIds.add(`${row.week_id}\0${id}`);
    unique.push({ ...row, id });
  }
  return unique;
}

function uniqueLectureRows(rows: LectureRow[]) {
  const seen = new Set<string>();
  const unique: LectureRow[] = [];
  for (const row of rows) {
    const key = `${row.week_id}\0${row.id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(row);
  }
  return unique;
}

/** Split one archive document into one row per lecture and one row per update. */
export function archiveToRows(archive: TimetableArchive): ArchiveRowSet {
  const lectures = archive.lectures.map((lecture) => lectureRow(lecture, LIVE));
  const changes = archive.changes.map((change) => changeRow(change, LIVE));
  const weeks: WeekRow[] = [];
  for (const week of archive.weeks ?? []) {
    weeks.push({ id: week.id, course: week.course, batch: week.batch, start_date: week.start, end_date: week.end });
    for (const lecture of week.lectures) lectures.push(lectureRow(lecture, week.id));
    for (const change of week.changes ?? []) changes.push(changeRow(change, week.id));
  }
  return {
    lectures: uniqueLectureRows(lectures),
    changes: uniqueChangeRows(changes),
    weeks,
  };
}

function text(value: unknown) {
  if (value == null) return null;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  const raw = String(value);
  return raw ? raw.slice(0, 10) : null;
}

export function json<T>(value: unknown, fallback: T): T {
  if (value == null) return fallback;
  if (typeof value === "string") {
    try {
      return JSON.parse(value) as T;
    } catch {
      return fallback;
    }
  }
  return value as T;
}

function lectureFromRow(row: LectureRow): StoredLecture {
  return {
    id: row.id,
    slotKey: row.slot_key,
    tabName: row.tab_name,
    course: row.course,
    semester: row.semester,
    batch: row.batch,
    division: row.division,
    date: text(row.date),
    weekday: row.weekday,
    startMinutes: Number(row.start_minutes),
    endMinutes: Number(row.end_minutes),
    startLabel: row.start_label,
    endLabel: row.end_label,
    subject: row.subject,
    faculty: row.faculty,
    room: row.room,
    kind: row.kind as StoredLecture["kind"],
    sourceStatus: row.source_status === "cancelled" ? "cancelled" : "scheduled",
    reason: row.reason,
    explicitMark: (row.explicit_mark ?? null) as StoredLecture["explicitMark"],
    recurring: Boolean(row.recurring),
    spreadsheetId: row.spreadsheet_id ?? undefined,
    anchor: json(row.anchor, {
      subject: row.subject,
      faculty: row.faculty,
      room: row.room,
      startMinutes: Number(row.start_minutes),
      endMinutes: Number(row.end_minutes),
      startLabel: row.start_label,
      endLabel: row.end_label,
      sourceStatus: row.source_status === "cancelled" ? "cancelled" : "scheduled",
      reason: row.reason ?? "",
      kind: row.kind as StoredLecture["kind"],
      explicitMark: null,
    }),
    highlight: row.highlight ? json(row.highlight, null) : null,
  };
}

function changeFromRow(row: ChangeRow): StoredChange {
  return {
    id: Number(row.id),
    dedupeKey: row.dedupe_key,
    detectedAt: row.detected_at,
    type: row.type,
    lectureId: row.lecture_id,
    division: row.division,
    course: row.course,
    semester: row.semester,
    tabName: row.tab_name,
    date: text(row.date),
    weekday: row.weekday,
    summary: row.summary,
    previous: row.previous ? json(row.previous, null) : null,
    next: row.next ? json(row.next, null) : null,
    fields: json(row.fields, []),
  };
}

export function rowsToArchive(savedAt: string, sync: TimetableArchive["sync"], rows: ArchiveRowSet): TimetableArchive {
  const weeks = new Map(rows.weeks.map((week) => [week.id, {
    id: week.id,
    course: week.course,
    batch: week.batch,
    start: text(week.start_date) ?? week.start_date,
    end: text(week.end_date) ?? week.end_date,
    lectures: [] as StoredLecture[],
    changes: [] as StoredChange[],
  }]));
  const liveLectures: StoredLecture[] = [];
  for (const row of rows.lectures) {
    const lecture = lectureFromRow(row);
    if (row.week_id === LIVE) {
      liveLectures.push(lecture);
      continue;
    }
    weeks.get(row.week_id)?.lectures.push(lecture);
  }
  const liveChanges: StoredChange[] = [];
  for (const row of rows.changes) {
    const change = changeFromRow(row);
    if (row.week_id === LIVE) {
      liveChanges.push(change);
      continue;
    }
    weeks.get(row.week_id)?.changes.push(change);
  }
  return {
    version: 1,
    savedAt,
    lectures: liveLectures,
    changes: liveChanges.sort((a, b) => a.id - b.id),
    sync,
    weeks: [...weeks.values()],
  };
}
