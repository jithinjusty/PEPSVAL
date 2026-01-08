import { supabase } from "/js/supabase.js";

const form = document.getElementById("forgotForm");
const msg = document.getElementById("msg");
const emailEl = document.getElementById("email");
const submitBtn = document.getElementById("submitBtn");

function setMsg(type, text) {
  msg.hidden = false;
  msg.className = `msg ${type}`;
  msg.textContent = text;
}
function clearMsg() {
  msg.hidden = true;
  msg.className = "msg";
  msg.textContent = "";
}
function setLoading(isLoading) {
  submitBtn.disabled = isLoading;
  submitBtn.classList.toggle("loading", isLoading);
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  clearMsg();

  const email = (emailEl.value || "").trim().toLowerCase();
  if (!email) return setMsg("err", "Please enter your email.");

  setLoading(true);

  try {
    // Reset link should land on your ROOT reset page
    const redirectTo = `${location.origin}/reset.html`;

    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });

    if (error) {
      setMsg("err", error.message || "Could not send reset link. Please try again.");
      return;
    }

    setMsg("ok", "Reset link sent! Please check your email (and spam folder).");
    form.reset();
  } catch (err) {
    setMsg("err", err?.message || "Something went wrong. Please try again.");
  } finally {
    setLoading(false);
  }
});