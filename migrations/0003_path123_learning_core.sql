CREATE TABLE IF NOT EXISTS organizations (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  brand_primary_color TEXT NOT NULL DEFAULT '#0f172a',
  logo_url TEXT NOT NULL DEFAULT '',
  settings_json TEXT NOT NULL DEFAULT '{}',
  created_at_ms INTEGER NOT NULL,
  updated_at_ms INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_organizations_slug
  ON organizations(slug);

CREATE TABLE IF NOT EXISTS organization_staff (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  org_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  role TEXT NOT NULL,
  created_at_ms INTEGER NOT NULL,
  UNIQUE(org_id, user_id, role)
);

CREATE INDEX IF NOT EXISTS idx_org_staff_org
  ON organization_staff(org_id);

CREATE TABLE IF NOT EXISTS course_modules (
  id TEXT PRIMARY KEY,
  course_id TEXT NOT NULL,
  path_key TEXT NOT NULL,
  module_key TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 0,
  content_markdown TEXT NOT NULL DEFAULT '',
  lab_type TEXT NOT NULL DEFAULT '',
  unlock_policy TEXT NOT NULL DEFAULT 'cohort',
  estimated_minutes INTEGER NOT NULL DEFAULT 30,
  is_published INTEGER NOT NULL DEFAULT 0,
  created_at_ms INTEGER NOT NULL,
  updated_at_ms INTEGER NOT NULL,
  UNIQUE(course_id, module_key)
);

CREATE INDEX IF NOT EXISTS idx_course_modules_course_sort
  ON course_modules(course_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_course_modules_path
  ON course_modules(path_key, is_published);

CREATE TABLE IF NOT EXISTS cohorts (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL DEFAULT '',
  course_id TEXT NOT NULL,
  name TEXT NOT NULL,
  mode TEXT NOT NULL DEFAULT 'instructor-led',
  start_date TEXT NOT NULL DEFAULT '',
  end_date TEXT NOT NULL DEFAULT '',
  instructor_user_id TEXT NOT NULL DEFAULT '',
  fee_cents INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'draft',
  created_at_ms INTEGER NOT NULL,
  updated_at_ms INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_cohorts_course_status
  ON cohorts(course_id, status, updated_at_ms);
CREATE INDEX IF NOT EXISTS idx_cohorts_org_status
  ON cohorts(org_id, status, updated_at_ms);

CREATE TABLE IF NOT EXISTS cohort_module_unlocks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  cohort_id TEXT NOT NULL,
  module_id TEXT NOT NULL,
  created_at_ms INTEGER NOT NULL,
  UNIQUE(cohort_id, module_id)
);

CREATE INDEX IF NOT EXISTS idx_cohort_unlocks_cohort
  ON cohort_module_unlocks(cohort_id);

CREATE TABLE IF NOT EXISTS cohort_enrollments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  cohort_id TEXT NOT NULL,
  course_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'enrolled',
  progress_pct REAL NOT NULL DEFAULT 0,
  completion_state TEXT NOT NULL DEFAULT 'in_progress',
  completed_at_ms INTEGER,
  certificate_url TEXT NOT NULL DEFAULT '',
  created_at_ms INTEGER NOT NULL,
  updated_at_ms INTEGER NOT NULL,
  UNIQUE(cohort_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_cohort_enrollments_cohort_status
  ON cohort_enrollments(cohort_id, status, updated_at_ms);
CREATE INDEX IF NOT EXISTS idx_cohort_enrollments_course_user
  ON cohort_enrollments(course_id, user_id);

CREATE TABLE IF NOT EXISTS module_progress (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  cohort_id TEXT NOT NULL DEFAULT '',
  course_id TEXT NOT NULL,
  module_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  status TEXT NOT NULL,
  score REAL,
  attempt_count INTEGER NOT NULL DEFAULT 0,
  artifact_url TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  updated_at_ms INTEGER NOT NULL,
  UNIQUE(course_id, module_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_module_progress_user
  ON module_progress(user_id, updated_at_ms);
CREATE INDEX IF NOT EXISTS idx_module_progress_course
  ON module_progress(course_id, module_id, status);

CREATE TABLE IF NOT EXISTS assignment_rubrics (
  id TEXT PRIMARY KEY,
  course_id TEXT NOT NULL,
  module_id TEXT NOT NULL,
  title TEXT NOT NULL,
  rubric_json TEXT NOT NULL,
  pass_threshold REAL NOT NULL DEFAULT 70,
  created_at_ms INTEGER NOT NULL,
  updated_at_ms INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_assignment_rubrics_course_module
  ON assignment_rubrics(course_id, module_id);

CREATE TABLE IF NOT EXISTS assignment_submissions (
  id TEXT PRIMARY KEY,
  course_id TEXT NOT NULL,
  module_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  rubric_id TEXT NOT NULL DEFAULT '',
  answer_text TEXT NOT NULL DEFAULT '',
  artifacts_json TEXT NOT NULL DEFAULT '[]',
  ai_feedback_json TEXT NOT NULL DEFAULT '{}',
  score REAL,
  passed INTEGER NOT NULL DEFAULT 0,
  submitted_at_ms INTEGER NOT NULL,
  graded_at_ms INTEGER,
  grader_mode TEXT NOT NULL DEFAULT 'ai',
  status TEXT NOT NULL DEFAULT 'submitted'
);

CREATE INDEX IF NOT EXISTS idx_assignment_submissions_user
  ON assignment_submissions(user_id, submitted_at_ms);
CREATE INDEX IF NOT EXISTS idx_assignment_submissions_course_module
  ON assignment_submissions(course_id, module_id, status);

CREATE TABLE IF NOT EXISTS lab_runs (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL DEFAULT '',
  course_id TEXT NOT NULL,
  module_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  path_key TEXT NOT NULL,
  tool_type TEXT NOT NULL,
  provider TEXT NOT NULL DEFAULT '',
  model_name TEXT NOT NULL DEFAULT '',
  input_hash TEXT NOT NULL DEFAULT '',
  output_json TEXT NOT NULL DEFAULT '{}',
  latency_ms INTEGER NOT NULL DEFAULT 0,
  cost_microunits INTEGER NOT NULL DEFAULT 0,
  created_at_ms INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_lab_runs_user_created
  ON lab_runs(user_id, created_at_ms);
CREATE INDEX IF NOT EXISTS idx_lab_runs_path_created
  ON lab_runs(path_key, created_at_ms);

CREATE TABLE IF NOT EXISTS learning_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  org_id TEXT NOT NULL DEFAULT '',
  course_id TEXT NOT NULL DEFAULT '',
  module_id TEXT NOT NULL DEFAULT '',
  cohort_id TEXT NOT NULL DEFAULT '',
  user_id TEXT NOT NULL DEFAULT '',
  event_name TEXT NOT NULL,
  event_value REAL NOT NULL DEFAULT 1,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at_ms INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_learning_events_course_created
  ON learning_events(course_id, event_name, created_at_ms);
CREATE INDEX IF NOT EXISTS idx_learning_events_user_created
  ON learning_events(user_id, created_at_ms);

CREATE TABLE IF NOT EXISTS assessment_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  org_id TEXT NOT NULL DEFAULT '',
  course_id TEXT NOT NULL DEFAULT '',
  module_id TEXT NOT NULL DEFAULT '',
  cohort_id TEXT NOT NULL DEFAULT '',
  user_id TEXT NOT NULL DEFAULT '',
  event_name TEXT NOT NULL,
  score REAL,
  passed INTEGER NOT NULL DEFAULT 0,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at_ms INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_assessment_events_course_created
  ON assessment_events(course_id, module_id, created_at_ms);
CREATE INDEX IF NOT EXISTS idx_assessment_events_user_created
  ON assessment_events(user_id, created_at_ms);
