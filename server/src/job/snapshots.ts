import { createHash } from "node:crypto";
import { calendarFile } from "../../../shared/calendar.ts";
import { scopeKey, snapshotKeys, type ReadScope, type SnapshotIndex } from "../../../shared/scope.ts";
import type { BootstrapResponse } from "../../../shared/types.ts";
import type { AppDatabase } from "../db.ts";
import type { SqlDb, SqlStatement } from "../d1/sql.ts";
import { listChanges } from "../services/changeHistoryService.ts";
import { bootstrapFor, calendarLectures, openMonday, prepareBootstrap, prepareWeeks, savedMondays, weekFor, type ViewConfig } from "../views.ts";

/** A faculty filter that matches nobody, for the `none` snapshot. */
const NOBODY = "\u0000nobody";

export const snapshotHash = (body: string) => createHash("sha256").update(body).digest("base64url").slice(0, 16);

interface Scope {
  key: string;
  filter?: ReadScope;
}

/** Every snapshot the Worker can serve, rendered from the working database. */
export function renderSnapshots(db: AppDatabase, config: ViewConfig, now = new Date()): Map<string, string> {
  const base = prepareBootstrap(db, config, now);
  const index: SnapshotIndex = { choices: base.choices, faculties: base.faculties, batches: [], timezone: config.timezone };
  const out = new Map<string, string>();

  const scopes: Scope[] = [];
  const seen = new Set<string>();
  const add = (filter: ReadScope | undefined, key = filter ? scopeKey(filter, index) : "all") => {
    if (seen.has(key)) return;
    seen.add(key);
    scopes.push({ key, filter });
  };
  add(undefined);
  add({ faculty: NOBODY }, "none");
  for (const choice of base.choices) add({ division: choice.division });
  for (const name of base.faculties) add({ faculty: name });
  const programs = new Map<string, { course: string; batch: string }>();
  const program = (course: string, batch: string) => {
    if (course.trim() && batch.trim()) programs.set(`${course.trim().toLowerCase()}|${batch.trim().toLowerCase()}`, { course: course.trim(), batch: batch.trim() });
  };
  for (const choice of base.choices) program(choice.course, choice.batch);
  for (const source of config.spreadsheets) program(source.course, source.batch ?? "");
  for (const { course, batch } of programs.values()) {
    add({ course, batch });
    add({ course });
    add({ batch });
  }
  index.batches = scopes.filter((scope) => scope.key.startsWith("b:")).map((scope) => scope.key.slice(2));

  for (const scope of scopes) {
    const body: Partial<BootstrapResponse> = bootstrapFor(base, scope.filter);
    delete body.now;
    delete body.today;
    delete body.sync;
    delete body.notices;
    out.set(snapshotKeys.bootstrap(scope.key), JSON.stringify(body));
  }

  const everything = bootstrapFor(base);
  const { refreshing: _refreshing, ...sync } = everything.sync;
  out.set(snapshotKeys.sync, JSON.stringify(sync));
  out.set(snapshotKeys.changes, JSON.stringify({ changes: listChanges(db, 200) }));

  const weeks = prepareWeeks(db, config, now);
  for (const monday of savedMondays(weeks)) {
    const opened = openMonday(db, weeks, monday);
    for (const scope of scopes) {
      if (scope.key === "none") continue;
      const week = weekFor(opened, scope.filter ?? {});
      if (week.lectures.length === 0) continue;
      out.set(snapshotKeys.week(monday, scope.key), JSON.stringify(week));
    }
  }

  for (const scope of scopes) {
    if (!scope.key.startsWith("d:") && !scope.key.startsWith("f:")) continue;
    const feed = calendarLectures(everything, { division: scope.filter?.division, faculty: scope.filter?.faculty });
    if (!feed) continue;
    out.set(snapshotKeys.calendar(scope.key), calendarFile(feed.lectures, config.timezone, feed.name, { includeCohort: feed.includeCohort }));
  }

  out.set(snapshotKeys.index, JSON.stringify(index));
  return out;
}

export interface SnapshotWrite {
  total: number;
  bytes: number;
  written: number;
  deleted: number;
}

const UPSERT = `INSERT INTO snapshots (key, body, hash, updated_at) VALUES (?, ?, ?, ?)
  ON CONFLICT (key) DO UPDATE SET body = excluded.body, hash = excluded.hash, updated_at = excluded.updated_at`;

/**
 * Upsert rows whose hash changed and delete keys no longer produced. Content rows go first, then `index`,
 * `sync`, and `changes`, then deletes, so the Worker never resolves a key that is not written yet.
 */
export async function writeSnapshots(sql: SqlDb, rendered: Map<string, string>, now = new Date()): Promise<SnapshotWrite> {
  const existing = new Map((await sql.all<{ key: string; hash: string }>("SELECT key, hash FROM snapshots")).map((row) => [row.key, row.hash]));
  const stamp = now.toISOString();
  const last = new Set<string>([snapshotKeys.index, snapshotKeys.sync, snapshotKeys.changes]);
  const first: SqlStatement[] = [];
  const after: SqlStatement[] = [];
  let bytes = 0;
  for (const [key, body] of rendered) {
    bytes += Buffer.byteLength(body);
    const hash = snapshotHash(body);
    if (existing.get(key) === hash) continue;
    (last.has(key) ? after : first).push({ sql: UPSERT, params: [key, body, hash, stamp] });
  }
  const stale = [...existing.keys()].filter((key) => !rendered.has(key));
  const deletes: SqlStatement[] = [];
  for (let index = 0; index < stale.length; index += 2000) {
    deletes.push({ sql: "DELETE FROM snapshots WHERE key IN (SELECT value FROM json_each(?))", params: [JSON.stringify(stale.slice(index, index + 2000))] });
  }
  const statements = [...first, ...after, ...deletes];
  if (statements.length > 0) await sql.run(statements);
  return { total: rendered.size, bytes, written: first.length + after.length, deleted: stale.length };
}
