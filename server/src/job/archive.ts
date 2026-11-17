import { createHash } from "node:crypto";
import { readSyncState, writeSyncState, type AppDatabase, type SyncState } from "../db.ts";
import type { SqlDb, SqlStatement } from "../d1/sql.ts";
import { archiveToRows, exportArchive, importArchive, json, rowsToArchive, type ChangeRow, type LectureRow, type WeekRow } from "../services/archiveRows.ts";

/**
 * The durable archive in D1 (`timetable_lectures`, `timetable_changes`, `timetable_weeks`, `timetable_sync`).
 * Same row mapping as the old Postgres rows: JSON columns hold JSON text, booleans are 0/1.
 *
 * The working database remembers a hash per D1 row it knows is there (`published_rows`), so a publish
 * writes only rows that changed and deletes only rows that went away.
 */

const LECTURE_COLUMNS = [
  "week_id", "id", "slot_key", "tab_name", "course", "semester", "batch", "division", "date", "weekday",
  "start_minutes", "end_minutes", "start_label", "end_label", "subject", "faculty", "room", "kind",
  "source_status", "reason", "explicit_mark", "recurring", "spreadsheet_id", "anchor", "highlight",
] as const;
const LECTURE_JSON = new Set(["anchor", "highlight"]);
const CHANGE_COLUMNS = [
  "id", "week_id", "dedupe_key", "detected_at", "type", "lecture_id", "division", "course", "semester",
  "tab_name", "date", "weekday", "summary", "previous", "next", "fields",
] as const;
const CHANGE_JSON = new Set(["previous", "next", "fields"]);
const WEEK_COLUMNS = ["id", "course", "batch", "start_date", "end_date"] as const;
const SYNC_COLUMNS = [
  "last_success_at", "last_attempt_at", "last_error", "bootstrapped", "content_hash", "tab_names", "parse_issues", "spreadsheet_title",
] as const;

/** Rows per `json_each` insert. Keeps one bound value well under D1's 2 MB. */
const UPSERT_BYTES = 400_000;
const PAGE = 2000;

type Row = Record<string, unknown>;

function cell(value: unknown, isJson: boolean) {
  if (value === undefined || value === null) return null;
  if (typeof value === "boolean") return value ? 1 : 0;
  if (isJson) return typeof value === "string" ? value : JSON.stringify(value);
  return value;
}

function values(row: Row, columns: readonly string[], jsonColumns: Set<string>) {
  return columns.map((column) => {
    const value = cell(row[column], jsonColumns.has(column));
    if (column === "recurring") return value ? 1 : 0;
    return value;
  });
}

const hashOf = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("base64url").slice(0, 22);

interface Desired {
  key: string;
  table: "L" | "C" | "W" | "S";
  values: unknown[];
  hash: string;
}

const lectureKey = (weekId: unknown, id: unknown) => `L\0${weekId}\0${id}`;
const changeKey = (weekId: unknown, id: unknown) => `C\0${weekId}\0${id}`;
const weekKey = (id: unknown) => `W\0${id}`;
const SYNC_KEY = "S";

function syncValues(state: SyncState) {
  return [
    state.lastSuccessAt,
    state.lastAttemptAt,
    state.lastError,
    state.bootstrapped ? 1 : 0,
    state.contentHash,
    JSON.stringify(state.tabNames),
    JSON.stringify(state.parseIssues),
    state.spreadsheetTitle,
  ];
}

function desiredRows(db: AppDatabase): Desired[] {
  const rows = archiveToRows(exportArchive(db));
  const out: Desired[] = [];
  for (const row of rows.lectures) {
    const list = values(row as unknown as Row, LECTURE_COLUMNS, LECTURE_JSON);
    out.push({ key: lectureKey(row.week_id, row.id), table: "L", values: list, hash: hashOf(list) });
  }
  for (const row of rows.changes) {
    const list = values(row as unknown as Row, CHANGE_COLUMNS, CHANGE_JSON);
    out.push({ key: changeKey(row.week_id, row.id), table: "C", values: list, hash: hashOf(list) });
  }
  for (const row of rows.weeks) {
    const list = values(row as unknown as Row, WEEK_COLUMNS, new Set());
    out.push({ key: weekKey(row.id), table: "W", values: list, hash: hashOf(list) });
  }
  const sync = syncValues(readSyncState(db));
  out.push({ key: SYNC_KEY, table: "S", values: sync, hash: hashOf(sync) });
  return out;
}

export function ensurePublishedTable(db: AppDatabase) {
  db.exec("CREATE TABLE IF NOT EXISTS published_rows (k TEXT PRIMARY KEY, hash TEXT NOT NULL)");
}

function readPublished(db: AppDatabase) {
  ensurePublishedTable(db);
  const rows = db.prepare("SELECT k, hash FROM published_rows").all() as Array<{ k: string; hash: string }>;
  return new Map(rows.map((row) => [row.k, row.hash]));
}

