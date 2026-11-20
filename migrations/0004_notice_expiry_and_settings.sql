-- Notices can expire and be edited. An edit with "push again" clears pushed_at so the job sends it again.
ALTER TABLE student_notices ADD COLUMN expires_at TEXT;
ALTER TABLE student_notices ADD COLUMN updated_at TEXT;

-- Small admin switches read by the Worker in the bootstrap query (for now only `exam_mode`: '1' or '0').
CREATE TABLE IF NOT EXISTS app_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
