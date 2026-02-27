CREATE TABLE IF NOT EXISTS lead_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_name TEXT NOT NULL,
  webinar_id TEXT NOT NULL,
  source TEXT NOT NULL,
  country TEXT NOT NULL,
  is_likely_bot INTEGER NOT NULL DEFAULT 0,
  lead_id TEXT,
  session_id TEXT,
  path TEXT,
  email_hash TEXT,
  value REAL NOT NULL DEFAULT 1,
  bot_score REAL,
  asn INTEGER,
  created_at_ms INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_lead_events_webinar_created
  ON lead_events(webinar_id, created_at_ms);
CREATE INDEX IF NOT EXISTS idx_lead_events_name_created
  ON lead_events(event_name, created_at_ms);
CREATE INDEX IF NOT EXISTS idx_lead_events_bot_created
  ON lead_events(is_likely_bot, created_at_ms);

CREATE TABLE IF NOT EXISTS platform_users (
  uid TEXT PRIMARY KEY,
  email TEXT,
  display_name TEXT,
  role TEXT NOT NULL,
  created_at_ms INTEGER NOT NULL,
  updated_at_ms INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS courses (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  status TEXT NOT NULL,
  price_cents INTEGER NOT NULL DEFAULT 0,
  start_date TEXT,
  end_date TEXT,
  created_by TEXT NOT NULL,
  created_at_ms INTEGER NOT NULL,
  updated_at_ms INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_courses_status_updated
  ON courses(status, updated_at_ms);

CREATE TABLE IF NOT EXISTS course_staff (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  course_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  role TEXT NOT NULL,
  created_at_ms INTEGER NOT NULL,
  UNIQUE(course_id, user_id, role)
);

CREATE INDEX IF NOT EXISTS idx_course_staff_course
  ON course_staff(course_id);

CREATE TABLE IF NOT EXISTS course_enrollments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  course_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  status TEXT NOT NULL,
  progress_pct REAL NOT NULL DEFAULT 0,
  completed_at_ms INTEGER,
  certificate_url TEXT,
  created_at_ms INTEGER NOT NULL,
  updated_at_ms INTEGER NOT NULL,
  UNIQUE(course_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_enrollments_course_status
  ON course_enrollments(course_id, status);
