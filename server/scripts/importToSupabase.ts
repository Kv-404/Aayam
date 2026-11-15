import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function runMigration(targetUrl: string) {
  if (!targetUrl) {
    throw new Error("Target database URL is required.");
  }

  // Dynamically import pg or postgres
  const { Pool } = await import("pg").catch(() => {
    throw new Error("Please install pg or pass a client");
  });

  const pool = new Pool({
    connectionString: targetUrl,
    ssl: targetUrl.includes("localhost") ? false : { rejectUnauthorized: false },
  });

  console.log("Connecting to target database...");
  const client = await pool.connect();

  try {
    console.log("Creating tables and indexes...");

    await client.query(`
      CREATE TABLE IF NOT EXISTS batch_access_codes (
        id SERIAL PRIMARY KEY,
        course VARCHAR(100) NOT NULL,
        batch VARCHAR(100) NOT NULL,
        pin VARCHAR(10) NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_batch_access_codes_pin ON batch_access_codes(pin);

      CREATE TABLE IF NOT EXISTS faculty_directory (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) NOT NULL UNIQUE,
        faculty_name VARCHAR(255) NOT NULL,
        program VARCHAR(100) DEFAULT 'BTech',
        is_active BOOLEAN DEFAULT TRUE,
        last_login_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        can_see_all_faculty BOOLEAN DEFAULT FALSE
      );
      CREATE INDEX IF NOT EXISTS idx_faculty_directory_email ON faculty_directory(LOWER(email));

      CREATE TABLE IF NOT EXISTS faculty_sessions (
        id VARCHAR(255) PRIMARY KEY,
        faculty_id INTEGER REFERENCES faculty_directory(id) ON DELETE CASCADE,
        email VARCHAR(255) NOT NULL,
        user_agent TEXT,
        ip_address VARCHAR(100),
        expires_at TIMESTAMPTZ NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS timetable_sync (
        id SMALLINT PRIMARY KEY CHECK (id = 1),
        saved_at TEXT NOT NULL,
        last_success_at TEXT,
        last_attempt_at TEXT,
        last_error TEXT,
        bootstrapped BOOLEAN NOT NULL,
        content_hash TEXT,
        tab_names JSONB NOT NULL,
        parse_issues JSONB NOT NULL,
        spreadsheet_title TEXT
      );

      CREATE TABLE IF NOT EXISTS timetable_weeks (
        id TEXT PRIMARY KEY,
        course TEXT NOT NULL,
        batch TEXT NOT NULL,
        start_date TEXT NOT NULL,
        end_date TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS timetable_changes (
        id INTEGER NOT NULL,
        week_id TEXT NOT NULL DEFAULT 'live',
        dedupe_key TEXT NOT NULL,
        detected_at TEXT NOT NULL,
        type TEXT NOT NULL,
        lecture_id TEXT,
        division TEXT,
        course TEXT,
        semester TEXT,
        tab_name TEXT,
        date TEXT,
        weekday TEXT,
        summary TEXT NOT NULL,
        previous JSONB,
        next JSONB,
        fields JSONB NOT NULL DEFAULT '[]'::jsonb,
        PRIMARY KEY (week_id, id),
        UNIQUE (week_id, dedupe_key)
      );

      CREATE TABLE IF NOT EXISTS timetable_lectures (
        week_id TEXT NOT NULL,
        id TEXT NOT NULL,
        slot_key TEXT NOT NULL,
        tab_name TEXT NOT NULL,
        course TEXT NOT NULL,
        semester TEXT NOT NULL,
        batch TEXT NOT NULL,
        division TEXT NOT NULL,
        date TEXT,
        weekday TEXT NOT NULL,
        start_minutes INTEGER NOT NULL,
        end_minutes INTEGER NOT NULL,
        start_label TEXT NOT NULL,
        end_label TEXT NOT NULL,
        subject TEXT NOT NULL,
        faculty TEXT NOT NULL,
        room TEXT NOT NULL,
        kind TEXT NOT NULL,
        source_status TEXT NOT NULL,
        reason TEXT,
        explicit_mark TEXT,
        recurring BOOLEAN NOT NULL,
        spreadsheet_id TEXT,
        anchor JSONB NOT NULL,
        highlight JSONB,
        PRIMARY KEY (week_id, id)
      );

      CREATE TABLE IF NOT EXISTS timetable_archive (
        id VARCHAR(50) PRIMARY KEY,
        archive JSONB NOT NULL,
        updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      );
    `);

    console.log("Tables created successfully.");

    // Read export data
    const exportPath = path.resolve(__dirname, "../data/neon_export.json");
    if (!fs.existsSync(exportPath)) {
      throw new Error(`Export file not found at ${exportPath}`);
    }

    const data = JSON.parse(fs.readFileSync(exportPath, "utf-8"));
    console.log(`Loading export data from ${exportPath}...`);

    await client.query("BEGIN");

    // 1. batch_access_codes
    if (data.batch_access_codes?.length) {
      console.log(`Inserting ${data.batch_access_codes.length} batch access codes...`);
      for (const row of data.batch_access_codes) {
        await client.query(
          `INSERT INTO batch_access_codes (id, course, batch, pin, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6)
           ON CONFLICT (id) DO UPDATE SET
             course = EXCLUDED.course,
             batch = EXCLUDED.batch,
             pin = EXCLUDED.pin,
             updated_at = EXCLUDED.updated_at`,
          [row.id, row.course, row.batch, row.pin, row.created_at, row.updated_at]
        );
      }
      await client.query(`SELECT setval('batch_access_codes_id_seq', (SELECT MAX(id) FROM batch_access_codes))`);
    }

    // 2. faculty_directory
    if (data.faculty_directory?.length) {
      console.log(`Inserting ${data.faculty_directory.length} faculty members...`);
      for (const row of data.faculty_directory) {
        await client.query(
          `INSERT INTO faculty_directory (id, email, faculty_name, program, is_active, last_login_at, created_at, can_see_all_faculty)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
           ON CONFLICT (id) DO UPDATE SET
             email = EXCLUDED.email,
             faculty_name = EXCLUDED.faculty_name,
             program = EXCLUDED.program,
             is_active = EXCLUDED.is_active,
             last_login_at = EXCLUDED.last_login_at,
             can_see_all_faculty = EXCLUDED.can_see_all_faculty`,
          [row.id, row.email, row.faculty_name, row.program, row.is_active, row.last_login_at, row.created_at, row.can_see_all_faculty]
        );
      }
      await client.query(`SELECT setval('faculty_directory_id_seq', (SELECT MAX(id) FROM faculty_directory))`);
    }

    // 3. timetable_sync
    if (data.timetable_sync?.length) {
      console.log(`Inserting timetable_sync...`);
      for (const row of data.timetable_sync) {
        await client.query(
          `INSERT INTO timetable_sync (id, saved_at, last_success_at, last_attempt_at, last_error, bootstrapped, content_hash, tab_names, parse_issues, spreadsheet_title)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
           ON CONFLICT (id) DO UPDATE SET
             saved_at = EXCLUDED.saved_at,
             last_success_at = EXCLUDED.last_success_at,
             last_attempt_at = EXCLUDED.last_attempt_at,
             last_error = EXCLUDED.last_error,
             bootstrapped = EXCLUDED.bootstrapped,
             content_hash = EXCLUDED.content_hash,
             tab_names = EXCLUDED.tab_names,
             parse_issues = EXCLUDED.parse_issues,
             spreadsheet_title = EXCLUDED.spreadsheet_title`,
          [row.id, row.saved_at, row.last_success_at, row.last_attempt_at, row.last_error, row.bootstrapped, row.content_hash, JSON.stringify(row.tab_names), JSON.stringify(row.parse_issues), row.spreadsheet_title]
        );
      }
    }

    // 4. timetable_weeks
    if (data.timetable_weeks?.length) {
      console.log(`Inserting ${data.timetable_weeks.length} timetable weeks...`);
      for (const row of data.timetable_weeks) {
        await client.query(
          `INSERT INTO timetable_weeks (id, course, batch, start_date, end_date)
           VALUES ($1, $2, $3, $4, $5)
           ON CONFLICT (id) DO UPDATE SET
             course = EXCLUDED.course,
             batch = EXCLUDED.batch,
             start_date = EXCLUDED.start_date,
             end_date = EXCLUDED.end_date`,
          [row.id, row.course, row.batch, row.start_date, row.end_date]
        );
      }
    }

    // 5. timetable_changes
    if (data.timetable_changes?.length) {
      console.log(`Inserting ${data.timetable_changes.length} timetable changes...`);
      for (const row of data.timetable_changes) {
        await client.query(
          `INSERT INTO timetable_changes (id, week_id, dedupe_key, detected_at, type, lecture_id, division, course, semester, tab_name, date, weekday, summary, previous, next, fields)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
           ON CONFLICT (week_id, dedupe_key) DO UPDATE SET
             summary = EXCLUDED.summary,
             previous = EXCLUDED.previous,
             next = EXCLUDED.next,
             fields = EXCLUDED.fields`,
          [row.id, row.week_id, row.dedupe_key, row.detected_at, row.type, row.lecture_id, row.division, row.course, row.semester, row.tab_name, row.date, row.weekday, row.summary, JSON.stringify(row.previous), JSON.stringify(row.next), JSON.stringify(row.fields)]
        );
      }
    }

    // 6. timetable_archive
    if (data.timetable_archive?.length) {
      console.log(`Inserting timetable archive...`);
      for (const row of data.timetable_archive) {
        await client.query(
          `INSERT INTO timetable_archive (id, archive, updated_at)
           VALUES ($1, $2, $3)
           ON CONFLICT (id) DO UPDATE SET
             archive = EXCLUDED.archive,
             updated_at = EXCLUDED.updated_at`,
          [row.id, JSON.stringify(row.archive), row.updated_at]
        );
      }
    }

    // 7. timetable_lectures
    if (data.timetable_lectures?.length) {
      console.log(`Inserting ${data.timetable_lectures.length} timetable lectures...`);
      // Batch insert in chunks of 100
      const chunkSize = 100;
      for (let i = 0; i < data.timetable_lectures.length; i += chunkSize) {
        const chunk = data.timetable_lectures.slice(i, i + chunkSize);
        for (const row of chunk) {
          await client.query(
            `INSERT INTO timetable_lectures (
              week_id, id, slot_key, tab_name, course, semester, batch, division, date, weekday,
              start_minutes, end_minutes, start_label, end_label, subject, faculty, room, kind,
              source_status, reason, explicit_mark, recurring, spreadsheet_id, anchor, highlight
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25)
            ON CONFLICT (week_id, id) DO NOTHING`,
            [
              row.week_id, row.id, row.slot_key, row.tab_name, row.course, row.semester, row.batch,
              row.division, row.date, row.weekday, row.start_minutes, row.end_minutes, row.start_label,
              row.end_label, row.subject, row.faculty, row.room, row.kind, row.source_status,
              row.reason, row.explicit_mark, row.recurring, row.spreadsheet_id,
              JSON.stringify(row.anchor), row.highlight ? JSON.stringify(row.highlight) : null
            ]
          );
        }
      }
    }

    await client.query("COMMIT");
    console.log("Migration completed successfully!");

    // Verify counts
    const checkCounts = await client.query(`
      SELECT 
        (SELECT count(*) FROM batch_access_codes) AS batch_access_codes,
        (SELECT count(*) FROM faculty_directory) AS faculty_directory,
        (SELECT count(*) FROM timetable_weeks) AS timetable_weeks,
        (SELECT count(*) FROM timetable_changes) AS timetable_changes,
        (SELECT count(*) FROM timetable_lectures) AS timetable_lectures,
        (SELECT count(*) FROM timetable_archive) AS timetable_archive
    `);
    console.log("Verified row counts on target database:", checkCounts.rows[0]);
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

if (process.argv[2]) {
  runMigration(process.argv[2]).catch((err) => {
    console.error("Migration failed:", err);
    process.exit(1);
  });
}
