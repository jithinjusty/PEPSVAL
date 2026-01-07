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
  }

  // If already logged in, route correctly
  const { data: sessionData } = await supabase.auth.getSession();
  if (sessionData?.session) {
    await routeAfterLogin(sessionData.session.user.id);
    return;
  }

  togglePw?.addEventListener("click", () => {
    passEl.type = passEl.type === "password" ? "text" : "password";
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

    await routeAfterLogin(data.user.id);
    setLoading(false);
  });

  async function routeAfterLogin(userId) {
    const { data: profile, error } = await supabase
      .from("profiles")
      .select("setup_complete")
      .eq("id", userId)
      .maybeSingle();

    // If no profile or setup not complete => go setup
    if (error || !profile || profile.setup_complete !== true) {
      window.location.href = "/setup/profile-setup.html";
      return;
    }

    // setup done => dashboard
    window.location.href = "/dashboard.html";
  }
});