-- Migration 0006: Live Teaching Infrastructure (Cloudflare Calls)
-- Tracks live sessions per cohort and session attendance

CREATE TABLE IF NOT EXISTS cohort_live_sessions (
  id TEXT PRIMARY KEY,
  cohort_id TEXT NOT NULL,
  session_id TEXT NOT NULL, -- Cloudflare Calls Session ID
  title TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active', -- 'active', 'ended'
  started_at_ms INTEGER NOT NULL,
  ended_at_ms INTEGER,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at_ms INTEGER NOT NULL,
  updated_at_ms INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_live_sessions_cohort_status
  ON cohort_live_sessions(cohort_id, status);

CREATE TABLE IF NOT EXISTS live_session_attendance (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  joined_at_ms INTEGER NOT NULL,
  left_at_ms INTEGER,
  duration_seconds INTEGER DEFAULT 0,
  device_info_json TEXT NOT NULL DEFAULT '{}',
  UNIQUE(session_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_live_attendance_session
  ON live_session_attendance(session_id);

CREATE INDEX IF NOT EXISTS idx_live_attendance_user
  ON live_session_attendance(user_id);
