import { supabase } from "./js/supabase.js";

document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("createForm");
  const firstName = document.getElementById("firstName");
  const lastName = document.getElementById("lastName");
  const email = document.getElementById("email");
  const password = document.getElementById("password");
  const confirmPassword = document.getElementById("confirmPassword");
  const errorBox = document.getElementById("errorBox");

  function showError(msg) {
    errorBox.textContent = msg;
    errorBox.style.display = "block";
  }
  function clearError() {
    errorBox.textContent = "";
    errorBox.style.display = "none";
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    clearError();

    const fn = (firstName.value || "").trim();
    const ln = (lastName.value || "").trim();
    const em = (email.value || "").trim();
    const pw = password.value || "";
    const cpw = confirmPassword.value || "";

    if (!fn) return showError("Please enter your first name.");
    if (!ln) return showError("Please enter your last name.");
    if (!em) return showError("Please enter your email.");
    if (!pw) return showError("Please create a password.");
    if (pw.length < 6) return showError("Password must be at least 6 characters.");
    if (pw !== cpw) return showError("Passwords do not match.");

    const fullName = `${fn} ${ln}`.trim();

    // Signup (email confirm will happen via template if enabled)
    const { data, error } = await supabase.auth.signUp({
      email: em,
      password: pw,
      options: {
        data: { full_name: fullName, first_name: fn, last_name: ln }
      }
    });

    if (error) return showError(error.message);

    // If email confirmations are ON, user may not be logged in yet.
    // So we show a friendly message and route to login.
    if (!data?.session) {
      showError("Please check your email and confirm your account. Then log in.");
      return;
    }

    // If session exists, send to profile setup
    window.location.href = "/profile-setup.html";
  });
});