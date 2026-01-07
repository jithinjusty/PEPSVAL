import { supabase } from "../js/supabase.js";

document.addEventListener("DOMContentLoaded", async () => {
  const form = document.getElementById("loginForm");
  const emailEl = document.getElementById("email");
  const passEl = document.getElementById("password");
  const errorBox = document.getElementById("errorBox");
  const togglePw = document.getElementById("togglePw");
  const loginBtn = document.getElementById("loginBtn");

  function showError(msg) {
    errorBox.textContent = msg;
    errorBox.style.display = "block";
  }
  function clearError() {
    errorBox.textContent = "";
    errorBox.style.display = "none";
  }
  function setLoading(on) {
    loginBtn.disabled = on;
    loginBtn.textContent = on ? "Logging in…" : "Log in";
    loginBtn.style.opacity = on ? "0.85" : "1";
  }

  // If already logged in, route immediately
  const { data: sessionData } = await supabase.auth.getSession();
  if (sessionData?.session) {
    window.location.href = "/dashboard.html";
    return;
  }

  togglePw?.addEventListener("click", () => {
    const isPw = passEl.type === "password";
    passEl.type = isPw ? "text" : "password";
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    clearError();

    const email = (emailEl.value || "").trim();
    const password = passEl.value || "";

    if (!email) return showError("Please enter your email.");
    if (!password) return showError("Please enter your password.");

    setLoading(true);

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error || !data?.user) {
      setLoading(false);
      return showError("Incorrect email or password.");
    }

    // Route: profile complete? -> dashboard, else -> profile setup
    try {
      const userId = data.user.id;

      const { data: profile, error: pErr } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .maybeSingle();

      if (pErr || !profile) {
        window.location.href = "/profile-setup.html";
        return;
      }

      const complete =
        !!(profile.full_name || profile.name || profile.first_name) &&
        !!(profile.account_type || profile.user_type);

      window.location.href = complete ? "/dashboard.html" : "/profile-setup.html";
    } catch (e2) {
      window.location.href = "/profile-setup.html";
    } finally {
      setLoading(false);
    }
  });
});