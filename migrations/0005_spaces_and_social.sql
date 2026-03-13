-- Migration 0005: Add Spaces fields and Social Media content
-- Adds columns to content_posts to track HuggingFace Spaces and social media snippets.

-- Spaces spotlight fields
ALTER TABLE content_posts ADD COLUMN hf_space_id TEXT NOT NULL DEFAULT '';
ALTER TABLE content_posts ADD COLUMN hf_space_author TEXT NOT NULL DEFAULT '';
ALTER TABLE content_posts ADD COLUMN hf_space_sdk TEXT NOT NULL DEFAULT '';
ALTER TABLE content_posts ADD COLUMN hf_space_likes INTEGER NOT NULL DEFAULT 0;
ALTER TABLE content_posts ADD COLUMN hf_space_domain TEXT NOT NULL DEFAULT '';

-- Social media snippet field
ALTER TABLE content_posts ADD COLUMN social_media_markdown TEXT NOT NULL DEFAULT '';
