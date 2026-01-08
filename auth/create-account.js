// create-account.js
import { supabase } from "/js/supabase.js";

const form = document.getElementById("createForm");
const errorBox = document.getElementById("errorBox");

function showError(msg) {
  errorBox.style.display = "block";
  errorBox.textContent = msg;
}

function hideError() {
  errorBox.style.display = "none";
  errorBox.textContent = "";
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

  if (!ensureSupabase()) return;

  const firstName = document.getElementById("firstName")?.value?.trim() || "";
  const lastName = document.getElementById("lastName")?.value?.trim() || "";
  const email = document.getElementById("email")?.value?.trim() || "";
  const password = document.getElementById("password")?.value || "";
  const confirmPassword = document.getElementById("confirmPassword")?.value || "";

  if (!email) return showError("Please enter your email.");
  if (!password) return showError("Please enter a password.");
  if (password.length < 6) return showError("Password must be at least 6 characters.");
  if (password !== confirmPassword) return showError("Passwords do not match.");

  const btn = document.getElementById("createBtn");
  const oldText = btn?.textContent;
  if (btn) {
    btn.disabled = true;
    btn.textContent = "Creating...";
  }

  try {
    // IMPORTANT: redirect goes to your reset page / email confirm page when user clicks email link
    const emailRedirectTo = `${location.origin}/auth/login.html`;

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          first_name: firstName,
          last_name: lastName,
          full_name: `${firstName} ${lastName}`.trim()
        },
        emailRedirectTo
      }
    });

    if (error) {
      showError(error.message || "Create account failed.");
      return;
    }

    // If email confirmations are ON: user must verify email first
    // If OFF: session may exist immediately
    const session = data?.session;

    if (session) {
      // Signed in instantly → go to setup
      window.location.href = "/setup/profile-setup.html";
      return;
    }

    // Otherwise show message
    alert("Account created! Please check your email to confirm, then login.");
    window.location.href = "/auth/login.html";

  } catch (err) {
    showError(err?.message || "Unexpected error. Open console to check.");
    console.error(err);
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = oldText || "Create account";
    }
  }
});