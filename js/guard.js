// /js/guard.js
import { supabase } from "/js/supabase.js";
import { ROUTES } from "/js/config.js";

/** Require auth for protected pages */
export async function requireAuth({ redirectTo = ROUTES.login } = {}) {
  const { data, error } = await supabase.auth.getSession();
  const session = data?.session;

  if (error || !session) {
    window.location.href = redirectTo;
    return null;
  }
  return session;
}

/** Load minimal profile needed for routing */
export async function getMyProfile(userId) {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, setup_complete, full_name, role")
    .eq("id", userId)
    .single();

  if (error) return null;
  return data;
}

/**
 * After login:
 * - If setup incomplete -> go to setup (profile editing first time)
 * - If setup complete -> go to FEED
 */
export async function routeAfterLogin() {
  const session = await requireAuth();
  if (!session) return;

  const profile = await getMyProfile(session.user.id);

  if (!profile || profile.setup_complete !== true) {
    window.location.href = ROUTES.setup;
    return;
  }

  window.location.href = ROUTES.feed;
}

/** After signup always go to setup first */
export function routeAfterSignup() {
  window.location.href = ROUTES.setup;
}