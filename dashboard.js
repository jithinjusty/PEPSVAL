import { supabase } from "./supabase.js";

document.addEventListener("DOMContentLoaded", async () => {
  // Require login
  const { data, error } = await supabase.auth.getSession();
  if (error || !data?.session?.user) {
    window.location.href = "/auth/login.html";
    return;
  }

  const btn = document.getElementById("signOutBtn");
  if (!btn) return;

  btn.addEventListener("click", async () => {
    btn.disabled = true;
    btn.textContent = "Signing out…";

    const { error: outErr } = await supabase.auth.signOut();
    if (outErr) {
      console.error(outErr);
      btn.disabled = false;
      btn.textContent = "Sign out";
      alert("Could not sign out. Please try again.");
      return;
    }

    window.location.href = "/auth/login.html";
  });
});