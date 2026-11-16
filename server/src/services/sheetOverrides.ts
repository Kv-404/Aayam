import { cleanSpreadsheetId, type SheetSource } from "../config.ts";
import { ensureAdminSchema } from "./adminSchema.ts";
import { databaseUrl, getSql } from "./postgres.ts";

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

export async function readSheetOverrides(): Promise<StoredSheetLink[]> {
  if (!databaseUrl()) return [];
  await ensureAdminSchema();
  const sql = getSql();
  const rows = await sql<{ course: string; batch: string; spreadsheet_id: string }[]>`
    SELECT course, batch, spreadsheet_id FROM timetable_sheet_links
  `;
  return rows
    .filter((row) => row.course && row.batch && acceptSpreadsheetId(row.spreadsheet_id))
    .map((row) => ({ course: row.course, batch: row.batch, spreadsheetId: row.spreadsheet_id }));
}

export async function resolveSheetSources(fallback: SheetSource[]): Promise<SheetSource[]> {
  const now = Date.now();
  if (cache && now - cache.at < 3000) return cache.sources;
  let sources = fallback;
  try {
    const overrides = await readSheetOverrides();
    sources = mergeSheetOverrides(fallback, overrides);
  } catch {
    sources = fallback;
  }
  cache = { at: now, sources };
  return sources;
}

export async function writeSheetOverride(course: string, batch: string, spreadsheetId: string) {
  await ensureAdminSchema();
  const sql = getSql();
  await sql`
    INSERT INTO timetable_sheet_links (course, batch, spreadsheet_id, updated_at)
    VALUES (${course}, ${batch}, ${spreadsheetId}, now())
    ON CONFLICT (course, batch) DO UPDATE
      SET spreadsheet_id = EXCLUDED.spreadsheet_id, updated_at = now()
  `;
  clearSheetSourceCache();
}

export async function deleteSheetOverride(course: string, batch: string) {
  await ensureAdminSchema();
  const sql = getSql();
  await sql`
    DELETE FROM timetable_sheet_links
    WHERE lower(course) = lower(${course}) AND lower(batch) = lower(${batch})
  `;
  clearSheetSourceCache();
}
