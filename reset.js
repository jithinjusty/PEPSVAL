import { supabase } from "./js/supabase.js";

document.addEventListener("DOMContentLoaded", async () => {
  const form = document.getElementById("resetForm");
  const password = document.getElementById("password");
  const confirmPassword = document.getElementById("confirmPassword");

  const infoBox = document.getElementById("infoBox");
  const errorBox = document.getElementById("errorBox");
  const successBox = document.getElementById("successBox");

  function showInfo(msg) {
    infoBox.textContent = msg;
    infoBox.style.display = "block";
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
  function clearAll() {
    errorBox.style.display = "none";
    errorBox.textContent = "";
    successBox.style.display = "none";
    successBox.textContent = "";
  }

  // When user clicks reset link, Supabase will create a session in the browser.
  // We can check if session exists.
  const { data: sessionData } = await supabase.auth.getSession();
  if (!sessionData?.session) {
    showInfo("Reset link loaded. If you see an error, please request a new reset link.");
  } else {
    showInfo("You can now set your new password.");
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    clearAll();

    const pw = password.value || "";
    const cpw = confirmPassword.value || "";

    if (!pw) return showError("Please enter a new password.");
    if (pw.length < 6) return showError("Password must be at least 6 characters.");
    if (!cpw) return showError("Please confirm your new password.");
    if (pw !== cpw) return showError("Passwords do not match.");

    const { error } = await supabase.auth.updateUser({ password: pw });
    if (error) return showError(error.message);

    showSuccess("Password updated successfully. You can now log in.");

    // Optional: sign out the recovery session after reset
    try { await supabase.auth.signOut(); } catch (_) {}

    // After a short delay, take them to login
    setTimeout(() => {
      window.location.href = "/auth/login.html";
    }, 1200);
  });
});