import fs from "node:fs";
import path from "node:path";
import { neon } from "@neondatabase/serverless";

const NEON_URL = process.env.DATABASE_URL || "";
if (!NEON_URL) {
  console.error("DATABASE_URL is required to export from Neon.");
  process.exit(1);
}

async function exportAll() {
  console.log("Connecting to Neon to export all data...");
  const sql = neon(NEON_URL);

  const batch_access_codes = await sql`SELECT * FROM batch_access_codes ORDER BY id`;
  const faculty_directory = await sql`SELECT * FROM faculty_directory ORDER BY id`;
  const faculty_sessions = await sql`SELECT * FROM faculty_sessions`;
  const timetable_sync = await sql`SELECT * FROM timetable_sync`;
  const timetable_weeks = await sql`SELECT * FROM timetable_weeks ORDER BY id`;
  const timetable_changes = await sql`SELECT * FROM timetable_changes ORDER BY id`;
  const timetable_archive = await sql`SELECT * FROM timetable_archive`;
  const timetable_lectures = await sql`SELECT * FROM timetable_lectures`;

  const exportData = {
    exportedAt: new Date().toISOString(),
    batch_access_codes,
    faculty_directory,
    faculty_sessions,
    timetable_sync,
    timetable_weeks,
    timetable_changes,
    timetable_archive,
    timetable_lectures,
  };

  const outDir = path.resolve(process.cwd(), "data");
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  const outPath = path.join(outDir, "neon_export.json");
  fs.writeFileSync(outPath, JSON.stringify(exportData, null, 2), "utf-8");
  console.log(`Successfully exported Neon data to ${outPath}`);
  console.log({
    batch_access_codes: batch_access_codes.length,
    faculty_directory: faculty_directory.length,
    faculty_sessions: faculty_sessions.length,
    timetable_sync: timetable_sync.length,
    timetable_weeks: timetable_weeks.length,
    timetable_changes: timetable_changes.length,
    timetable_archive: timetable_archive.length,
    timetable_lectures: timetable_lectures.length,
  });
}

exportAll().catch((err) => {
  console.error("Export failed:", err);
  process.exit(1);
});
