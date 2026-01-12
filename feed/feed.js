import { supabase } from "/js/supabase.js";

/**
 * Require a logged-in session.
 * If not logged in -> redirect to login.
 */
export async function requireAuth() {
  const { data, error } = await supabase.auth.getSession();
  if (error) {
    console.error("getSession error:", error);
    window.location.href = "/auth/login.html";
    return null;
  }

  const session = data?.session || null;
  if (!session) {
    window.location.href = "/auth/login.html";
    return null;
  }
  return session;
}

/**
 * Fetch minimal profile fields used for routing/guards.
 */
export async function getMyProfile(userId) {
  if (!userId) return null;

  const { data, error } = await supabase
    .from("profiles")
    .select("id, setup_complete, full_name, username, avatar_url")
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    console.error("getMyProfile error:", error);
    return null;
  }
  return data || null;
}

/**
 * Optional helper: if already logged in, send to dashboard
 */
export async function redirectIfAuthed(to = "/dashboard/index.html") {
  const { data } = await supabase.auth.getSession();
  if (data?.session) window.location.href = to;
}