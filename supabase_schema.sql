-- Supabase Schema Migrations for PEPSVAL
-- Run these in the Supabase SQL Editor

-- 1. Add parent_id to post_comments for nested replies
ALTER TABLE post_comments 
ADD COLUMN IF NOT EXISTS parent_id UUID REFERENCES post_comments(id) ON DELETE CASCADE;

-- 2. Ensure notifications table has a type column for better filtering
ALTER TABLE notifications 
ADD COLUMN IF NOT EXISTS type TEXT DEFAULT 'alert';

-- 3. Add index for faster comment lookups
CREATE INDEX IF NOT EXISTS idx_post_comments_parent ON post_comments(parent_id);
CREATE INDEX IF NOT EXISTS idx_post_comments_post_id ON post_comments(post_id);

-- 4. ENABLE REAL-TIME (CRITICAL)
-- This allows the frontend to "listen" for new notifications
ALTER PUBLICATION supabase_realtime ADD TABLE notifications;

-- 5. SETUP RLS POLICIES (CRITICAL)
-- This ensures users can only see their own notifications
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own notifications" ON notifications;
CREATE POLICY "Users can view their own notifications" ON notifications
FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "System can insert notifications" ON notifications;
CREATE POLICY "System can insert notifications" ON notifications
FOR INSERT WITH CHECK (true); -- Usually you'd restrict this more, but for now this allows app-side inserts

DROP POLICY IF EXISTS "Users can update their own notifications" ON notifications;
CREATE POLICY "Users can update their own notifications" ON notifications
FOR UPDATE USING (auth.uid() = user_id);
