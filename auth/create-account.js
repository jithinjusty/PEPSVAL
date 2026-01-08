import { supabase } from "/js/supabase.js";

const form = document.getElementById("createForm");
const errorBox = document.getElementById("errorBox");

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  errorBox.textContent = "";

  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;
  const confirm = document.getElementById("confirmPassword").value;

  if (!email || !password) {
    errorBox.textContent = "Email and password required";
    return;
  }

  if (password !== confirm) {
    errorBox.textContent = "Passwords do not match";
    return;
  }

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: location.origin + "/auth/login.html"
    }
  });

  if (error) {
    errorBox.textContent = error.message;
    return;
  }

  alert("Account created. Check your email to confirm.");
  window.location.href = "/auth/login.html";
});