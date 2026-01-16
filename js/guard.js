// /js/guard.js
import { supabase } from "./supabase.js";
import { ROUTES } from "./config.js";

/**
 * Require auth for any protected page.
 * If not logged in -> redirect to login.
 */
export async function requireAuth({ redirectTo = ROUTES.login } = {}) {
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
 * (Aligned with our new V1 schema.)
 */
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
 * Route user after login:
 * - If setup not complete -> Setup page
 * - Else -> Profile Home (V1 app home)
 */
export async function routeAfterLogin() {
  const session = await requireAuth();
  if (!session) return;

  const profile = await getMyProfile(session.user.id);

  if (!profile || profile.setup_complete !== true) {
    window.location.href = ROUTES.setup;
    return;
  }

  window.location.href = ROUTES.home;
}

/**
 * Route right after signup success
 */
export function routeAfterSignup() {
  window.location.href = ROUTES.setup;
}