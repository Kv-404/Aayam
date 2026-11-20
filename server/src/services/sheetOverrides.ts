import { sheetSources, type CohortSheetTemplate, type SheetLinkRow, type SheetSource } from "../config.ts";
import type { SqlDb } from "../d1/sql.ts";

/** Every row in D1 `timetable_sheet_links`, the only place sheet links live. */
export async function readSheetLinks(sql: SqlDb): Promise<SheetLinkRow[]> {
  return sql.all<SheetLinkRow>("SELECT course, batch, spreadsheet_id FROM timetable_sheet_links");
}

/** The sheets to sync, from D1 only. A batch with no valid row is reported in `missing` and skipped. */
export async function resolveSheetSources(sql: SqlDb): Promise<{ sources: SheetSource[]; missing: CohortSheetTemplate[] }> {
  return sheetSources(await readSheetLinks(sql));
}

/** Store (or replace) one batch's link. The admin route writes the same row from the Worker. */
export async function writeSheetLink(course: string, batch: string, spreadsheetId: string, sql: SqlDb) {
  await sql.run([
    {
      sql: `INSERT INTO timetable_sheet_links (course, batch, spreadsheet_id, updated_at)
        VALUES (?, ?, ?, ?)
        ON CONFLICT (course, batch) DO UPDATE
          SET spreadsheet_id = excluded.spreadsheet_id, updated_at = excluded.updated_at`,
      params: [course, batch, spreadsheetId, new Date().toISOString()],
    },
  ]);
}
