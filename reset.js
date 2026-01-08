// /reset.js
import { supabase } from "/js/supabase.js";

const form = document.getElementById("resetForm");
const newPassword = document.getElementById("newPassword");
const confirmPassword = document.getElementById("confirmPassword");
const errorBox = document.getElementById("errorBox");
const successBox = document.getElementById("successBox");
const btn = document.getElementById("saveBtn");

function show(el, msg) {
  el.style.display = "block";
  el.textContent = msg;
}
function hide(el) {
  el.style.display = "none";
  el.textContent = "";
}

async function ensureSessionFromUrl() {
  // PKCE flow: ?code=...
  const url = new URL(window.location.href);
  const code = url.searchParams.get("code");
  if (code) {
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) throw error;
    return data?.session || null;
  }

  // Implicit flow: #access_token=...&refresh_token=...
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

  // already signed in?
  const { data } = await supabase.auth.getSession();
  return data?.session || null;
}

async function init() {
  hide(errorBox);
  hide(successBox);
  btn.disabled = true;

  try {
    const session = await ensureSessionFromUrl();

    if (!session) {
      show(
        errorBox,
        "Reset link expired or invalid. Please go to Forgot Password and request a new reset email."
      );
      return;
    }

    // confirm we truly have a user in session
    const { data: userData, error: userErr } = await supabase.auth.getUser();
    if (userErr || !userData?.user) {
      show(
        errorBox,
        "Could not load recovery session. Please request a new reset email."
      );
      return;
    }

    // clean URL (removes tokens from address bar)
    try {
      const clean = window.location.origin + window.location.pathname;
      window.history.replaceState({}, document.title, clean);
    } catch {}

    btn.disabled = false;
  } catch (err) {
    show(errorBox, err?.message || "Could not start reset session.");
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

  btn.disabled = true;
  btn.textContent = "Updating…";

  try {
    // Must have a valid session here
    const { data: userData, error: userErr } = await supabase.auth.getUser();
    if (userErr || !userData?.user) {
      throw new Error("Recovery session missing. Please request a new reset email.");
    }

    const { error } = await supabase.auth.updateUser({ password: p1 });
    if (error) throw error;

    // IMPORTANT: sign out so you will test login correctly with the NEW password
    await supabase.auth.signOut();

    show(successBox, "Password updated ✅ Please login with your new password.");
    setTimeout(() => {
      window.location.href = "/auth/login.html";
    }, 900);
  } catch (err) {
    show(errorBox, err?.message || "Password update failed.");
  } finally {
    btn.disabled = false;
    btn.textContent = "Update password";
  }
});

init();