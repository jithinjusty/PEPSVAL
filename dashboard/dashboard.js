import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";

const toast = document.getElementById("toast");
function showToast(msg){
  if(!toast) return alert(msg);
  toast.textContent = msg;
  toast.hidden = false;
  clearTimeout(showToast._t);
  showToast._t = setTimeout(()=>{ toast.hidden = true; }, 2200);
}

const avatarBtn = document.getElementById("avatarBtn");
const avatarImg = document.getElementById("avatarImg");
const avatarFallback = document.getElementById("avatarFallback");
const menu = document.getElementById("profileMenu");
const menuName = document.getElementById("menuName");
const menuEmail = document.getElementById("menuEmail");
const logoutBtn = document.getElementById("logoutBtn");

// Bottom nav placeholders
document.getElementById("navPlus")?.addEventListener("click", ()=>showToast("Create post coming next."));
document.getElementById("navJobs")?.addEventListener("click", ()=>showToast("Jobs coming next."));
document.getElementById("navSearch")?.addEventListener("click", ()=>showToast("Search coming next."));
document.getElementById("navMessages")?.addEventListener("click", ()=>showToast("Messages coming next."));

// Menu open/close
function openMenu(){
  menu?.classList.add("open");
  avatarBtn?.setAttribute("aria-expanded","true");
  menu?.setAttribute("aria-hidden","false");
}
function closeMenu(){
  menu?.classList.remove("open");
  avatarBtn?.setAttribute("aria-expanded","false");
  menu?.setAttribute("aria-hidden","true");
}
avatarBtn?.addEventListener("click",(e)=>{
  e.stopPropagation();
  if(menu?.classList.contains("open")) closeMenu();
  else openMenu();
});
document.addEventListener("click", ()=>closeMenu());
menu?.addEventListener("click",(e)=>e.stopPropagation());
document.addEventListener("keydown",(e)=>{ if(e.key==="Escape") closeMenu(); });

function setAvatarFromName(nameOrEmail){
  const letter = (nameOrEmail || "P").trim().charAt(0).toUpperCase() || "P";
  avatarFallback.textContent = letter;
  avatarFallback.style.display = "flex";
  avatarImg.style.display = "none";
}
function setAvatar(url, fallbackName){
  if(url){
    avatarImg.src = url;
    avatarImg.onload = ()=>{
      avatarImg.style.display = "block";
      avatarFallback.style.display = "none";
    };
    avatarImg.onerror = ()=>setAvatarFromName(fallbackName);
  }else{
    setAvatarFromName(fallbackName);
  }
}

// Supabase keys (from your existing setup)
const SUPABASE_URL = (window.SUPABASE_URL || localStorage.getItem("SUPABASE_URL") || "").trim();
const SUPABASE_ANON_KEY = (window.SUPABASE_ANON_KEY || localStorage.getItem("SUPABASE_ANON_KEY") || "").trim();

let sb = null;
if(SUPABASE_URL && SUPABASE_ANON_KEY){
  sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}

async function redirectToLogin(){
  // your real login page is in /auth/
  window.location.href = "/auth/login.html";
}

async function boot(){
  // If no supabase keys, still show dashboard UI (demo mode)
  if(!sb){
    menuName.textContent = "Demo user";
    menuEmail.textContent = "Add Supabase keys to enable auth";
    setAvatar("", "Demo user");
    logoutBtn?.addEventListener("click", ()=>redirectToLogin());
    return;
  }

  const { data: { session } } = await sb.auth.getSession();
  if(!session?.user){
    await redirectToLogin();
    return;
  }

  const email = session.user.email || "";
  menuEmail.textContent = email;

  // Load profile (if table exists)
  let fullName = "";
  let avatarUrl = "";
  try{
    const { data: profile } = await sb
      .from("profiles")
      .select("full_name, avatar_url")
      .eq("id", session.user.id)
      .maybeSingle();

    fullName = profile?.full_name || "";
    avatarUrl = profile?.avatar_url || "";
  }catch(_){}

  const displayName = fullName || (email ? email.split("@")[0] : "User");
  menuName.textContent = displayName;
  setAvatar(avatarUrl, displayName);

  logoutBtn?.addEventListener("click", async ()=>{
    closeMenu();
    try{ await sb.auth.signOut(); }catch(_){}
    await redirectToLogin();
  });
}

boot();