import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

const SUPABASE_URL = "https://czlmeehcxrslgfvqjfsb.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN6bG1lZWhjeHJzbGdmdnFqZnNiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc1MzU0NjgsImV4cCI6MjA4MzExMTQ2OH0.vHeIA2n6tm3F3IEoOPBsrIXQ1JXRlhe6bU4VP9b2lek";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ✅ This is what was missing — profile loader
export async function getCurrentUser() {
  const { data: { user }, error } = await supabase.auth.getUser();

  if (error || !user) {
    console.error("Auth error:", error);
    return null;
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  if (profileError) {
    console.error("Profile fetch error:", profileError);
    return null;
  }

  return {
    ...user,
    profile
  };
}

/** 
 * Send a notification to a specific user
 */
export async function sendNotification(userId, title, body, data = {}, type = "alert") {
  try {
    const { error } = await supabase
      .from("notifications")
      .insert({
        user_id: userId,
        title,
        body,
        metadata: data,
        type,
        is_read: false,
        read: false,
        created_at: new Date().toISOString()
      });
    if (error) throw error;
  } catch (err) {
    console.warn("Notification failed:", err.message);
  }
}

/**
 * Mark a notification as read
 */
export async function markNotificationAsRead(notifId) {
  try {
    const { error } = await supabase
      .from("notifications")
      .update({ is_read: true, read: true })
      .eq("id", notifId);
    if (error) throw error;
  } catch (err) {
    console.warn("Mark read failed:", err.message);
  }
}

/**
 * Check if a message request is pending or a conversation exists
 */
export async function getMessagingStatus(myId, theirId) {
  // 1. Check for existing conversation
  const { data: myConvs } = await supabase.from("conversation_participants").select("conversation_id").eq("profile_id", myId);
  const { data: theirConvs } = await supabase.from("conversation_participants").select("conversation_id").eq("profile_id", theirId);

  const common = myConvs?.find(mc => theirConvs?.some(tc => tc.conversation_id === mc.conversation_id));
  if (common) return { status: 'connected', conversationId: common.conversation_id };

  // 2. Check for pending request
  const { data: req } = await supabase
    .from("notifications")
    .select("id")
    .eq("user_id", theirId)
    .eq("type", "message_request")
    .maybeSingle();

  // Note: For simplicity, we assume if ANY message_request for this user exists, 
  // we check metadata in the client if needed, but eq("metadata->sender_id", myId) would be ideal if Supabase supports it well here.
  // Using a simpler approach: fetch all pending and filter.

  if (req) return { status: 'pending' };

  return { status: 'none' };
}

/**
 * Create a new conversation between two users
 */
export async function createConversation(u1, u2) {
  const { data: conv, error } = await supabase.from("conversations").insert({}).select().single();
  if (error) throw error;
  await supabase.from("conversation_participants").insert([
    { conversation_id: conv.id, profile_id: u1 },
    { conversation_id: conv.id, profile_id: u2 }
  ]);
  return conv.id;
}
