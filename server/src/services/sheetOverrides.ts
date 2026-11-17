import { cleanSpreadsheetId, type SheetSource } from "../config.ts";
import type { SqlDb } from "../d1/sql.ts";

const SHEET_ID = /^[a-zA-Z0-9-_]{20,80}$/;

/** A Google Sheet link or a bare id. Anything else is refused. */
export function acceptSpreadsheetId(input: string): string | null {
  const id = cleanSpreadsheetId(input);
  if (!SHEET_ID.test(id)) return null;
  return id;
}

export function mergeSheetOverrides(
  sources: SheetSource[],
  overrides: Array<{ course: string; batch: string; spreadsheetId: string }>,
): SheetSource[] {
  return sources.map((source) => {
    const hit = overrides.find(
      (row) =>
        row.course.trim().toLowerCase() === source.course.trim().toLowerCase() &&
        (source.batch ?? "").trim().toLowerCase() === row.batch.trim().toLowerCase() &&
        acceptSpreadsheetId(row.spreadsheetId),
    );
    if (!hit) return source;
    return { ...source, id: hit.spreadsheetId };
  });
}

export interface StoredSheetLink {
  course: string;
  batch: string;
  spreadsheetId: string;
}

let cache: { at: number; sources: SheetSource[] } | null = null;

export function clearSheetSourceCache() {
  cache = null;
}

/** Admin sheet links from D1 `timetable_sheet_links`. No database means no overrides. */
export async function readSheetOverrides(sql?: SqlDb): Promise<StoredSheetLink[]> {
  if (!sql) return [];
  const rows = await sql.all<{ course: string; batch: string; spreadsheet_id: string }>(
    "SELECT course, batch, spreadsheet_id FROM timetable_sheet_links",
  );
  return rows
    .filter((row) => row.course && row.batch && acceptSpreadsheetId(row.spreadsheet_id))
    .map((row) => ({ course: row.course, batch: row.batch, spreadsheetId: row.spreadsheet_id }));
}

/** The configured sheets with any admin replacement applied. A failed read keeps the configured sheets. */
export async function resolveSheetSources(fallback: SheetSource[], sql?: SqlDb): Promise<SheetSource[]> {
  const now = Date.now();
  if (cache && now - cache.at < 3000) return cache.sources;
  let sources = fallback;
  try {
    sources = mergeSheetOverrides(fallback, await readSheetOverrides(sql));
  } catch (error) {
    console.warn("[sheets] could not read sheet links:", error instanceof Error ? error.message : error);
    sources = fallback;
  }
  cache = { at: now, sources };
  return sources;
}

function requireDb(sql: SqlDb | undefined): SqlDb {
  if (!sql) throw new Error("Sheet links need the database.");
  return sql;
}

export async function writeSheetOverride(course: string, batch: string, spreadsheetId: string, sql?: SqlDb) {
  await requireDb(sql).run([
    {
      sql: `INSERT INTO timetable_sheet_links (course, batch, spreadsheet_id, updated_at)
        VALUES (?, ?, ?, ?)
        ON CONFLICT (course, batch) DO UPDATE
          SET spreadsheet_id = excluded.spreadsheet_id, updated_at = excluded.updated_at`,
      params: [course, batch, spreadsheetId, new Date().toISOString()],
    },
  ]);
  clearSheetSourceCache();
}

export async function deleteSheetOverride(course: string, batch: string, sql?: SqlDb) {
  await requireDb(sql).run([
    {
      sql: "DELETE FROM timetable_sheet_links WHERE lower(course) = lower(?) AND lower(batch) = lower(?)",
      params: [course, batch],
    },
  ]);
  clearSheetSourceCache();
}
