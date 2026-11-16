import {
  readAllChanges,
  readHydratedWeekIds,
  readLectures,
  readSyncState,
  readUnhydratedWeekIds,
  readWeekBackups,
  replaceChangeRows,
  replaceLectures,
  replaceWeekBackups,
  upsertWeekBackups,
  writeSyncState,
  type AppDatabase,
  type WeekBackupRecord,
} from "../db.ts";
import { readNeonLiveRows, readNeonMeta, readNeonRows, readNeonWeeksByIds, writeNeonRows } from "./neonRows.ts";
import { databaseUrl, getSql } from "./postgres.ts";
import { getRedis } from "./redis.ts";
import { archiveSignature, mergeArchives, type TimetableArchive } from "./timetableArchive.ts";

let lastSignature = "";
const hydrating = new WeakMap<AppDatabase, Promise<boolean>>();

const ARCHIVE_LIVE_KEY = "archive:live";
const ARCHIVE_SIG_KEY = "archive:sig";
const ARCHIVE_VERSION_KEY = "archive:version";
const ARCHIVE_TTL_SECONDS = 24 * 60 * 60;

function weekKey(id: string) {
  return `archive:week:${id}`;
}

function neonUrl() {
  return databaseUrl();
}

interface CachedLiveArchive {
  archive: TimetableArchive;
  unhydratedWeekIds: string[];
}

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

