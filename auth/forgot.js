// forgot.js
import { supabase } from "/js/supabase.js";

const form = document.getElementById("forgotForm");
const errorBox = document.getElementById("errorBox");
const successBox = document.getElementById("successBox");

function showError(msg) {
  if (!errorBox) return;
  errorBox.style.display = "block";
  errorBox.textContent = msg;
}

function hideError() {
  if (!errorBox) return;
  errorBox.style.display = "none";
  errorBox.textContent = "";
}

function showSuccess(msg) {
  if (!successBox) {
    alert(msg);
    return;
  }
  successBox.style.display = "block";
  successBox.textContent = msg;
}

function hideSuccess() {
  if (!successBox) return;
  successBox.style.display = "none";
  successBox.textContent = "";
}

function ensureSupabase() {
  if (!supabase) {
    showError("Supabase is not initialized. Check /js/supabase.js");
    return false;
  }
  return true;
}

form?.addEventListener("submit", async (e) => {
  e.preventDefault();
  hideError();
  hideSuccess();

  if (!ensureSupabase()) return;

  const email = document.getElementById("email")?.value?.trim() || "";
  if (!email) return showError("Please enter your email.");

  const btn = document.getElementById("sendBtn");
  const oldText = btn?.textContent;
  if (btn) {
    btn.disabled = true;
    btn.textContent = "Sending...";
  }

  try {
    // This must match a page you already have (you said reset.html exists in root)
    const redirectTo = `${location.origin}/reset.html`;

    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });

    if (error) {
      showError(error.message || "Could not send reset email.");
      return;
    }

    showSuccess("Reset email sent! Check your inbox (and spam).");

  } catch (err) {
    showError(err?.message || "Unexpected error. Open console to check.");
    console.error(err);
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = oldText || "Send reset link";
    }
  }
});