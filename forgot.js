import { supabase } from "./js/supabase.js";

document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("forgotForm");
  const email = document.getElementById("email");
  const errorBox = document.getElementById("errorBox");
  const successBox = document.getElementById("successBox");
  const debugBox = document.getElementById("debugBox");

  // Prove JS is running
  if (debugBox) {
    debugBox.style.display = "block";
    debugBox.textContent = "forgot.js loaded ✅";
    // keep it for 1.5s then hide
    setTimeout(() => { debugBox.style.display = "none"; }, 1500);
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

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const em = (email.value || "").trim();
    if (!em) return showError("Please enter your email.");

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(em, {
        redirectTo: window.location.origin + "/reset.html"
      });

      if (error) return showError(error.message);

      showSuccess("If an account exists for this email, a reset link will be sent.");
    } catch (err) {
      showError(err?.message || "Something went wrong. Please try again.");
    }
  });
});