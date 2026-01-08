// /auth/forgot.js
import { supabase } from "/js/supabase.js";

const form = document.getElementById("forgotForm");
const errorBox = document.getElementById("errorBox");
const successBox = document.getElementById("successBox");
const btn = document.getElementById("sendBtn");

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
  if (!email) return show(errorBox, "Please enter your email.");

  btn.disabled = true;
  btn.textContent = "Sending…";

  try {
    // MUST be allowed in Supabase Redirect URLs
    const redirectTo = `${location.origin}/reset.html`;

    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });

    if (error) {
      show(errorBox, error.message || "Could not send reset email.");
      return;
    }

    show(successBox, "Reset link sent ✅ Check inbox/spam.");
  } catch (err) {
    show(errorBox, err?.message || "Unexpected error. Please try again.");
    console.error(err);
  } finally {
    btn.disabled = false;
    btn.textContent = "Send reset link";
  }
});