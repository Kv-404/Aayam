import { neon } from "@neondatabase/serverless";
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
} from "../db.ts";
import { archiveSignature, mergeArchives, type TimetableArchive } from "./timetableArchive.ts";

let lastSignature = "";

function neonUrl() {
  return process.env.DATABASE_URL?.trim() || "";
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

function isArchive(value: unknown): value is TimetableArchive {
  if (!value || typeof value !== "object") return false;
  const archive = value as TimetableArchive;
  return archive.version === 1 && Array.isArray(archive.lectures) && Array.isArray(archive.changes) && Boolean(archive.sync);
}

async function readRemote(): Promise<TimetableArchive | null> {
  const dbUrl = neonUrl();
  if (!dbUrl) return null;
  try {
    const sql = neon(dbUrl);
    const rows = await sql`
      SELECT archive FROM timetable_archive WHERE id = 'latest' LIMIT 1
    `;
    if (rows && rows.length > 0 && rows[0]?.archive) {
      const raw = rows[0].archive;
      const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
      if (isArchive(parsed)) {
        return parsed;
      }
    }
  } catch (err) {
    console.error("[archive] Neon read error:", err);
  }
  return null;
}

/** On a cold start the local database is empty. Load the last saved timetable before comparing the sheet. */
export async function hydrateArchive(db: AppDatabase) {
  if (!neonUrl() || readSyncState(db).bootstrapped) return false;
  const archive = await readRemote();
  if (!archive?.sync.bootstrapped) return false;
  importArchive(db, archive);
  lastSignature = archiveSignature(archive);
  console.log("[sync] loaded saved timetable history from Neon");
  return true;
}

/** Writes the timetable and its change log so the next cold start still knows which lectures were removed. */
export async function publishArchive(db: AppDatabase) {
  if (!neonUrl() || !readSyncState(db).bootstrapped) return false;
  const local = exportArchive(db);
  if (archiveSignature(local) === lastSignature) return false;
  const remote = await readRemote();
  const merged = remote ? mergeArchives(remote, local) : local;
  if (archiveSignature(merged) !== archiveSignature(local)) importArchive(db, merged);
  const signature = archiveSignature(merged);
  if (remote && signature === archiveSignature(remote)) {
    lastSignature = signature;
    return false;
  }
  merged.savedAt = new Date().toISOString();

  const dbUrl = neonUrl();
  if (dbUrl) {
    try {
      const sql = neon(dbUrl);
      const payload = JSON.stringify(merged);
      await sql`
        INSERT INTO timetable_archive (id, archive, updated_at)
        VALUES ('latest', ${payload}::jsonb, NOW())
        ON CONFLICT (id) DO UPDATE 
        SET archive = EXCLUDED.archive, updated_at = NOW()
      `;
      console.log("[sync] saved timetable history to Neon");
    } catch (err) {
      console.error("[archive] Neon write error:", err);
    }
  }
  lastSignature = signature;
  return true;
}
