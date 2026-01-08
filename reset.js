import { supabase } from "/js/supabase.js";

const form = document.getElementById("resetForm");
const msg = document.getElementById("msg");

const pwEl = document.getElementById("password");
const confirmEl = document.getElementById("confirm");
const submitBtn = document.getElementById("submitBtn");

const togglePw = document.getElementById("togglePw");
const toggleConfirm = document.getElementById("toggleConfirm");

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
function togglePassword(input, btn) {
  const isPw = input.type === "password";
  input.type = isPw ? "text" : "password";
  btn.textContent = isPw ? "Hide" : "Show";
}

togglePw.addEventListener("click", () => togglePassword(pwEl, togglePw));
toggleConfirm.addEventListener("click", () => togglePassword(confirmEl, toggleConfirm));

// --- IMPORTANT: Ensure session exists from recovery link ---
// Supabase reset links may include tokens in URL hash (#access_token=...&refresh_token=...&type=recovery)
async function ensureRecoverySessionFromUrl() {
  const hash = (location.hash || "").replace(/^#/, "");
  const params = new URLSearchParams(hash);
  const access_token = params.get("access_token");
  const refresh_token = params.get("refresh_token");
  const type = params.get("type");

  if (access_token && refresh_token && type === "recovery") {
    const { error } = await supabase.auth.setSession({ access_token, refresh_token });
    if (error) {
      setMsg("err", "This reset link is invalid or expired. Please request a new reset link.");
      return false;
    }
    return true;
  }

  // Some setups use "code" query param instead of hash
  const code = new URLSearchParams(location.search).get("code");
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      setMsg("err", "This reset link is invalid or expired. Please request a new reset link.");
      return false;
    }
    return true;
  }

  // If user opened reset page directly without link
  const { data } = await supabase.auth.getSession();
  if (!data?.session) {
    setMsg("err", "Open this page using the reset link sent to your email.");
    return false;
  }
  return true;
}

await ensureRecoverySessionFromUrl();

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  clearMsg();

  const password = pwEl.value || "";
  const confirm = confirmEl.value || "";

  if (!password || password.length < 6) return setMsg("err", "Password must be at least 6 characters.");
  if (password !== confirm) return setMsg("err", "Passwords do not match.");

  setLoading(true);

  try {
    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData?.session) {
      setMsg("err", "Your reset session expired. Please request a new reset link.");
      setLoading(false);
      return;
    }

    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      setMsg("err", error.message || "Could not update password. Please try again.");
      setLoading(false);
      return;
    }

    setMsg("ok", "Password updated successfully! You can now login with your new password.");
    form.reset();

    // Optional: sign out so user must login fresh with new password
    await supabase.auth.signOut();
  } catch (err) {
    setMsg("err", err?.message || "Something went wrong. Please try again.");
  } finally {
    setLoading(false);
  }
});