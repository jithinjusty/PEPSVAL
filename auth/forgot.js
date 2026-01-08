import { supabase } from "/js/supabase.js";

const form = document.getElementById("forgotForm");
const errorBox = document.getElementById("errorBox");
const successBox = document.getElementById("successBox");

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  errorBox.textContent = "";
  successBox.textContent = "";

  const email = document.getElementById("email").value.trim();
  if (!email) {
    errorBox.textContent = "Enter your email";
    return;
  }

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: location.origin + "/reset.html"
  });

  if (error) {
    errorBox.textContent = error.message;
    return;
  }

  successBox.textContent = "Reset email sent. Check inbox.";
});