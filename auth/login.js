import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";

const DASHBOARD_URL = "/dashboard/"; // ✅ correct folder route

const SUPABASE_URL = (window.SUPABASE_URL || localStorage.getItem("SUPABASE_URL") || "").trim();
const SUPABASE_ANON_KEY = (window.SUPABASE_ANON_KEY || localStorage.getItem("SUPABASE_ANON_KEY") || "").trim();

function $(id){ return document.getElementById(id); }
const form = $("loginForm");
const emailEl = $("email");
const passEl = $("password");
const errorBox = $("errorBox");
const loginBtn = $("loginBtn");
const togglePw = $("togglePw");

function showError(msg){
  errorBox.style.display = "block";
  errorBox.textContent = msg;
}
function clearError(){
  errorBox.style.display = "none";
  errorBox.textContent = "";
}
function disableForm(disabled){
  loginBtn.disabled = disabled;
  emailEl.disabled = disabled;
  passEl.disabled = disabled;
  togglePw.disabled = disabled;
  loginBtn.textContent = disabled ? "Logging in..." : "Log in";
}
function isValidHttpUrl(u){ return /^https?:\/\/.+/i.test(u); }

let sb = null;
if(!SUPABASE_URL || !SUPABASE_ANON_KEY){
  showError("Supabase is not configured (missing keys).");
} else if(!isValidHttpUrl(SUPABASE_URL)){
  showError("Invalid SUPABASE_URL (must start with https://).");
} else {
  sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}

togglePw?.addEventListener("click", () => {
  const hidden = passEl.type === "password";
  passEl.type = hidden ? "text" : "password";
  togglePw.textContent = hidden ? "Hide" : "Show";
});

// If already logged in, ALWAYS go dashboard (not setup/settings)
(async ()=>{
  if(!sb) return;
  const { data:{ session } } = await sb.auth.getSession();
  if(session?.user){
    window.location.href = DASHBOARD_URL;
  }
})();

form?.addEventListener("submit", async (e)=>{
  e.preventDefault();
  clearError();
  if(!sb) return showError("Supabase not configured.");

  const email = (emailEl.value || "").trim();
  const password = passEl.value || "";

  if(!email) return showError("Please enter your email.");
  if(!password) return showError("Please enter your password.");

  disableForm(true);
  try{
    const { error } = await sb.auth.signInWithPassword({ email, password });
    if(error){
      disableForm(false);
      return showError(error.message || "Login failed.");
    }
    // ✅ ALWAYS dashboard folder
    window.location.href = DASHBOARD_URL;
  }catch(err){
    console.error(err);
    disableForm(false);
    showError("Login failed. Please try again.");
  }
});