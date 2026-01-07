import { supabase } from "../js/supabase.js";

document.addEventListener("DOMContentLoaded", async () => {
  const form = document.getElementById("loginForm");
  const emailEl = document.getElementById("email");
  const passEl = document.getElementById("password");
  const errorBox = document.getElementById("errorBox");
  const loginBtn = document.getElementById("loginBtn");

  const showError = (msg) => {
    if (!errorBox) return alert(msg);
    errorBox.textContent = msg;
    errorBox.style.display = "block";
  };
  const clearError = () => {
    if (!errorBox) return;
    errorBox.textContent = "";
    errorBox.style.display = "none";
  };
  const setLoading = (on) => {
    if (!loginBtn) return;
    loginBtn.disabled = on;
    loginBtn.textContent = on ? "Logging in…" : "Log in";
  };

  // If already logged in, route correctly
  const { data: sessionData } = await supabase.auth.getSession();
  if (sessionData?.session) {
    await routeAfterAuth(sessionData.session.user.id);
    return;
  }

  form?.addEventListener("submit", async (e) => {
    e.preventDefault();
    clearError();

    const email = (emailEl?.value || "").trim();
    const password = passEl?.value || "";

    if (!email) return showError("Please enter your email.");
    if (!password) return showError("Please enter your password.");

    setLoading(true);

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error || !data?.user) {
      setLoading(false);
      return showError("Incorrect email or password.");
    }

    await routeAfterAuth(data.user.id);
    setLoading(false);
  });

  async function routeAfterAuth(userId) {
    // Read profile
    const { data: profile, error } = await supabase
      .from("profiles")
      .select("setup_complete")
      .eq("id", userId)
      .maybeSingle();

    // If no profile row OR setup not complete -> profile setup
    if (error || !profile || profile.setup_complete !== true) {
      window.location.href = "/setup/profile-setup.html";
      return;
    }

    // Otherwise dashboard
    window.location.href = "/dashboard.html";
  }
});