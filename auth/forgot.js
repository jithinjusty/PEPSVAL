// /forgot.js
import { supabase } from "/js/supabase.js";

const form = document.getElementById("forgotForm");
const emailInput = document.getElementById("email");
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

  const email = (emailInput.value || "").trim().toLowerCase();
  if (!email) return show(errorBox, "Please enter your email.");

  btn.disabled = true;
  btn.textContent = "Sending…";

  try {
    // IMPORTANT: force redirect to YOUR reset page
    const redirectTo = `${window.location.origin}/reset.html`;

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo,
    });

    if (error) throw error;

    show(
      successBox,
      "Reset link sent ✅ Please check your email (and spam). Open the link and set a new password."
    );
  } catch (err) {
    show(errorBox, err?.message || "Could not send reset email.");
  } finally {
    btn.disabled = false;
    btn.textContent = "Send reset link";
  }
});