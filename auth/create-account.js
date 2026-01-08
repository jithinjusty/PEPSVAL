// /create-account.js
import { supabase } from "/js/supabase.js";

const form = document.getElementById("createForm");
const errorBox = document.getElementById("errorBox");
const successBox = document.getElementById("successBox");
const btn = document.getElementById("createBtn");

function show(el, msg) {
  el.style.display = "block";
  el.textContent = msg;
}
function hide(el) {
  el.style.display = "none";
  el.textContent = "";
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  hide(errorBox);
  hide(successBox);

  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;
  const confirm = document.getElementById("confirmPassword").value;

  if (!email) return show(errorBox, "Please enter your email.");
  if (!password) return show(errorBox, "Please enter a password.");
  if (password.length < 6) return show(errorBox, "Password must be at least 6 characters.");
  if (password !== confirm) return show(errorBox, "Passwords do not match.");

  btn.disabled = true;
  btn.textContent = "Creating…";

  try {
    // MUST be in Supabase Redirect URLs
    const emailRedirectTo = `${location.origin}/auth/login.html`;

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo }
    });

    if (error) {
      show(errorBox, error.message || "Create account failed.");
      return;
    }

    // If confirm email is ON: session is null and email must arrive
    if (!data?.session) {
      show(successBox, "Account created ✅ Please check your email to confirm, then login.");
      return;
    }

    // If confirm email OFF: go setup
    window.location.href = "/setup/profile-setup.html";
  } catch (err) {
    show(errorBox, err?.message || "Unexpected error. Please try again.");
    console.error(err);
  } finally {
    btn.disabled = false;
    btn.textContent = "Create account";
  }
});