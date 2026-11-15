import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SUPABASE_URL = process.env.SUPABASE_URL || "";
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY || "";

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables are required.");
  process.exit(1);
}

export async function seedSupabase() {
  console.log(`Connecting to Supabase at ${SUPABASE_URL}...`);
  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: { persistSession: false },
  });

  // Verify connection by checking if table exists
  const testCheck = await supabase.from("batch_access_codes").select("count", { count: "exact", head: true });
  if (testCheck.error) {
    if (testCheck.error.code === "PGRST205") {
      console.error("\n❌ Tables do not exist yet in Supabase!");
      console.error("Please run the SQL schema in server/data/supabase_schema.sql first via the Supabase SQL editor at:");
      console.error(`https://supabase.com/dashboard/project/rdykolxvwbopkhsblggy/sql`);
      return false;
    }
    console.error("Supabase connection check error:", testCheck.error);
    return false;
  }

  const exportPath = path.resolve(__dirname, "../data/neon_export.json");
  if (!fs.existsSync(exportPath)) {
    throw new Error(`Export file not found at ${exportPath}`);
  }

  const data = JSON.parse(fs.readFileSync(exportPath, "utf-8"));
  console.log(`Loaded data from ${exportPath}`);

  // 1. batch_access_codes
  if (data.batch_access_codes?.length) {
    console.log(`Upserting ${data.batch_access_codes.length} batch access codes...`);
    const { error } = await supabase.from("batch_access_codes").upsert(data.batch_access_codes);
    if (error) throw new Error(`batch_access_codes error: ${error.message}`);
  }

  // 2. faculty_directory
  if (data.faculty_directory?.length) {
    console.log(`Upserting ${data.faculty_directory.length} faculty directory rows...`);
    const { error } = await supabase.from("faculty_directory").upsert(data.faculty_directory);
    if (error) throw new Error(`faculty_directory error: ${error.message}`);
  }

  // 3. timetable_sync
  if (data.timetable_sync?.length) {
    console.log(`Upserting timetable_sync...`);
    const { error } = await supabase.from("timetable_sync").upsert(data.timetable_sync);
    if (error) throw new Error(`timetable_sync error: ${error.message}`);
  }

  // 4. timetable_weeks
  if (data.timetable_weeks?.length) {
    console.log(`Upserting ${data.timetable_weeks.length} timetable_weeks...`);
    const { error } = await supabase.from("timetable_weeks").upsert(data.timetable_weeks);
    if (error) throw new Error(`timetable_weeks error: ${error.message}`);
  }

  // 5. timetable_changes
  if (data.timetable_changes?.length) {
    console.log(`Upserting ${data.timetable_changes.length} timetable_changes in chunks...`);
    const chunkSize = 200;
    for (let i = 0; i < data.timetable_changes.length; i += chunkSize) {
      const chunk = data.timetable_changes.slice(i, i + chunkSize);
      const { error } = await supabase.from("timetable_changes").upsert(chunk);
      if (error) throw new Error(`timetable_changes chunk error: ${error.message}`);
    }
  }

  // 6. timetable_archive
  if (data.timetable_archive?.length) {
    console.log(`Upserting timetable_archive...`);
    const { error } = await supabase.from("timetable_archive").upsert(data.timetable_archive);
    if (error) throw new Error(`timetable_archive error: ${error.message}`);
  }

  // 7. timetable_lectures
  if (data.timetable_lectures?.length) {
    console.log(`Upserting ${data.timetable_lectures.length} timetable_lectures in chunks...`);
    const chunkSize = 200;
    for (let i = 0; i < data.timetable_lectures.length; i += chunkSize) {
      const chunk = data.timetable_lectures.slice(i, i + chunkSize);
      const { error } = await supabase.from("timetable_lectures").upsert(chunk);
      if (error) throw new Error(`timetable_lectures chunk error: ${error.message}`);
    }
  }

  console.log("\n✅ All data successfully seeded into Supabase!");
  return true;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  seedSupabase().catch((err) => {
    console.error("Seeding failed:", err);
    process.exit(1);
  });
}
