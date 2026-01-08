// /auth/login.js
import { supabase } from "/js/supabase.js";

const $ = (id) => document.getElementById(id);

const emailEl = $("email");
const passEl = $("password");
const form = $("loginForm");
const errorBox = $("errorBox");

function showError(msg) {
  if (!errorBox) return;
  errorBox.style.display = "block";
  errorBox.textContent = msg;
}
function clearError() {
  if (!errorBox) return;
  errorBox.style.display = "none";
  errorBox.textContent = "";
}

async function alreadyLoggedInGo() {
  const { data } = await supabase.auth.getUser();
  if (data?.user) window.location.href = "/dashboard/";
}

alreadyLoggedInGo();

form?.addEventListener("submit", async (e) => {
  e.preventDefault();
  clearError();

  const email = (emailEl?.value || "").trim();
  const password = passEl?.value || "";

  if (!email || !password) {
    showError("Please enter email and password.");
    return;
  }

  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    showError(error.message);
    return;
  }

  // ✅ ALWAYS go to dashboard folder
  window.location.href = "/dashboard/";
});