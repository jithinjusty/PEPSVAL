// /reset.js
import { supabase } from "/js/supabase.js";

const form = document.getElementById("resetForm");
const newPassword = document.getElementById("newPassword");
const confirmPassword = document.getElementById("confirmPassword");
const errorBox = document.getElementById("errorBox");
const successBox = document.getElementById("successBox");
const saveBtn = document.getElementById("saveBtn");

function show(el, msg) {
  el.style.display = "block";
  el.textContent = msg;
}
function hide(el) {
  el.style.display = "none";
  el.textContent = "";
}

async function ensureRecoverySession() {
  // 1) PKCE reset link (?code=...)
  const url = new URL(window.location.href);
  const code = url.searchParams.get("code");
  if (code) {
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) throw error;
    return data?.session || null;
  }

  // 2) Implicit reset link (#access_token=...&refresh_token=...)
  const hash = window.location.hash || "";
  if (hash.includes("access_token=") || hash.includes("refresh_token=")) {
    const params = new URLSearchParams(hash.replace("#", ""));
    const access_token = params.get("access_token");
    const refresh_token = params.get("refresh_token");

    if (access_token && refresh_token) {
      const { data, error } = await supabase.auth.setSession({
        access_token,
        refresh_token,
      });
      if (error) throw error;
      return data?.session || null;
    }
  }

  // 3) Already has session?
  const { data } = await supabase.auth.getSession();
  return data?.session || null;
}

async function init() {
  hide(errorBox);
  hide(successBox);

  try {
    if (!supabase) throw new Error("Supabase not initialized.");

    const session = await ensureRecoverySession();

    if (!session) {
      show(
        errorBox,
        "Reset link is missing or expired. Please go to Forgot Password and request a new reset email."
      );
      saveBtn.disabled = true;
      return;
    }

    // Clean URL (optional but nice)
    try {
      const clean = window.location.origin + window.location.pathname;
      window.history.replaceState({}, document.title, clean);
    } catch {}
  } catch (err) {
    show(errorBox, err?.message || "Could not start reset session.");
    saveBtn.disabled = true;
  }
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  hide(errorBox);
  hide(successBox);

  const p1 = (newPassword.value || "").trim();
  const p2 = (confirmPassword.value || "").trim();

  if (!p1) return show(errorBox, "Please enter a new password.");
  if (p1.length < 6) return show(errorBox, "Password must be at least 6 characters.");
  if (p1 !== p2) return show(errorBox, "Passwords do not match.");

  saveBtn.disabled = true;
  saveBtn.textContent = "Updating…";

  try {
    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData?.session) {
      // try again if session not present for any reason
      const s = await ensureRecoverySession();
      if (!s) throw new Error("Reset session expired. Please request a new reset email.");
    }

    const { error } = await supabase.auth.updateUser({ password: p1 });
    if (error) throw error;

    show(successBox, "Password updated ✅ You can now login.");
    setTimeout(() => {
      window.location.href = "/auth/login.html";
    }, 900);
  } catch (err) {
    show(errorBox, err?.message || "Password update failed.");
  } finally {
    saveBtn.disabled = false;
    saveBtn.textContent = "Update password";
  }
});

init();