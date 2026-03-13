-- Migration 0005: Add R2 asset key for multi-modal content
ALTER TABLE content_posts ADD COLUMN r2_asset_key TEXT;
