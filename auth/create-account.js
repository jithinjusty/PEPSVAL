import { supabase } from "/js/supabase.js";

const form = document.getElementById("createForm");
const msg = document.getElementById("msg");

const emailEl = document.getElementById("email");
const accountTypeEl = document.getElementById("accountType");
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
  btn.setAttribute("aria-label", isPw ? "Hide password" : "Show password");
}

togglePw.addEventListener("click", () => togglePassword(pwEl, togglePw));
toggleConfirm.addEventListener("click", () => togglePassword(confirmEl, toggleConfirm));

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  clearMsg();

  const email = (emailEl.value || "").trim().toLowerCase();
  const accountType = accountTypeEl?.value || "";
  const password = pwEl.value || "";
  const confirm = confirmEl.value || "";

  if (!email) return setMsg("err", "Please enter your email.");
  if (!accountType) return setMsg("err", "Please select an Account Type.");
  if (!password || password.length < 6) return setMsg("err", "Password must be at least 6 characters.");
  if (password !== confirm) return setMsg("err", "Passwords do not match.");

  setLoading(true);

  try {
    // Important: send user back to login after email confirmation
    const emailRedirectTo = `${location.origin}/auth/login.html`;

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo,
        data: { account_type: accountType }
      }
    });

    // Supabase behaviour:
    // - New email: user.identities usually has 1 identity (created)
    // - Existing email: often returns a user with identities = [] (no new identity)
    const identities = data?.user?.identities;
    if (data?.user && Array.isArray(identities) && identities.length === 0) {
      setMsg("err", "This email is already registered with PEPSVAL. Please login or reset your password.");
      setLoading(false);
      return;
    }

    if (error) {
      const m = (error.message || "").toLowerCase();
      if (m.includes("already") || m.includes("registered") || m.includes("exists")) {
        setMsg("err", "This email is already registered with PEPSVAL. Please login or reset your password.");
      } else {
        setMsg("err", error.message || "Could not create account. Please try again.");
      }
      setLoading(false);
      return;
    }

    // If email confirmation is ON, user may be created but session null until confirmed.
    setMsg("ok", "Account created! Please check your email to confirm, then come back and login.");
    form.reset();
  } catch (err) {
    setMsg("err", err?.message || "Something went wrong. Please try again.");
  } finally {
    setLoading(false);
  }
});
