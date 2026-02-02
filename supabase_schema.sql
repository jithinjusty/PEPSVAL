-- 1. Create notifications table if it doesn't exist at all
CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT,
    body TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    is_read BOOLEAN DEFAULT false,
    read BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 2. Add missing columns one by one (SAFE)
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id);
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS type TEXT DEFAULT 'alert';

-- 3. Add parent_id to post_comments for nested replies
ALTER TABLE post_comments ADD COLUMN IF NOT EXISTS parent_id UUID REFERENCES post_comments(id) ON DELETE CASCADE;

-- 4. Create Messages & Community Chat Tables
CREATE TABLE IF NOT EXISTS community_chat (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS conversation_participants (
  conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
  profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
  PRIMARY KEY (conversation_id, profile_id)
);

CREATE TABLE IF NOT EXISTS private_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  is_read BOOLEAN DEFAULT false,
  read BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 5. Enable Real-time for all new tables
-- Note: You might need to check if they are already in the publication before running
ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
ALTER PUBLICATION supabase_realtime ADD TABLE community_chat;
ALTER PUBLICATION supabase_realtime ADD TABLE private_messages;

-- 6. Setup RLS Policies
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE community_chat ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversation_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE private_messages ENABLE ROW LEVEL SECURITY;

-- Notifications Policies
DROP POLICY IF EXISTS "Users can view their own notifications" ON notifications;
CREATE POLICY "Users can view their own notifications" ON notifications FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert notifications" ON notifications;
CREATE POLICY "Users can insert notifications" ON notifications FOR INSERT WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Users can update their own notifications" ON notifications;
CREATE POLICY "Users can update their own notifications" ON notifications FOR UPDATE USING (auth.uid() = user_id);

-- Community Chat Policies
CREATE POLICY "Public read access for community_chat" ON community_chat FOR SELECT USING (true);
CREATE POLICY "Authenticated users can insert community_chat" ON community_chat FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Conversations Policies
CREATE POLICY "Users can view conversations they are part of" ON conversations FOR SELECT USING (
  EXISTS (SELECT 1 FROM conversation_participants cp WHERE cp.conversation_id = id AND cp.profile_id = auth.uid())
);
CREATE POLICY "Authenticated users can create conversations" ON conversations FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Conversation Participants Policies
CREATE POLICY "Users can view their own participations" ON conversation_participants FOR SELECT USING (profile_id = auth.uid());
CREATE POLICY "Users can view participants of their conversations" ON conversation_participants FOR SELECT USING (
  conversation_id IN (SELECT conversation_id FROM conversation_participants WHERE profile_id = auth.uid())
);
CREATE POLICY "Users can add themselves or others to conversations" ON conversation_participants FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Private Messages Policies
CREATE POLICY "Users can view messages in their conversations" ON private_messages FOR SELECT USING (
  conversation_id IN (SELECT conversation_id FROM conversation_participants WHERE profile_id = auth.uid())
);
CREATE POLICY "Users can insert messages into their conversations" ON private_messages FOR INSERT WITH CHECK (
  conversation_id IN (SELECT conversation_id FROM conversation_participants WHERE profile_id = auth.uid())
);
CREATE POLICY "Users can update (mark read) messages in their conversations" ON private_messages FOR UPDATE USING (
  conversation_id IN (SELECT conversation_id FROM conversation_participants WHERE profile_id = auth.uid())
);
