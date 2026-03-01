CREATE TABLE IF NOT EXISTS content_posts (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  summary TEXT NOT NULL,
  content_markdown TEXT NOT NULL,
  path TEXT NOT NULL,
  tags_json TEXT NOT NULL,
  source_urls_json TEXT NOT NULL,
  model_name TEXT NOT NULL,
  prompt_version TEXT NOT NULL,
  status TEXT NOT NULL,
  generated_at_ms INTEGER NOT NULL,
  approved_at_ms INTEGER,
  published_at_ms INTEGER,
  created_at_ms INTEGER NOT NULL,
  updated_at_ms INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_content_posts_status_updated
  ON content_posts(status, updated_at_ms);

CREATE TABLE IF NOT EXISTS content_generation_runs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  run_type TEXT NOT NULL,
  status TEXT NOT NULL,
  message TEXT NOT NULL,
  post_id TEXT,
  created_at_ms INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_content_generation_runs_created
  ON content_generation_runs(created_at_ms);
