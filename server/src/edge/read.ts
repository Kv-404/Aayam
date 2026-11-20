import { cohortLabel } from "../../../shared/cohort.ts";
import { matchChoice, scopeKey, snapshotKeys, type ReadScope, type SnapshotIndex } from "../../../shared/scope.ts";
import type { DatabaseConnectionStatus } from "../../../shared/types.ts";
import type { SqlDb, SqlStatement } from "../d1/sql.ts";
import type { Ctx } from "./env.ts";
import { errorJson, json, jsonText, text } from "./http.ts";
import { isRefreshing, isStale, recentlyDispatched, requestSync, type JobState } from "./sync.ts";

/**
 * Read routes. Every response is a prebuilt snapshot row. The only JSON parsed here is `index`
 * (cached per isolate by hash), `sync`, `changes`, and the handful of notice rows.
 */

/** One row of a combined read. `kind` is `s` snapshot, `j` job state, `n` notice, or `x` exam switch. */
interface Row {
  kind: string;
  a: string | null;
  b: string | null;
  c: string | null;
  d: string | null;
  e: string | null;
  f: string | null;
}

const NOTICE_DAYS = 14;

let indexCache: { hash: string; value: SnapshotIndex } | null = null;

/** Tests reset the per-isolate cache between databases. */
export function clearIndexCache() {
  indexCache = null;
}

/** Snapshot rows. The `index` body comes back NULL when its hash is the one this isolate already parsed. */
function snapshotPart(keys: string[], knownIndexHash: string): SqlStatement {
  return {
    sql: `SELECT 's' AS kind, key AS a, hash AS b, CASE WHEN key = 'index' AND hash = ? THEN NULL ELSE body END AS c, updated_at AS d, NULL AS e, NULL AS f FROM snapshots WHERE key IN (${keys.map(() => "?").join(", ")})`,
    params: [knownIndexHash, ...keys],
  };
}

const jobPart: SqlStatement = {
  sql: "SELECT 'j', requested_at, dispatched_at, finished_at, NULL, NULL, NULL FROM job_state WHERE id = 1",
  params: [],
};

/** The admin exam switch rides in the same query, so it costs no extra request. */
const examPart: SqlStatement = {
  sql: "SELECT 'x', value, updated_at, NULL, NULL, NULL, NULL FROM app_settings WHERE key = 'exam_mode'",
  params: [],
};

/** Last 14 days and not expired, newest 5. NULL course or batch means everyone. */
function noticePart(audience: { course: string; batch: string }, now: number): SqlStatement {
  return {
    sql: `SELECT 'n', id, created_at, title, body, COALESCE(updated_at, created_at), expires_at FROM (
      SELECT id, title, body, created_at, updated_at, expires_at FROM student_notices
      WHERE created_at > ?
        AND (expires_at IS NULL OR expires_at > ?)
        AND (course IS NULL OR lower(course) = lower(?))
        AND (batch IS NULL OR lower(batch) = lower(?))
      ORDER BY created_at DESC
      LIMIT 5
    )`,
    params: [new Date(now - NOTICE_DAYS * 24 * 60 * 60 * 1000).toISOString(), new Date(now).toISOString(), audience.course, audience.batch],
  };
}

function union(parts: SqlStatement[]): SqlStatement {
  return {
    sql: parts.map((part) => part.sql).join("\nUNION ALL\n"),
    params: parts.flatMap((part) => part.params ?? []),
  };
}

async function select(db: SqlDb, parts: SqlStatement[]) {
  const statement = union(parts);
  return db.all<Row>(statement.sql, statement.params);
}

interface Plan {
  keys: string[];
  parts: SqlStatement[];
}

/**
 * Read `index` plus whatever the request needs, in one round trip when this isolate already has the
 * current index. When the index changed (or this is a cold isolate) the scoped part is read again.
 */
