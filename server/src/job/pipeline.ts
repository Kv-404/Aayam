import fs from "node:fs";
import path from "node:path";
import { primarySheetId, type AppConfig, type SheetSource } from "../config.ts";
import { openDatabase, readSyncState, type AppDatabase } from "../db.ts";
import type { SqlDb } from "../d1/sql.ts";
import { programKey } from "../program.ts";
import { fetchSpreadsheet } from "../services/googleSheetsService.ts";
import { persistCancelledRemovals } from "../services/persistCancelled.ts";
import { resolveSheetSources } from "../services/sheetOverrides.ts";
import { runSync, type SyncOutcome, type WorkbookFile } from "../services/syncScheduler.ts";
import { loadSnapshot } from "../services/timetableSnapshotService.ts";
import { ensurePublishedTable, hydrateFromD1, publishToD1, readRemoteSync, type PublishResult } from "./archive.ts";
import { sendPendingPushes, type PushResult } from "./pushes.ts";
import { renderSnapshots, writeSnapshots, type SnapshotWrite } from "./snapshots.ts";

/**
 * One sync job run: hydrate the working database if D1 moved on, sync every sheet, publish the archive
 * diff, render and write snapshots, send queued pushes, and record `job_state.finished_at`.
 */

export interface JobOptions {
  sql: SqlDb;
  /** Which D1 this is. The working-database cache is only reused for the same one. */
  databaseKey: string;
  config: AppConfig;
  /** Holds `job.sqlite` and `job-meta.json`. Null keeps the working database in memory (tests). */
  dataDir: string | null;
  /** Reuse an open working database (tests, `--watch`). */
  workingDb?: AppDatabase;
  download?: (source: SheetSource) => Promise<Buffer>;
  now?: () => Date;
  log?: (line: string) => void;
}

export interface JobResult {
  ok: boolean;
  hydrated: boolean;
  sync: SyncOutcome | null;
  archive: PublishResult | null;
  snapshots: SnapshotWrite | null;
  pushes: PushResult | null;
  timings: Record<string, number>;
  error: string | null;
}

interface JobMeta {
  revision: number;
  database: string;
  contentHash: string | null;
}

/** Meta for a working database with no data dir (tests). */
const memoryMeta = new WeakMap<AppDatabase, JobMeta>();

function readMeta(file: string): JobMeta | null {
  try {
    const meta = JSON.parse(fs.readFileSync(file, "utf8")) as JobMeta;
    return typeof meta.revision === "number" ? meta : null;
  } catch {
    return null;
  }
}

function writeMeta(file: string, meta: JobMeta) {
  fs.writeFileSync(file, `${JSON.stringify(meta)}\n`);
}

export function openWorkingDb(dataDir: string | null): AppDatabase {
  if (!dataDir) {
    const db = openDatabase(":memory:");
    ensurePublishedTable(db);
    return db;
  }
  fs.mkdirSync(dataDir, { recursive: true });
  const db = openDatabase(path.join(dataDir, "job.sqlite"));
  // One file, so the Actions cache never holds a half-written WAL.
  db.exec("PRAGMA journal_mode = DELETE;");
  ensurePublishedTable(db);
  return db;
}

/** A program whose stored lectures all came from another workbook: an admin pointed it at a new sheet. */
function replacedSources(db: AppDatabase, sources: SheetSource[]) {
  const previous = loadSnapshot(db);
  return sources.filter((source) => {
    if (!source.batch) return false;
    const key = programKey(source.course, source.batch);
    const ids = new Set(previous.filter((lecture) => programKey(lecture.course, lecture.batch) === key).map((lecture) => lecture.spreadsheetId).filter(Boolean));
    return ids.size > 0 && !ids.has(source.id);
  });
}

