import { neon, type NeonQueryFunction } from "@neondatabase/serverless";
import type { StoredChange } from "../db.ts";
import type { StoredLecture } from "../model.ts";
import type { TimetableArchive } from "./timetableArchive.ts";

type Sql = NeonQueryFunction<false, false>;

const LIVE = "live";
let schemaReady = false;

interface LectureRow {
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

interface ChangeRow {
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

interface WeekRow {
  id: string;
  course: string;
  batch: string;
  start_date: string;
  end_date: string;
}

export interface NeonRows {
  lectures: LectureRow[];
  changes: ChangeRow[];
  weeks: WeekRow[];
}

function neonUrl() {
  return process.env.DATABASE_URL?.trim() || "";
}

function chunks<T>(rows: T[], size: number) {
  const groups: T[][] = [];
  for (let index = 0; index < rows.length; index += size) groups.push(rows.slice(index, index + size));
  return groups;
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
export function archiveToRows(archive: TimetableArchive): NeonRows {
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

function json<T>(value: unknown, fallback: T): T {
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

export function rowsToArchive(savedAt: string, sync: TimetableArchive["sync"], rows: NeonRows): TimetableArchive {
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

async function ensureSchema(sql: Sql) {
  if (schemaReady) return;
  await sql`
    CREATE TABLE IF NOT EXISTS timetable_sync (
      id SMALLINT PRIMARY KEY CHECK (id = 1),
      saved_at TEXT NOT NULL,
      last_success_at TEXT,
      last_attempt_at TEXT,
      last_error TEXT,
      bootstrapped BOOLEAN NOT NULL,
      content_hash TEXT,
      tab_names JSONB NOT NULL,
      parse_issues JSONB NOT NULL,
      spreadsheet_title TEXT
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS timetable_changes (
      id INTEGER NOT NULL,
      week_id TEXT NOT NULL DEFAULT 'live',
      dedupe_key TEXT NOT NULL,
      detected_at TEXT NOT NULL,
      type TEXT NOT NULL,
      lecture_id TEXT,
      division TEXT,
      course TEXT,
      semester TEXT,
      tab_name TEXT,
      date TEXT,
      weekday TEXT,
      summary TEXT NOT NULL,
      previous JSONB,
      next JSONB,
      fields JSONB NOT NULL DEFAULT '[]'::jsonb,
      PRIMARY KEY (week_id, id),
      UNIQUE (week_id, dedupe_key)
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS timetable_weeks (
      id TEXT PRIMARY KEY,
      course TEXT NOT NULL,
      batch TEXT NOT NULL,
      start_date TEXT NOT NULL,
      end_date TEXT NOT NULL
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS timetable_lectures (
      week_id TEXT NOT NULL,
      id TEXT NOT NULL,
      slot_key TEXT NOT NULL,
      tab_name TEXT NOT NULL,
      course TEXT NOT NULL,
      semester TEXT NOT NULL,
      batch TEXT NOT NULL,
      division TEXT NOT NULL,
      date TEXT,
      weekday TEXT NOT NULL,
      start_minutes INTEGER NOT NULL,
      end_minutes INTEGER NOT NULL,
      start_label TEXT NOT NULL,
      end_label TEXT NOT NULL,
      subject TEXT NOT NULL,
      faculty TEXT NOT NULL,
      room TEXT NOT NULL,
      kind TEXT NOT NULL,
      source_status TEXT NOT NULL,
      reason TEXT,
      explicit_mark TEXT,
      recurring BOOLEAN NOT NULL,
      spreadsheet_id TEXT,
      anchor JSONB NOT NULL,
      highlight JSONB,
      PRIMARY KEY (week_id, id)
    )
  `;
  schemaReady = true;
}

function insertLectures(sql: Sql, rows: LectureRow[]) {
  const payload = JSON.stringify(rows);
  return sql`
    INSERT INTO timetable_lectures (
      week_id, id, slot_key, tab_name, course, semester, batch, division, date, weekday,
      start_minutes, end_minutes, start_label, end_label, subject, faculty, room, kind,
      source_status, reason, explicit_mark, recurring, spreadsheet_id, anchor, highlight
    )
    SELECT
      week_id, id, slot_key, tab_name, course, semester, batch, division, date, weekday,
      start_minutes, end_minutes, start_label, end_label, subject, faculty, room, kind,
      source_status, reason, explicit_mark, recurring, spreadsheet_id, anchor, highlight
    FROM jsonb_to_recordset(${payload}::jsonb) AS x(
      week_id text, id text, slot_key text, tab_name text, course text, semester text, batch text,
      division text, date text, weekday text, start_minutes int, end_minutes int, start_label text,
      end_label text, subject text, faculty text, room text, kind text, source_status text,
      reason text, explicit_mark text, recurring boolean, spreadsheet_id text, anchor jsonb, highlight jsonb
    )
  `;
}

function insertChanges(sql: Sql, rows: ChangeRow[]) {
  const payload = JSON.stringify(rows);
  return sql`
    INSERT INTO timetable_changes (
      id, week_id, dedupe_key, detected_at, type, lecture_id, division, course, semester,
      tab_name, date, weekday, summary, previous, next, fields
    )
    SELECT
      id, week_id, dedupe_key, detected_at, type, lecture_id, division, course, semester,
      tab_name, date, weekday, summary, previous, next, fields
    FROM jsonb_to_recordset(${payload}::jsonb) AS x(
      id int, week_id text, dedupe_key text, detected_at text, type text, lecture_id text,
      division text, course text, semester text, tab_name text, date text, weekday text,
      summary text, previous jsonb, next jsonb, fields jsonb
    )
  `;
}

export async function readNeonRows(): Promise<TimetableArchive | null> {
  const url = neonUrl();
  if (!url) return null;
  try {
    const sql = neon(url);
    await ensureSchema(sql);
    const syncRows = await sql`
      SELECT saved_at, last_success_at, last_attempt_at, last_error, bootstrapped, content_hash,
             tab_names, parse_issues, spreadsheet_title
      FROM timetable_sync WHERE id = 1
    ` as Array<{
      saved_at: string;
      last_success_at: string | null;
      last_attempt_at: string | null;
      last_error: string | null;
      bootstrapped: boolean;
      content_hash: string | null;
      tab_names: unknown;
      parse_issues: unknown;
      spreadsheet_title: string | null;
    }>;
    const sync = syncRows[0];
    if (!sync?.bootstrapped) return null;
    const lectures = await sql`SELECT * FROM timetable_lectures` as LectureRow[];
    const changes = await sql`SELECT * FROM timetable_changes ORDER BY id` as ChangeRow[];
    const weeks = await sql`SELECT id, course, batch, start_date, end_date FROM timetable_weeks` as WeekRow[];
    return rowsToArchive(
      sync.saved_at,
      {
        lastSuccessAt: sync.last_success_at,
        lastAttemptAt: sync.last_attempt_at,
        lastError: sync.last_error,
        bootstrapped: true,
        contentHash: sync.content_hash,
        tabNames: json(sync.tab_names, []),
        parseIssues: json(sync.parse_issues, []),
        spreadsheetTitle: sync.spreadsheet_title,
      },
      { lectures, changes, weeks },
    );
  } catch (error) {
    console.error("[archive] Neon row read error:", error);
    return null;
  }
}

export async function writeNeonRows(archive: TimetableArchive) {
  const url = neonUrl();
  if (!url) return false;
  const sql = neon(url);
  await ensureSchema(sql);
  const rows = archiveToRows(archive);
  const weekPayload = JSON.stringify(rows.weeks);
  const tabNames = JSON.stringify(archive.sync.tabNames);
  const parseIssues = JSON.stringify(archive.sync.parseIssues);
  await sql.transaction([
    sql`DELETE FROM timetable_lectures`,
    sql`DELETE FROM timetable_changes`,
    sql`DELETE FROM timetable_weeks`,
    sql`DELETE FROM timetable_sync`,
    ...chunks(rows.lectures, 200).map((chunk) => insertLectures(sql, chunk)),
    ...chunks(rows.changes, 200).map((chunk) => insertChanges(sql, chunk)),
    sql`
      INSERT INTO timetable_weeks (id, course, batch, start_date, end_date)
      SELECT id, course, batch, start_date, end_date
      FROM jsonb_to_recordset(${weekPayload}::jsonb) AS x(
        id text, course text, batch text, start_date text, end_date text
      )
    `,
    sql`
      INSERT INTO timetable_sync (
        id, saved_at, last_success_at, last_attempt_at, last_error, bootstrapped,
        content_hash, tab_names, parse_issues, spreadsheet_title
      ) VALUES (
        1, ${archive.savedAt}, ${archive.sync.lastSuccessAt}, ${archive.sync.lastAttemptAt},
        ${archive.sync.lastError}, ${archive.sync.bootstrapped}, ${archive.sync.contentHash},
        ${tabNames}::jsonb, ${parseIssues}::jsonb, ${archive.sync.spreadsheetTitle}
      )
    `,
  ]);
  return true;
}