async function readWithIndex(db: SqlDb, fixed: Plan, plan: (index: SnapshotIndex) => Plan) {
  const cached = indexCache;
  const guess = cached ? plan(cached.value) : { keys: [], parts: [] };
  let rows = await select(db, [snapshotPart(["index", ...fixed.keys, ...guess.keys], cached?.hash ?? ""), ...fixed.parts, ...guess.parts]);
  let indexRow = rows.find((row) => row.kind === "s" && row.a === "index");
  if (!indexRow) return { index: null, rows };
  if (indexRow.c === null && cached && cached.hash === indexRow.b) return { index: cached.value, rows };

  if (indexRow.c === null) {
    // Another request replaced the cache between the read and now. Read the body itself.
    const again = await select(db, [snapshotPart(["index"], "")]);
    indexRow = again[0];
    if (!indexRow?.c) return { index: null, rows };
  }
  const index = JSON.parse(indexRow.c!) as SnapshotIndex;
  indexCache = { hash: indexRow.b ?? "", value: index };

  // Keep only what did not depend on the guessed index.
  rows = rows.filter((row) => (row.kind === "s" ? row.a === "index" || fixed.keys.includes(row.a ?? "") : row.kind === "j" || row.kind === "x"));
  const next = plan(index);
  const parts = [...(next.keys.length > 0 ? [snapshotPart(next.keys, "")] : []), ...next.parts];
  if (parts.length > 0) rows = rows.concat(await select(db, parts));
  return { index, rows };
}

const snapshot = (rows: Row[], key: string) => rows.find((row) => row.kind === "s" && row.a === key);

export function readScope(url: URL): ReadScope {
  const param = (name: string) => url.searchParams.get(name)?.trim() ?? "";
  return {
    division: (url.searchParams.get("division") ?? url.searchParams.get("cohort") ?? "").trim(),
    faculty: param("faculty"),
    course: param("course"),
    batch: param("batch"),
  };
}

/** Same as `noticesForScope`: faculty see none; a division reads its course and batch. */
function noticeAudience(scope: ReadScope, index: SnapshotIndex) {
  if (scope.faculty) return null;
  let course = scope.course ?? "";
  let batch = scope.batch ?? "";
  if (scope.division) {
    const choice = matchChoice(scope.division, index.choices);
    if (choice) {
      course = choice.course;
      batch = choice.batch;
    }
  }
  if (!course && !batch) return null;
  return { course, batch };
}

const formatters = new Map<string, Intl.DateTimeFormat>();

