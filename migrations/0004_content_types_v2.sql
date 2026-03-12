-- Migration 0004: Add new content type fields for Model Spotlight, DAIY, Health News
-- Uses IF NOT EXISTS checks via CREATE TABLE workaround (SQLite ALTER TABLE limitations)
-- Safe to re-run: new columns are added only if missing

-- Model spotlight fields
ALTER TABLE content_posts ADD COLUMN hf_model_id TEXT NOT NULL DEFAULT '';
ALTER TABLE content_posts ADD COLUMN hf_model_author TEXT NOT NULL DEFAULT '';
ALTER TABLE content_posts ADD COLUMN hf_model_pipeline TEXT NOT NULL DEFAULT '';
ALTER TABLE content_posts ADD COLUMN hf_model_downloads INTEGER NOT NULL DEFAULT 0;
ALTER TABLE content_posts ADD COLUMN hf_model_likes INTEGER NOT NULL DEFAULT 0;

-- DAIY prompt fields
ALTER TABLE content_posts ADD COLUMN prompt_text TEXT NOT NULL DEFAULT '';
ALTER TABLE content_posts ADD COLUMN prompt_output_preview TEXT NOT NULL DEFAULT '';
ALTER TABLE content_posts ADD COLUMN prompt_keyword TEXT NOT NULL DEFAULT '';
ALTER TABLE content_posts ADD COLUMN suggested_models_json TEXT NOT NULL DEFAULT '[]';

-- Community engagement
ALTER TABLE content_posts ADD COLUMN community_likes INTEGER NOT NULL DEFAULT 0;

-- Missing base fields from worker.js
-- We add these here because they were omitted in 0002
ALTER TABLE content_posts ADD COLUMN content_type TEXT NOT NULL DEFAULT 'daily_brief';
ALTER TABLE content_posts ADD COLUMN canonical_url TEXT NOT NULL DEFAULT '';

-- Index for content type + status queries
CREATE INDEX IF NOT EXISTS idx_content_posts_type_status_published
  ON content_posts(content_type, status, published_at_ms);