export async function runJob(options: JobOptions): Promise<JobResult> {
  const log = options.log ?? ((line: string) => console.log(line));
  const now = options.now ?? (() => new Date());
  const timings: Record<string, number> = {};
  const started = performance.now();
  let mark = started;
  const lap = (name: string) => {
    const at = performance.now();
    timings[name] = Math.round(at - mark);
    mark = at;
  };
  const result: JobResult = { ok: false, hydrated: false, sync: null, archive: null, snapshots: null, pushes: null, timings, error: null };
  const metaFile = options.dataDir ? path.join(options.dataDir, "job-meta.json") : null;
  const db = options.workingDb ?? openWorkingDb(options.dataDir);
  const sql = options.sql;

  try {
    // 1. Hydrate when D1 is not the revision this working database last saw.
    const remote = await readRemoteSync(sql);
    const meta = metaFile ? readMeta(metaFile) : memoryMeta.get(db) ?? null;
    const saveMeta = (revision: number) => {
      const next = { revision, database: options.databaseKey, contentHash: readSyncState(db).contentHash };
      if (metaFile) writeMeta(metaFile, next);
      else memoryMeta.set(db, next);
    };
    const local = readSyncState(db);
    const cacheGood = Boolean(
      remote &&
      meta &&
      meta.database === options.databaseKey &&
      meta.revision === remote.revision &&
      local.bootstrapped === remote.bootstrapped &&
      local.contentHash === remote.contentHash,
    );
    let revision = remote?.revision ?? 0;
    if (!cacheGood) {
      revision = await hydrateFromD1(sql, db);
      result.hydrated = true;
      saveMeta(revision);
    }
    lap("hydrate");

    // 2. Sync every sheet. A download failure keeps the last good copy and records lastError.
    //    Sheets come only from D1 `timetable_sheet_links`. A batch with no row is skipped and keeps its last copy.
    const { sources, missing } = await resolveSheetSources(sql);
    for (const template of missing) log(`[job] no sheet link in D1 for ${template.course} ${template.batch}; skipping it`);
    const config: AppConfig = {
      ...options.config,
      spreadsheets: sources,
      spreadsheetId: primarySheetId(sources),
    };
    const download = options.download ?? (async (source: SheetSource) => (await fetchSpreadsheet({ spreadsheetId: source.id })).buffer);
    const files = new Map<string, Promise<Buffer>>();
    const fetchOnce = (source: SheetSource) => {
      let pending = files.get(source.id);
      if (!pending) {
        pending = download(source).catch((error) => {
          const message = error instanceof Error ? error.message : "The spreadsheet could not be read.";
          throw new Error(`${source.course}: ${message}`);
        });
        pending.catch(() => undefined);
        files.set(source.id, pending);
      }
      return pending;
    };
    for (const source of sources) fetchOnce(source);
    const syncNow = now();
    for (const source of replacedSources(db, sources)) {
      log(`[job] ${source.course} ${source.batch} moved to sheet ${source.id}`);
      let buffer: Buffer;
      try {
        buffer = await fetchOnce(source);
      } catch {
        continue;
      }
      await runSync({
        db,
        now: syncNow,
        config: { ...config, spreadsheetId: source.id, courseName: source.course },
        load: async () => ({ buffer }),
        loadAll: async () => [{ buffer, course: source.course, spreadsheetId: source.id }],
        replaceProgram: { course: source.course, batch: source.batch! },
      });
    }
    if (sources.length > 0) {
      result.sync = await runSync({
        db,
        now: syncNow,
        config,
        load: async () => ({ buffer: await fetchOnce(sources[0]!) }),
        loadAll: async () =>
          Promise.all(sources.map(async (source): Promise<WorkbookFile> => ({ buffer: await fetchOnce(source), course: source.course, spreadsheetId: source.id }))),
      });
      if (!result.sync.ok) log(`[job] sync failed, keeping the last copy: ${result.sync.error}`);
    } else {
      log("[job] no sheet links in D1; nothing to sync");
    }
    persistCancelledRemovals(db);
    lap("sync");

    // 3. Archive rows that changed.
    result.archive = await publishToD1(sql, db, revision);
    saveMeta(result.archive.revision);
    lap("archive");

    // 4. Every API response.
    const rendered = renderSnapshots(db, config, now());
    lap("render");
    result.snapshots = await writeSnapshots(sql, rendered, now());
    lap("snapshots");

    // 5. Queued notices.
    try {
      result.pushes = await sendPendingPushes(sql, now());
    } catch (error) {
      log(`[job] push failed: ${error instanceof Error ? error.message : error}`);
    }
    lap("pushes");
    result.ok = true;
  } catch (error) {
    result.error = error instanceof Error ? error.message : String(error);
    log(`[job] failed: ${result.error}`);
  } finally {
    try {
      await sql.run([{ sql: "UPDATE job_state SET finished_at = ? WHERE id = 1", params: [now().toISOString()] }]);
    } catch (error) {
      log(`[job] could not record finished_at: ${error instanceof Error ? error.message : error}`);
      result.ok = false;
    }
    timings.total = Math.round(performance.now() - started);
  }
  const s = result.snapshots;
  const a = result.archive;
  log(
    `[job] ${result.ok ? "done" : "FAILED"} in ${timings.total} ms` +
      ` (hydrate ${timings.hydrate ?? "-"}${result.hydrated ? "*" : ""}, sync ${timings.sync ?? "-"}, archive ${timings.archive ?? "-"}, render ${timings.render ?? "-"}, write ${timings.snapshots ?? "-"}, push ${timings.pushes ?? "-"})` +
      (result.sync ? ` sync=${result.sync.ok ? (result.sync.unchanged ? "unchanged" : `${result.sync.changeCount} changes`) : "error"}` : "") +
      (a ? ` archive=+${a.upserted}/-${a.deleted} rev ${a.revision}` : "") +
      (s ? ` snapshots=${s.written}/${s.total} written, ${s.deleted} deleted, ${(s.bytes / 1024).toFixed(0)} KB` : "") +
      (result.pushes?.notices ? ` pushes=${result.pushes.delivered} to ${result.pushes.notices} notices` : ""),
  );
  return result;
}