/** `YYYY-MM-DD` in the timetable's time zone, same as `zonedParts(...).iso`. */
export function todayIn(timeZone: string, date = new Date()) {
  let formatter = formatters.get(timeZone);
  if (!formatter) {
    try {
      formatter = new Intl.DateTimeFormat("en-GB", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" });
    } catch {
      return date.toISOString().slice(0, 10);
    }
    formatters.set(timeZone, formatter);
  }
  let year = "";
  let month = "";
  let day = "";
  for (const part of formatter.formatToParts(date)) {
    if (part.type === "year") year = part.value;
    else if (part.type === "month") month = part.value;
    else if (part.type === "day") day = part.value;
  }
  return `${year}-${month}-${day}`;
}

function stamp(value: string | null) {
  const date = new Date(value ?? "");
  return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
}

/**
 * The bootstrap body, by string concatenation. `syncBody` is `SyncInfo` without `refreshing`, and
 * `bootBody` is `BootstrapResponse` without `now`, `today`, `sync`, and `notices`.
 */
export function assembleBootstrap(input: {
  now: string;
  today: string;
  syncBody: string | null;
  refreshing: boolean;
  noticesJson: string;
  examMode?: boolean;
  bootBody: string;
}) {
  const sync =
    input.syncBody && input.syncBody.length > 2
      ? input.syncBody.slice(0, -1) + ',"refreshing":' + input.refreshing + "}"
      : '{"refreshing":' + input.refreshing + "}";
  const head = '{"now":' + JSON.stringify(input.now) + ',"today":' + JSON.stringify(input.today) + ',"sync":' + sync + ',"notices":' + input.noticesJson + ',"examMode":' + Boolean(input.examMode);
  return input.bootBody.length > 2 ? head + "," + input.bootBody.slice(1) : head + "}";
}

/** FNV-1a, enough to tell notice lists apart in an ETag. */
function shortHash(value: string) {
  let hash = 0x811c9dc5;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(36);
}

export function bootstrapEtag(bootHash: string, syncHash: string, newestNoticeId: string, today: string) {
  return `W/"${bootHash}.${syncHash}.${newestNoticeId || "0"}.${today}"`;
}

function etagMatches(header: string | null, etag: string) {
  if (!header) return false;
  if (header.trim() === "*") return true;
  const bare = etag.replace(/^W\//, "");
  return header.split(",").some((tag) => tag.trim().replace(/^W\//, "") === bare);
}

/** `GET /api/bootstrap`, and the body of `POST /api/sync` with `forceRefreshing`. */
export async function bootstrap(ctx: Ctx, options: { forceRefreshing?: boolean } = {}) {
  const scope = readScope(ctx.url);
  const nowMs = Date.now();
  const bootKey = (index: SnapshotIndex) => snapshotKeys.bootstrap(scopeKey(scope, index));
  const { index, rows } = await readWithIndex(ctx.db, { keys: [snapshotKeys.sync], parts: [jobPart, examPart] }, (current) => {
    const audience = noticeAudience(scope, current);
    return { keys: [bootKey(current)], parts: audience ? [noticePart(audience, nowMs)] : [] };
  });
  const jobRow = rows.find((row) => row.kind === "j");
  const job: JobState | null = jobRow ? { requested_at: jobRow.a, dispatched_at: jobRow.b, finished_at: jobRow.c } : null;

  let boot = index ? snapshot(rows, bootKey(index)) : undefined;
  if (index && !boot) {
    // A batch or course the job has no snapshot for reads like an unknown cohort.
    boot = (await select(ctx.db, [snapshotPart([snapshotKeys.bootstrap("none")], "")]))[0];
  }
  if (!index || !boot?.c) {
    if (!recentlyDispatched(job, nowMs)) ctx.exec.waitUntil(requestSync(ctx.env, "stale", { db: ctx.db }));
    return errorJson(503, "The timetable is not ready yet.", { "Retry-After": "30" });
  }

  const sync = snapshot(rows, snapshotKeys.sync);
  // Only a user request shows as refreshing. A stale read asks quietly, like the cron.
  const refreshing = Boolean(options.forceRefreshing) || isRefreshing(job, nowMs);
  if (isStale(job, sync?.d, nowMs) && !recentlyDispatched(job, nowMs)) {
    ctx.exec.waitUntil(requestSync(ctx.env, "stale", { db: ctx.db }));
  }

  const notices = rows
    .filter((row) => row.kind === "n")
    .sort((x, y) => (x.b ?? "") < (y.b ?? "") ? 1 : (x.b ?? "") > (y.b ?? "") ? -1 : 0)
    .map((row) => ({ id: row.a ?? "", title: row.c ?? "", body: row.d ?? "", createdAt: stamp(row.b), updatedAt: stamp(row.e), expiresAt: row.f ? stamp(row.f) : null }));
  const examMode = rows.some((row) => row.kind === "x" && row.a === "1");
  const today = todayIn(index.timezone || ctx.env.TIMEZONE || "Asia/Kolkata", new Date(nowMs));
  // Any edit, expiry or exam switch changes the tag, so a 304 never hides it.
  const noticeTag = (notices.length ? shortHash(notices.map((notice) => `${notice.id}:${notice.updatedAt}:${notice.expiresAt ?? ""}`).join(",")) : "0") + (examMode ? "x" : "");
  const etag = bootstrapEtag(boot.b ?? "", sync?.b ?? "", noticeTag, today);

  if (!options.forceRefreshing && etagMatches(ctx.request.headers.get("If-None-Match"), etag)) {
    return new Response(null, { status: 304, headers: { ETag: etag, "Cache-Control": "no-cache" } });
  }
  const body = assembleBootstrap({
    now: new Date(nowMs).toISOString(),
    today,
    syncBody: sync?.c ?? null,
    refreshing,
    noticesJson: JSON.stringify(notices),
    examMode,
    bootBody: boot.c,
  });
  return jsonText(body, 200, options.forceRefreshing ? { "Cache-Control": "no-store" } : { ETag: etag });
}

/** `GET /api/calendar.ics?division=` or `?faculty=` */
export async function calendar(ctx: Ctx) {
  const division = (ctx.url.searchParams.get("division") ?? ctx.url.searchParams.get("cohort") ?? "").trim();
  const faculty = ctx.url.searchParams.get("faculty")?.trim() ?? "";
  const missing = () => text(faculty ? "No lectures for that faculty." : "Unknown cohort.", 404);
  if (!faculty && !division) return missing();
  const icsKey = (index: SnapshotIndex) => {
    const scope = scopeKey({ division, faculty }, index);
    return scope === "none" ? null : snapshotKeys.calendar(scope);
  };
  const { index, rows } = await readWithIndex(ctx.db, { keys: [], parts: [] }, (current) => {
    const key = icsKey(current);
    return { keys: key ? [key] : [], parts: [] };
  });
  const key = index ? icsKey(index) : null;
  const row = key ? snapshot(rows, key) : undefined;
  if (!row?.c) return missing();
  const name = faculty || cohortLabel(division);
  const headers: Record<string, string> = { "Content-Type": "text/calendar; charset=utf-8", "Cache-Control": "no-store" };
  if (ctx.url.searchParams.get("download") === "1") {
    const file = `${name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "timetable"}.ics`;
    headers["Content-Disposition"] = `attachment; filename="${file}"`;
  }
  return new Response(row.c, { status: 200, headers });
}

/** `GET /api/changes?limit=` (default 80, at most 200). */
export async function changes(ctx: Ctx) {
  const limit = Math.min(200, Math.max(1, Number(ctx.url.searchParams.get("limit")) || 80));
  const rows = await ctx.db.all<{ body: string }>("SELECT body FROM snapshots WHERE key = ?", [snapshotKeys.changes]);
  const body = rows[0]?.body;
  if (!body) return jsonText('{"changes":[]}');
  if (limit >= 200) return jsonText(body);
  const parsed = JSON.parse(body) as { changes?: unknown[] };
  const list = Array.isArray(parsed.changes) ? parsed.changes : [];
  if (list.length <= limit) return jsonText(body);
  return json({ changes: list.slice(0, limit) });
}

/** `SELECT 1` against D1, with its round-trip time. */
export async function databaseStatus(db: SqlDb, timeoutMs = 3000): Promise<DatabaseConnectionStatus> {
  const start = Date.now();
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      db.all("SELECT 1 AS alive"),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error("Database check timed out")), timeoutMs);
      }),
    ]);
    return { connected: true, latencyMs: Math.round(Date.now() - start) };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { connected: false, error: message || "Database connection failed" };
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/** `GET /api/db-status` */
export async function dbStatus(ctx: Ctx) {
  const status = await databaseStatus(ctx.db);
  return json(status, status.connected ? 200 : 503);
}

/** `GET /api/health`: 200 after a successful sync, else 503. `?db=1` adds a D1 ping. */
export async function health(ctx: Ctx) {
  const checkDb = ["1", "true"].includes(ctx.url.searchParams.get("db") ?? "");
  let lastSuccessAt: string | null = null;
  let lastError: string | null = null;
  try {
    const rows = await ctx.db.all<{ body: string }>("SELECT body FROM snapshots WHERE key = ?", [snapshotKeys.sync]);
    if (rows[0]?.body) {
      const sync = JSON.parse(rows[0].body) as { lastSuccessAt?: string | null; lastError?: string | null };
      lastSuccessAt = sync.lastSuccessAt ?? null;
      lastError = sync.lastError ?? null;
    }
  } catch (error) {
    lastError = error instanceof Error ? error.message : String(error);
  }
  const db = checkDb ? await databaseStatus(ctx.db) : undefined;
  return json({ ok: Boolean(lastSuccessAt), lastSuccessAt, lastError, ...(db ? { db } : {}) }, lastSuccessAt ? 200 : 503);
}