function writePublished(db: AppDatabase, entries: Array<[string, string]>, removed: string[], reset = false) {
  ensurePublishedTable(db);
  const put = db.prepare("INSERT OR REPLACE INTO published_rows (k, hash) VALUES (?, ?)");
  const drop = db.prepare("DELETE FROM published_rows WHERE k = ?");
  db.exec("BEGIN");
  try {
    if (reset) db.exec("DELETE FROM published_rows");
    for (const [key, hash] of entries) put.run(key, hash);
    for (const key of removed) drop.run(key);
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

export interface RemoteSync {
  revision: number;
  bootstrapped: boolean;
  contentHash: string | null;
  lastSuccessAt: string | null;
}

/** The D1 archive cursor, or null when the archive is empty. */
export async function readRemoteSync(sql: SqlDb): Promise<RemoteSync | null> {
  const rows = await sql.all<{ revision: number; bootstrapped: number; content_hash: string | null; last_success_at: string | null }>(
    "SELECT revision, bootstrapped, content_hash, last_success_at FROM timetable_sync WHERE id = 1",
  );
  const row = rows[0];
  if (!row) return null;
  return {
    revision: Number(row.revision) || 0,
    bootstrapped: Boolean(row.bootstrapped),
    contentHash: row.content_hash,
    lastSuccessAt: row.last_success_at,
  };
}

/** Keyset pages, so D1 never reads skipped rows. */
async function readAll<T extends Row>(sql: SqlDb, table: string, keys: [string, string]): Promise<T[]> {
  const out: T[] = [];
  let after: [unknown, unknown] | null = null;
  for (;;) {
    const where = after ? `WHERE (${keys[0]}, ${keys[1]}) > (?, ?)` : "";
    const page: T[] = await sql.all<T>(
      `SELECT * FROM ${table} ${where} ORDER BY ${keys[0]}, ${keys[1]} LIMIT ${PAGE}`,
      after ? [...after] : [],
    );
    out.push(...page);
    if (page.length < PAGE) return out;
    const last = page[page.length - 1]!;
    after = [last[keys[0]], last[keys[1]]];
  }
}

function emptyWorkingDb(db: AppDatabase) {
  db.exec("BEGIN");
  try {
    db.exec("DELETE FROM lectures; DELETE FROM change_events; DELETE FROM week_backups;");
    writeSyncState(db, {
      lastSuccessAt: null,
      lastAttemptAt: null,
      lastError: null,
      bootstrapped: false,
      contentHash: null,
      tabNames: [],
      parseIssues: [],
      spreadsheetTitle: null,
    });
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

/**
 * Replace the working database with the D1 archive. Returns the D1 revision. An empty D1 archive
 * leaves an empty working database, so the next sync is a first baseline.
 */
export async function hydrateFromD1(sql: SqlDb, db: AppDatabase): Promise<number> {
  const syncRows = await sql.all<Row>("SELECT * FROM timetable_sync WHERE id = 1");
  const sync = syncRows[0];
  if (!sync || !Number(sync.bootstrapped)) {
    emptyWorkingDb(db);
    writePublished(db, [], [], true);
    return Number(sync?.revision) || 0;
  }
  const lectures = await readAll<Row>(sql, "timetable_lectures", ["week_id", "id"]);
  const changes = await readAll<Row>(sql, "timetable_changes", ["week_id", "id"]);
  const weeks = await sql.all<Row>("SELECT id, course, batch, start_date, end_date FROM timetable_weeks");
  const state: SyncState = {
    lastSuccessAt: (sync.last_success_at as string | null) ?? null,
    lastAttemptAt: (sync.last_attempt_at as string | null) ?? null,
    lastError: (sync.last_error as string | null) ?? null,
    bootstrapped: true,
    contentHash: (sync.content_hash as string | null) ?? null,
    tabNames: json(sync.tab_names, []),
    parseIssues: json(sync.parse_issues, []),
    spreadsheetTitle: (sync.spreadsheet_title as string | null) ?? null,
  };
  const archive = rowsToArchive(String(sync.saved_at ?? new Date().toISOString()), state, {
    lectures: lectures as unknown as LectureRow[],
    changes: (changes as unknown as ChangeRow[]).sort((a, b) => Number(a.id) - Number(b.id)),
    weeks: weeks as unknown as WeekRow[],
  });
  importArchive(db, archive);
  // What D1 holds right now, hashed the same way a publish hashes what it writes.
  const known: Array<[string, string]> = [];
  for (const row of lectures) known.push([lectureKey(row.week_id, row.id), hashOf(values(row, LECTURE_COLUMNS, LECTURE_JSON))]);
  for (const row of changes) known.push([changeKey(row.week_id, row.id), hashOf(values(row, CHANGE_COLUMNS, CHANGE_JSON))]);
  for (const row of weeks) known.push([weekKey(row.id), hashOf(values(row, WEEK_COLUMNS, new Set()))]);
  known.push([SYNC_KEY, hashOf(values(sync, SYNC_COLUMNS, new Set(["tab_names", "parse_issues"])))]);
  writePublished(db, known, [], true);
  return Number(sync.revision) || 0;
}

function insertStatements(table: string, columns: readonly string[], rows: unknown[][]): SqlStatement[] {
  const select = columns.map((_, index) => `json_extract(value, '$[${index}]')`).join(", ");
  const sqlText = `INSERT OR REPLACE INTO ${table} (${columns.join(", ")}) SELECT ${select} FROM json_each(?)`;
  const statements: SqlStatement[] = [];
  let group: unknown[][] = [];
  let bytes = 0;
  for (const row of rows) {
    const size = JSON.stringify(row).length;
    if (group.length > 0 && bytes + size > UPSERT_BYTES) {
      statements.push({ sql: sqlText, params: [JSON.stringify(group)] });
      group = [];
      bytes = 0;
    }
    group.push(row);
    bytes += size;
  }
  if (group.length > 0) statements.push({ sql: sqlText, params: [JSON.stringify(group)] });
  return statements;
}

function deleteStatements(keys: string[]): SqlStatement[] {
  const lectures = new Map<string, string[]>();
  const changes = new Map<string, number[]>();
  const weeks: string[] = [];
  for (const key of keys) {
    const [table, a, b] = key.split("\0");
    if (table === "L") lectures.set(a!, [...(lectures.get(a!) ?? []), b!]);
    else if (table === "C") changes.set(a!, [...(changes.get(a!) ?? []), Number(b)]);
    else if (table === "W") weeks.push(a!);
  }
  const statements: SqlStatement[] = [];
  const chunked = <T>(list: T[], size = 2000) => {
    const out: T[][] = [];
    for (let index = 0; index < list.length; index += size) out.push(list.slice(index, index + size));
    return out;
  };
  for (const [weekId, ids] of lectures) {
    for (const part of chunked(ids)) {
      statements.push({ sql: "DELETE FROM timetable_lectures WHERE week_id = ? AND id IN (SELECT value FROM json_each(?))", params: [weekId, JSON.stringify(part)] });
    }
  }
  for (const [weekId, ids] of changes) {
    for (const part of chunked(ids)) {
      statements.push({ sql: "DELETE FROM timetable_changes WHERE week_id = ? AND id IN (SELECT value FROM json_each(?))", params: [weekId, JSON.stringify(part)] });
    }
  }
  for (const part of chunked(weeks)) {
    statements.push({ sql: "DELETE FROM timetable_weeks WHERE id IN (SELECT value FROM json_each(?))", params: [JSON.stringify(part)] });
  }
  return statements;
}

export interface PublishResult {
  revision: number;
  upserted: number;
  deleted: number;
}

/**
 * Write what changed since the last publish or hydrate. Order: deletes, upserts, then the sync row with the
 * new revision last, so a run that dies half way leaves the old revision and the next run repeats the diff.
 */
export async function publishToD1(sql: SqlDb, db: AppDatabase, revision: number): Promise<PublishResult> {
  const published = readPublished(db);
  const desired = desiredRows(db);
  const wanted = new Set(desired.map((row) => row.key));
  const changed = desired.filter((row) => published.get(row.key) !== row.hash);
  const removed = [...published.keys()].filter((key) => !wanted.has(key));
  if (changed.length === 0 && removed.length === 0) return { revision, upserted: 0, deleted: 0 };

  const next = revision + 1;
  const state = readSyncState(db);
  const statements: SqlStatement[] = [
    ...deleteStatements(removed),
    ...insertStatements("timetable_weeks", WEEK_COLUMNS, changed.filter((row) => row.table === "W").map((row) => row.values)),
    ...insertStatements("timetable_lectures", LECTURE_COLUMNS, changed.filter((row) => row.table === "L").map((row) => row.values)),
    ...insertStatements("timetable_changes", CHANGE_COLUMNS, changed.filter((row) => row.table === "C").map((row) => row.values)),
    {
      sql: `INSERT OR REPLACE INTO timetable_sync (id, saved_at, ${SYNC_COLUMNS.join(", ")}, revision)
        VALUES (1, ?, ${SYNC_COLUMNS.map(() => "?").join(", ")}, ?)`,
      params: [new Date().toISOString(), ...syncValues(state), next],
    },
  ];
  await sql.run(statements);
  writePublished(db, changed.map((row) => [row.key, row.hash]), removed);
  return { revision: next, upserted: changed.length, deleted: removed.length };
}
