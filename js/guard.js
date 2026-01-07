import { supabase } from "./supabase.js";

export async function requireAuth({ redirectTo = "/auth/login.html" } = {}) {
  const { data } = await supabase.auth.getSession();
  if (!data?.session) {
    window.location.href = redirectTo;
    return null;
  }
  return data.session;
}

export async function getMyProfile(userId) {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, setup_complete")
    .eq("id", userId)
    .maybeSingle();

  if (error) return null;
  return data || null;
}

// Use on login success
export async function routeAfterLogin() {
  const session = await requireAuth();
  if (!session) return;

  const profile = await getMyProfile(session.user.id);

  if (!profile || profile.setup_complete !== true) {
    window.location.href = "/setup/profile-setup.html";
    return;
  }

  window.location.href = "/dashboard.html";
}

// Use right after signup success
export function routeAfterSignup() {
  window.location.href = "/setup/profile-setup.html";
}