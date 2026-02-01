-- 1. Ensure the notifications table exists with the correct columns
CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id), -- This is for the recipient
    title TEXT,
    body TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    type TEXT DEFAULT 'alert',
    is_read BOOLEAN DEFAULT false,
    read BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 2. Add parent_id to post_comments for nested replies
ALTER TABLE post_comments 
ADD COLUMN IF NOT EXISTS parent_id UUID REFERENCES post_comments(id) ON DELETE CASCADE;

-- 3. Add index for faster comment lookups
CREATE INDEX IF NOT EXISTS idx_post_comments_parent ON post_comments(parent_id);
CREATE INDEX IF NOT EXISTS idx_post_comments_post_id ON post_comments(post_id);

-- 4. ENABLE REAL-TIME (CRITICAL)
-- Note: If you get an error here, you may need to go to Database -> Publications in Supabase UI and enable 'notifications' manually.
ALTER PUBLICATION supabase_realtime ADD TABLE notifications;

-- 5. SETUP RLS POLICIES (CRITICAL)
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own notifications" ON notifications;
CREATE POLICY "Users can view their own notifications" ON notifications
FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "System can insert notifications" ON notifications;
CREATE POLICY "System can insert notifications" ON notifications
FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Users can update their own notifications" ON notifications;
CREATE POLICY "Users can update their own notifications" ON notifications
FOR UPDATE USING (auth.uid() = user_id);