export function importArchive(db: AppDatabase, archive: TimetableArchive, unhydratedWeekIds?: Set<string>) {
  db.exec("BEGIN");
  try {
    replaceLectures(db, archive.lectures);
    replaceChangeRows(db, archive.changes);
    replaceWeekBackups(db, archive.weeks ?? [], unhydratedWeekIds);
    writeSyncState(db, { ...archive.sync, bootstrapped: true });
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

function isArchive(value: unknown): value is TimetableArchive {
  if (!value || typeof value !== "object") return false;
  const archive = value as TimetableArchive;
  return archive.version === 1 && Array.isArray(archive.lectures) && Array.isArray(archive.changes) && Boolean(archive.sync);
}

function withWeekChanges(archive: TimetableArchive): TimetableArchive {
  return {
    ...archive,
    weeks: (archive.weeks ?? []).map((week) => ({ ...week, changes: week.changes ?? [] })),
  };
}

async function readBlobUpdatedAt(): Promise<string | null> {
  const dbUrl = neonUrl();
  if (!dbUrl) return null;
  try {
    const sql = getSql();
    const rows = await sql`
      SELECT updated_at::text AS updated_at FROM timetable_archive WHERE id = 'latest' LIMIT 1
    `;
    return rows?.[0]?.updated_at ? String(rows[0].updated_at) : null;
  } catch {
    return null;
  }
}

async function readBlob(): Promise<TimetableArchive | null> {
  const dbUrl = neonUrl();
  if (!dbUrl) return null;
  try {
    const sql = getSql();
    const rows = await sql`
      SELECT archive FROM timetable_archive WHERE id = 'latest' LIMIT 1
    `;
    if (rows && rows.length > 0 && rows[0]?.archive) {
      const raw = rows[0].archive;
      const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
      if (isArchive(parsed)) return withWeekChanges(parsed);
    }
  } catch (err) {
    console.error("[archive] read error:", err);
  }
  return null;
}

/**
 * Cold-start reader. Checks lightweight metadata first so we never download BOTH
 * the full JSONB blob and all historical SQL rows on a single miss.
 */
async function readRemoteForColdStart(): Promise<{ archive: TimetableArchive; unhydratedWeekIds: Set<string> } | null> {
  const [meta, blobUpdatedAt] = await Promise.all([readNeonMeta(), readBlobUpdatedAt()]);
  const metaTime = meta ? Date.parse(meta.sync.lastSuccessAt || meta.savedAt) : 0;
  const blobTime = blobUpdatedAt ? Date.parse(blobUpdatedAt) : 0;

  if (meta && (!blobUpdatedAt || metaTime >= blobTime || Number.isNaN(blobTime))) {
    const live = await readNeonLiveRows();
    if (live) return live;
  }

  const blob = await readBlob();
  if (blob) {
    return { archive: blob, unhydratedWeekIds: new Set<string>() };
  }

  const fullRows = await readNeonRows();
  if (fullRows) {
    return { archive: fullRows, unhydratedWeekIds: new Set<string>() };
  }
  return null;
}

async function writeBlob(archive: TimetableArchive) {
  const dbUrl = neonUrl();
  if (!dbUrl) return;
  const sql = getSql();
  const payload = JSON.stringify(archive);
  await sql`
    INSERT INTO timetable_archive (id, archive, updated_at)
    VALUES ('latest', ${payload}::jsonb, NOW())
    ON CONFLICT (id) DO UPDATE
    SET archive = EXCLUDED.archive, updated_at = NOW()
  `;
}

async function writeArchiveToRedis(archive: TimetableArchive, unhydratedWeekIds: Set<string>) {
  const redis = getRedis();
  try {
    const hydratedWeeks = (archive.weeks ?? []).filter((w) => !unhydratedWeekIds.has(w.id) && w.lectures.length > 0);
    const liveArchive: TimetableArchive = {
      ...archive,
      weeks: (archive.weeks ?? []).map((w) => ({
        id: w.id,
        course: w.course,
        batch: w.batch,
        start: w.start,
        end: w.end,
        lectures: [],
        changes: [],
      })),
    };
    await Promise.all([
      redis.setJson(
        ARCHIVE_LIVE_KEY,
        {
          archive: liveArchive,
          unhydratedWeekIds: (archive.weeks ?? []).map((w) => w.id),
        } satisfies CachedLiveArchive,
        ARCHIVE_TTL_SECONDS,
      ),
      redis.set(ARCHIVE_SIG_KEY, archiveSignature(archive), ARCHIVE_TTL_SECONDS),
      ...hydratedWeeks.map((week) => redis.setJson(weekKey(week.id), week, ARCHIVE_TTL_SECONDS)),
    ]);
  } catch (err) {
    console.error("[redis] archive write failed:", err);
  }
}

export async function bumpArchiveVersion(): Promise<string> {
  const version = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
  try {
    await getRedis().set(ARCHIVE_VERSION_KEY, version, ARCHIVE_TTL_SECONDS);
  } catch {
    // Ignore transient Redis issues on version bump.
  }
  return version;
}

export async function getArchiveVersion(): Promise<string> {
  try {
    const v = await getRedis().get(ARCHIVE_VERSION_KEY);
    if (v) return v;
  } catch {
    // Fall back cleanly.
  }
  return "v0";
}

/** On a cold start the local database is empty. Load from Redis first, falling back to Supabase only on cache miss. */
export function hydrateArchive(db: AppDatabase) {
  if (!neonUrl() || readSyncState(db).bootstrapped) return Promise.resolve(false);
  // Requests that arrive together share one read, so a late copy cannot overwrite a sync that has started.
  const running = hydrating.get(db);
  if (running) return running;
  const pending = loadRemoteArchive(db).finally(() => hydrating.delete(db));
  hydrating.set(db, pending);
  return pending;
}

async function loadRemoteArchive(db: AppDatabase) {
  const redis = getRedis();
  try {
    const cached = await redis.getJson<CachedLiveArchive>(ARCHIVE_LIVE_KEY);
    if (cached?.archive?.sync?.bootstrapped) {
      const unhydrated = new Set(cached.unhydratedWeekIds ?? []);
      importArchive(db, cached.archive, unhydrated);
      lastSignature = archiveSignature(cached.archive);
      return true;
    }
  } catch (err) {
    console.error("[redis] archive read failed, falling back to Postgres:", err);
  }

  const loaded = await readRemoteForColdStart();
  if (!loaded?.archive?.sync.bootstrapped) return false;
  importArchive(db, loaded.archive, loaded.unhydratedWeekIds);
  lastSignature = archiveSignature(loaded.archive);
  await writeArchiveToRedis(loaded.archive, loaded.unhydratedWeekIds);
  console.log("[sync] loaded saved timetable history");
  return true;
}

/** Hydrates specific past week backups into SQLite on demand: checks Redis first, then Supabase. */
export async function ensureWeeksHydrated(db: AppDatabase, weekIds: string[]): Promise<void> {
  if (weekIds.length === 0) return;
  const missing = readUnhydratedWeekIds(db, weekIds);
  if (missing.length === 0) return;

  const redis = getRedis();
  const stillMissing: string[] = [];
  const resolved: WeekBackupRecord[] = [];

  await Promise.all(
    missing.map(async (id) => {
      try {
        const cached = await redis.getJson<WeekBackupRecord>(weekKey(id));
        if (cached && Array.isArray(cached.lectures)) {
          resolved.push({ ...cached, changes: cached.changes ?? [] });
          return;
        }
      } catch {
        // Fall through to Supabase.
      }
      stillMissing.push(id);
    }),
  );

  if (stillMissing.length > 0 && neonUrl()) {
    let fromRows = await readNeonWeeksByIds(stillMissing);
    const foundIds = new Set(fromRows.map((w) => w.id));
    const unresolvedIds = stillMissing.filter((id) => !foundIds.has(id));
    if (unresolvedIds.length > 0) {
      const blob = await readBlob();
      const fromBlob = (blob?.weeks ?? []).filter((w) => unresolvedIds.includes(w.id));
      fromRows = [...fromRows, ...fromBlob];
    }
    for (const week of fromRows) {
      resolved.push(week);
      try {
        await redis.setJson(weekKey(week.id), week, ARCHIVE_TTL_SECONDS);
      } catch {
        // Ignore Redis write error on warm.
      }
    }
  }

  if (resolved.length > 0) {
    upsertWeekBackups(db, resolved, true);
  }
}

async function resolveAllWeeksForBlob(archive: TimetableArchive, hydratedIds: Set<string>): Promise<WeekBackupRecord[]> {
  const weeks = archive.weeks ?? [];
  const missingIds = weeks.filter((w) => !hydratedIds.has(w.id) && w.lectures.length === 0).map((w) => w.id);
  if (missingIds.length === 0) return weeks;

  const redis = getRedis();
  const byId = new Map(weeks.map((w) => [w.id, w]));
  const fetchFromPg: string[] = [];

  await Promise.all(
    missingIds.map(async (id) => {
      try {
        const cached = await redis.getJson<WeekBackupRecord>(weekKey(id));
        if (cached && cached.lectures.length > 0) {
          byId.set(id, { ...cached, changes: cached.changes ?? [] });
          return;
        }
      } catch {
        // Fall back to Postgres.
      }
      fetchFromPg.push(id);
    }),
  );

  if (fetchFromPg.length > 0 && neonUrl()) {
    const pgWeeks = await readNeonWeeksByIds(fetchFromPg);
    for (const week of pgWeeks) {
      byId.set(week.id, week);
      try {
        await redis.setJson(weekKey(week.id), week, ARCHIVE_TTL_SECONDS);
      } catch {
        // Ignore.
      }
    }
  }

  return [...byId.values()];
}

/** Writes the timetable and its change log so the next cold start still knows which lectures were removed. */
export async function publishArchive(db: AppDatabase) {
  if (!neonUrl() || !readSyncState(db).bootstrapped) return false;
  const local = exportArchive(db);
  const localSig = archiveSignature(local);
  if (localSig === lastSignature) return false;

  const redis = getRedis();
  try {
    const cachedSig = await redis.get(ARCHIVE_SIG_KEY);
    if (cachedSig && cachedSig === localSig) {
      lastSignature = localSig;
      return false;
    }
  } catch {
    // Continue if Redis is unavailable.
  }

  let merged = local;
  const remoteMeta = await readNeonMeta();
  const remoteNewer =
    remoteMeta &&
    (remoteMeta.sync.lastSuccessAt ?? "") > (local.sync.lastSuccessAt ?? "") &&
    remoteMeta.sync.contentHash !== local.sync.contentHash;
  if (remoteNewer) {
    const remoteLive = await readNeonLiveRows();
    if (remoteLive) {
      merged = mergeArchives(remoteLive.archive, local);
      if (archiveSignature(merged) !== localSig) {
        importArchive(db, merged, remoteLive.unhydratedWeekIds);
      }
    }
  }

  const signature = archiveSignature(merged);
  merged.savedAt = new Date().toISOString();
  const hydratedIds = readHydratedWeekIds(db);

  // Update Redis immediately so concurrent cold starts never hit Postgres.
  const unhydratedSet = new Set(
    (merged.weeks ?? []).filter((w) => !hydratedIds.has(w.id) && w.lectures.length === 0).map((w) => w.id),
  );
  await writeArchiveToRedis(merged, unhydratedSet);
  await bumpArchiveVersion();

  try {
    await writeNeonRows(merged, hydratedIds);
  } catch (err) {
    console.error("[archive] row write error:", err);
  }
  try {
    const fullWeeks = await resolveAllWeeksForBlob(merged, hydratedIds);
    await writeBlob({ ...merged, weeks: fullWeeks });
    console.log("[sync] saved timetable history");
  } catch (err) {
    console.error("[archive] write error:", err);
  }
  lastSignature = signature;
  return true;
}

export function resetArchiveSignatureForTests() {
  lastSignature = "";
}
