import { supabase } from "./js/supabase.js";

document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("forgotForm");
  const email = document.getElementById("email");
  const errorBox = document.getElementById("errorBox");
  const successBox = document.getElementById("successBox");
  const debugBox = document.getElementById("debugBox");

  const btn = form?.querySelector('button[type="submit"]');

  // Prove JS is running
  if (debugBox) {
    debugBox.style.display = "block";
    debugBox.textContent = "forgot.js loaded ✅";
    setTimeout(() => { debugBox.style.display = "none"; }, 1200);
  }

  function setLoading(isLoading) {
    if (!btn) return;
    btn.disabled = isLoading;
    btn.textContent = isLoading ? "Sending…" : "Send reset link";
    btn.style.opacity = isLoading ? "0.85" : "1";
  }

  function showError(msg) {
    errorBox.textContent = msg;
    errorBox.style.display = "block";
    successBox.style.display = "none";
    successBox.textContent = "";
  }

  function showSuccess(msg) {
    successBox.textContent = msg;
    successBox.style.display = "block";
    errorBox.style.display = "none";
    errorBox.textContent = "";
  }

  function showDebug(msg) {
    if (!debugBox) return;
    debugBox.style.display = "block";
    debugBox.textContent = msg;
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    // DO NOT clear the input
    const em = (email.value || "").trim();
    if (!em) return showError("Please enter your email.");

    // Immediately show action happened
    showSuccess("Sending reset link…");
    setLoading(true);

    try {
      showDebug("Request: supabase.auth.resetPasswordForEmail()");
      const { data, error } = await supabase.auth.resetPasswordForEmail(em, {
        redirectTo: window.location.origin + "/reset.html"
      });

      if (error) {
        showDebug("Supabase error: " + error.message);
        return showError(error.message);
      }

      showDebug("Success: request accepted by Supabase.");
      showSuccess("If an account exists for this email, a reset link will be sent.");
    } catch (err) {
      const msg = err?.message || String(err);

      // Common fetch/network issues show here
      showDebug("Network/JS error: " + msg);
      showError("Network error. Check Supabase URL/key and try again.");
    } finally {
      setLoading(false);
    }
  });
});