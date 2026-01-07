// auth/login.js (FULL)
// - GitHub Pages safe
// - Uses Supabase URL + anon key from window OR localStorage
// - Redirects AFTER LOGIN to: /dashboard/ (folder route)

import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";

// ---------- CONFIG ----------
const DASHBOARD_URL = "/dashboard/";     // ✅ your new folder dashboard
const LOGIN_FALLBACK = "/auth/login.html";

// Reads keys from:
// 1) window.SUPABASE_URL / window.SUPABASE_ANON_KEY (if you set them somewhere)
// 2) localStorage SUPABASE_URL / SUPABASE_ANON_KEY (most common in your build)
const SUPABASE_URL = (window.SUPABASE_URL || localStorage.getItem("SUPABASE_URL") || "").trim();
const SUPABASE_ANON_KEY = (window.SUPABASE_ANON_KEY || localStorage.getItem("SUPABASE_ANON_KEY") || "").trim();

function $(id) { return document.getElementById(id); }

const form = $("loginForm");
const emailEl = $("email");
const passEl = $("password");
const togglePw = $("togglePw");
const errorBox = $("errorBox");
const loginBtn = $("loginBtn");

function showError(msg) {
  errorBox.style.display = "block";
  errorBox.textContent = msg;
}

function clearError() {
  errorBox.style.display = "none";
  errorBox.textContent = "";
}

function disableForm(disabled) {
  loginBtn.disabled = disabled;
  emailEl.disabled = disabled;
  passEl.disabled = disabled;
  togglePw.disabled = disabled;
  loginBtn.textContent = disabled ? "Logging in..." : "Log in";
}

function isValidHttpUrl(u) {
  return /^https?:\/\/.+/i.test(u);
}

// ---------- INIT SUPABASE ----------
let sb = null;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  showError("Supabase is not configured. Add SUPABASE_URL and SUPABASE_ANON_KEY.");
} else if (!isValidHttpUrl(SUPABASE_URL)) {
  showError("Invalid SUPABASE_URL. It must start with https://");
} else {
  sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}

// ---------- PASSWORD TOGGLE ----------
togglePw.addEventListener("click", () => {
  const isHidden = passEl.type === "password";
  passEl.type = isHidden ? "text" : "password";
  togglePw.textContent = isHidden ? "Hide" : "Show";
});

// ---------- OPTIONAL: If already logged in, go to dashboard ----------
(async () => {
  if (!sb) return;
  try {
    const { data: { session } } = await sb.auth.getSession();
    if (session?.user) {
      window.location.href = DASHBOARD_URL; // ✅ always folder route
    }
  } catch (_) {}
})();

// ---------- LOGIN SUBMIT ----------
form.addEventListener("submit", async (e) => {
  e.preventDefault();
  clearError();

  if (!sb) {
    showError("Supabase is not configured.");
    return;
  }

  const email = (emailEl.value || "").trim();
  const password = passEl.value || "";

  if (!email) return showError("Please enter your email.");
  if (!password) return showError("Please enter your password.");

  disableForm(true);

  try {
    const { error } = await sb.auth.signInWithPassword({ email, password });
    if (error) {
      disableForm(false);
      return showError(error.message || "Login failed.");
    }

    // ✅ SUCCESS → Always go to dashboard folder
    window.location.href = DASHBOARD_URL;
  } catch (err) {
    disableForm(false);
    showError("Login failed. Please try again.");
    console.error(err);
  }
});

// ---------- SAFETY: If this page is opened as /auth/login (without .html), send to real file ----------
if (!location.pathname.endsWith("/login.html") && location.pathname.endsWith("/auth/login")) {
  window.location.replace(LOGIN_FALLBACK);
}