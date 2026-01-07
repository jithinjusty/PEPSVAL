import { supabase } from "./js/supabase.js";

document.addEventListener("DOMContentLoaded", async () => {
  const userEmailEl = document.getElementById("userEmail");
  const profileStatusEl = document.getElementById("profileStatus");
  const logoutBtn = document.getElementById("logoutBtn");

  // Must be logged in to view dashboard
  const { data: sessionData } = await supabase.auth.getSession();
  const session = sessionData?.session;

  if (!session) {
    window.location.href = "/auth/login.html";
    return;
  }

  userEmailEl.textContent = session.user.email || "—";

  // Check profile completeness
  try {
    const userId = session.user.id;

    const { data: profile, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .maybeSingle();

    if (error) {
      profileStatusEl.textContent = "Profile check failed (table/permissions).";
    } else if (!profile) {
      profileStatusEl.textContent = "Profile not created yet. Redirecting…";
      window.location.href = "/profile-setup.html";
      return;
    } else {
      // Minimal completeness rule (safe default)
      const complete =
        !!(profile.full_name || profile.name || profile.first_name) &&
        !!(profile.account_type || profile.user_type);

      profileStatusEl.textContent = complete ? "Complete ✅" : "Incomplete — please finish setup";
      if (!complete) {
        window.location.href = "/profile-setup.html";
        return;
      }
    }
  } catch (e) {
    profileStatusEl.textContent = "Profile check error.";
  }

  logoutBtn.addEventListener("click", async () => {
    await supabase.auth.signOut();
    window.location.href = "/auth/login.html";
  });
});