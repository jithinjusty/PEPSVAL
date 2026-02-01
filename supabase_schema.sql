-- Supabase Schema Migrations for PEPSVAL
-- Run these in the Supabase SQL Editor

-- 1. Add parent_id to post_comments for nested replies
ALTER TABLE post_comments 
ADD COLUMN IF NOT EXISTS parent_id UUID REFERENCES post_comments(id) ON DELETE CASCADE;

-- 2. Ensure notifications table has a type column for better filtering (e.g., message requests)
ALTER TABLE notifications 
ADD COLUMN IF NOT EXISTS type TEXT DEFAULT 'alert';

-- 3. Add index for faster comment lookups by post and parent
CREATE INDEX IF NOT EXISTS idx_post_comments_parent ON post_comments(parent_id);
CREATE INDEX IF NOT EXISTS idx_post_comments_post_id ON post_comments(post_id);

-- 4. Ensure notification metadata is jsonb for rich data
-- ALTER TABLE notifications ALTER COLUMN metadata SET DATA TYPE jsonb USING metadata::jsonb;
