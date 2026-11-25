-- Phone app push: one row per Expo push token. The Worker upserts it; the job sends and prunes it.
-- Students are matched by division (and course/batch for notices); faculty by name through shared/faculty.ts.
CREATE TABLE IF NOT EXISTS app_push_devices (
  token TEXT PRIMARY KEY,
  role TEXT NOT NULL,
  course TEXT,
  batch TEXT,
  division TEXT,
  faculty TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- Changes detected after `changes_after` have been pushed. The first job run sets it to now and sends nothing,
-- so turning this on does not replay the change log (same rule as the site's first opt-in).
CREATE TABLE IF NOT EXISTS app_push_state (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  changes_after TEXT NOT NULL
);
