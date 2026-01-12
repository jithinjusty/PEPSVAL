// /js/guard.js
import { supabase } from "./supabase.js";

/**
 * Require auth for any protected page.
 * If not logged in -> redirect to login.
 */
export async function requireAuth({ redirectTo = "/auth/login.html" } = {}) {
  const { data, error } = await supabase.auth.getSession();
  const session = data?.session;

  if (error || !session) {
    window.location.href = redirectTo;
    return null;
  }
  return session;
}

/**
 * Get minimal profile to decide routing after login/signup.
 * (Include fields needed for UI so we don't fall back to email.)
 */
export async function getMyProfile(userId) {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, setup_complete, full_name, username, account_type, avatar_url")
    .eq("id", userId)
    .single();

  if (error) return null;
  return data;
}

/**
 * Route user after login:
 * - If setup not complete -> /setup/profile-setup.html
 * - Else -> /feed/index.html (Feed is the app home)
 */
export async function routeAfterLogin() {
  const session = await requireAuth();
  if (!session) return;

  const profile = await getMyProfile(session.user.id);

  if (!profile || profile.setup_complete !== true) {
    window.location.href = "/setup/profile-setup.html";
    return;
  }

  window.location.href = "/feed/index.html";
}

/**
 * Route right after signup success
 */
export function routeAfterSignup() {
  window.location.href = "/setup/profile-setup.html";
}