import { getSql } from "./postgres.ts";

let pending: Promise<void> | null = null;

/** Tables for admin sign-in, sheet links, and student notices. */
export function ensureAdminSchema(): Promise<void> {
  if (pending) return pending;
  const work = (async () => {
    const sql = getSql();
    await sql`
      CREATE TABLE IF NOT EXISTS admin_password (
        id SMALLINT PRIMARY KEY CHECK (id = 1),
        password_hash TEXT NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `;
    await sql`
      CREATE TABLE IF NOT EXISTS admin_sessions (
        token_hash TEXT PRIMARY KEY,
        expires_at TIMESTAMPTZ NOT NULL
      )
    `;
    await sql`
      CREATE TABLE IF NOT EXISTS timetable_sheet_links (
        course TEXT NOT NULL,
        batch TEXT NOT NULL,
        spreadsheet_id TEXT NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        PRIMARY KEY (course, batch)
      )
    `;
    await sql`
      CREATE TABLE IF NOT EXISTS student_notices (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        body TEXT NOT NULL,
        course TEXT,
        batch TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `;
    await sql`
      CREATE TABLE IF NOT EXISTS push_subscriptions (
        endpoint TEXT PRIMARY KEY,
        p256dh TEXT NOT NULL,
        auth_key TEXT NOT NULL,
        course TEXT,
        batch TEXT,
        division TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `;
    await sql`
      CREATE TABLE IF NOT EXISTS push_vapid (
        id SMALLINT PRIMARY KEY CHECK (id = 1),
        public_key TEXT NOT NULL,
        private_key TEXT NOT NULL
      )
    `;
  })().catch((error: unknown) => {
    pending = null;
    throw error;
  });
  pending = work;
  return work;
}
