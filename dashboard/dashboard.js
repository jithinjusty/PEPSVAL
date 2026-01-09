// /dashboard/dashboard.js
import { supabase } from "/js/supabase.js";

const $ = (id) => document.getElementById(id);

document.addEventListener("DOMContentLoaded", async () => {
  // 1) Require logged-in user
  const { data } = await supabase.auth.getUser();
  const user = data?.user;

  if (!user) {
    window.location.href = "/auth/login.html";
    return;
  }

  // 2) Basic status text
  if ($("dashStatus")) {
    $("dashStatus").textContent = `Signed in as ${user.email || "user"}`;
  }

  // 3) Try load profile to determine complete/incomplete
  try {
    const { data: prof, error } = await supabase
      .from("profiles")
      .select("full_name, rank, nationality, setup_complete")
      .eq("id", user.id)
      .single();

    if (!error && $("dashStatus")) {
      const name = prof?.full_name || user.email?.split("@")[0] || "User";
      const status = prof?.setup_complete ? "Profile Active ✅" : "Profile Incomplete ⚠️";
      $("dashStatus").textContent = `${name} • ${status}`;
    }
  } catch (_) {}

  // 4) Logout
  const logoutBtn = $("logoutBtn");
  if (logoutBtn) {
    logoutBtn.addEventListener("click", async () => {
      try {
        await supabase.auth.signOut();
      } catch (_) {}
      window.location.href = "/auth/login.html";
    });
  }
});