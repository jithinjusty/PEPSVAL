import { supabase } from "../js/supabase.js";

const form = document.getElementById("loginForm");
const errorBox = document.getElementById("errorBox");

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  errorBox.textContent = "";

  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value.trim();

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password
  });

  if (error) {
    errorBox.textContent = error.message;
    return;
  }

  // Check profile completion
  const { data: profile } = await supabase
    .from("profiles")
    .select("profile_completed")
    .eq("id", data.user.id)
    .single();

  if (!profile || profile.profile_completed !== true) {
    window.location.href = "/setup/profile-setup.html";
  } else {
    window.location.href = "/dashboard/";
  }
});