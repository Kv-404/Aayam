-- Cloudflare D1 schema. Apply with: npx wrangler d1 migrations apply timetable --remote
-- Timestamps are ISO-8601 text. Booleans are 0/1. JSON columns hold JSON text.

-- ---------------------------------------------------------------------------
-- Timetable archive. Written only by the sync job (server/src/job). Same shape
-- as the old Supabase rows, so history and cancellations carry over.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS timetable_sync (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  saved_at TEXT NOT NULL,
  last_success_at TEXT,
  last_attempt_at TEXT,
  last_error TEXT,
  bootstrapped INTEGER NOT NULL DEFAULT 0,
  content_hash TEXT,
  tab_names TEXT NOT NULL DEFAULT '[]',
  parse_issues TEXT NOT NULL DEFAULT '[]',
  spreadsheet_title TEXT,
  -- Bumped on every archive publish. The job compares it with its cached copy to skip a full hydrate.
  revision INTEGER NOT NULL DEFAULT 0
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
  recurring INTEGER NOT NULL DEFAULT 0,
  spreadsheet_id TEXT,
  anchor TEXT NOT NULL,
  highlight TEXT,
  PRIMARY KEY (week_id, id)
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
  previous TEXT,
  next TEXT,
  fields TEXT NOT NULL DEFAULT '[]',
  PRIMARY KEY (week_id, id),
  UNIQUE (week_id, dedupe_key)
);

CREATE TABLE IF NOT EXISTS timetable_weeks (
  id TEXT PRIMARY KEY,
  course TEXT NOT NULL,
  batch TEXT NOT NULL,
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL
);

-- ---------------------------------------------------------------------------
-- Read models. The job renders every API response the Worker serves and stores
-- it here. Keys come from shared/scope.ts (`snapshotKeys`). `hash` lets the job
-- skip rows that did not change and lets the Worker answer with an ETag.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS snapshots (
  key TEXT PRIMARY KEY,
  body TEXT NOT NULL,
  hash TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- One row. Worker asks the job to run; the job records when it finished.
CREATE TABLE IF NOT EXISTS job_state (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  requested_at TEXT,
  request_reason TEXT,
  dispatched_at TEXT,
  finished_at TEXT
);
INSERT OR IGNORE INTO job_state (id) VALUES (1);

-- ---------------------------------------------------------------------------
-- Admin, faculty, notices, push.
-- ---------------------------------------------------------------------------
-- `password_hash` is `hmac-sha256:<salt b64url>:<digest b64url>` keyed by AUTH_SECRET.
CREATE TABLE IF NOT EXISTS admin_password (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  password_hash TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS admin_sessions (
  token_hash TEXT PRIMARY KEY,
  expires_at TEXT NOT NULL
);

-- Fixed-window counters for login and PIN attempts, keyed like `admin:<ip>`.
CREATE TABLE IF NOT EXISTS rate_limits (
  key TEXT PRIMARY KEY,
  count INTEGER NOT NULL,
  reset_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS timetable_sheet_links (
  course TEXT NOT NULL,
  batch TEXT NOT NULL,
  spreadsheet_id TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (course, batch)
);

CREATE TABLE IF NOT EXISTS student_notices (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  course TEXT,
  batch TEXT,
  created_at TEXT NOT NULL,
  -- NULL until the job has sent the web push for it.
  pushed_at TEXT
);
CREATE INDEX IF NOT EXISTS student_notices_created ON student_notices (created_at);

CREATE TABLE IF NOT EXISTS push_subscriptions (
  endpoint TEXT PRIMARY KEY,
  p256dh TEXT NOT NULL,
  auth_key TEXT NOT NULL,
  course TEXT,
  batch TEXT,
  division TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS push_vapid (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  public_key TEXT NOT NULL,
  private_key TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS faculty_directory (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  faculty_name TEXT NOT NULL,
  program TEXT DEFAULT 'BTech',
  is_active INTEGER NOT NULL DEFAULT 1,
  can_see_all_faculty INTEGER NOT NULL DEFAULT 0,
  last_login_at TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
