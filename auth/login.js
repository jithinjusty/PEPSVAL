// /auth/login.js (FULL) — uses /js/config.js + /js/supabaseClient.js

import { supabase } from "/js/supabaseClient.js";
import { ROUTES } from "/js/config.js";

function $(id) { return document.getElementById(id); }

const form = $("loginForm");
const emailEl = $("email");
const passEl = $("password");
const errorBox = $("errorBox");
const loginBtn = $("loginBtn");
const togglePw = $("togglePw");

function showError(msg) {
  errorBox.style.display = "block";
  errorBox.textContent = msg;
}
function clearError() {
  errorBox.style.display = "none";
  errorBox.textContent = "";
}
function setBusy(busy) {
  loginBtn.disabled = busy;
  emailEl.disabled = busy;
  passEl.disabled = busy;
  togglePw.disabled = busy;
  loginBtn.textContent = busy ? "Logging in..." : "Log in";
}

togglePw?.addEventListener("click", () => {
  const hidden = passEl.type === "password";
  passEl.type = hidden ? "text" : "password";
  togglePw.textContent = hidden ? "Hide" : "Show";
});

// If already logged in → go dashboard
(async () => {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) window.location.href = ROUTES.dashboard;
  } catch (_) {}
})();

form?.addEventListener("submit", async (e) => {
  e.preventDefault();
  clearError();

  const email = (emailEl.value || "").trim();
  const password = passEl.value || "";

  if (!email) return showError("Please enter your email.");
  if (!password) return showError("Please enter your password.");

  setBusy(true);

  try {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setBusy(false);
      return showError(error.message || "Login failed.");
    }

    // ✅ Always go dashboard folder (no 404)
    window.location.href = ROUTES.dashboard;
  } catch (err) {
    console.error(err);
    setBusy(false);
    showError("Login failed. Please try again.");
  }
});