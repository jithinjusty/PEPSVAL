// /dashboard/dashboard.js
import { supabase } from "/js/supabase.js";

const $ = (id) => document.getElementById(id);

async function requireUser() {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data?.user) {
    window.location.href = "/auth/login.html";
    return null;
  }
  return data.user;
}

async function loadProfile(userId) {
  const { data } = await supabase
    .from("profiles")
    .select("full_name, avatar_url")
    .eq("id", userId)
    .maybeSingle();
  return data || {};
}

function setAvatar(el, url, fallbackText = "P") {
  if (!el) return;
  if (url) {
    el.style.backgroundImage = `url("${url}")`;
    el.textContent = "";
  } else {
    el.style.backgroundImage = "";
    el.textContent = fallbackText;
  }
}

function toggleMenu(menu, open) {
  if (!menu) return;
  menu.style.display = open ? "block" : "none";
}

async function main() {
  const user = await requireUser();
  if (!user) return;

  const profile = await loadProfile(user.id);

  const avatarBtn = $("avatarBtn");      // you must have this id in dashboard HTML
  const avatarMenu = $("avatarMenu");    // you must have this id in dashboard HTML
  const avatarName = $("avatarName");    // inside menu
  const logoutBtn = $("logoutBtn");      // inside menu

  // set name
  if (avatarName) avatarName.textContent = profile.full_name || "Pepsval member";

  // set avatar
  setAvatar(avatarBtn, profile.avatar_url, (profile.full_name || "P")[0].toUpperCase());

  // toggle dropdown
  let open = false;
  avatarBtn?.addEventListener("click", (e) => {
    e.preventDefault();
    open = !open;
    toggleMenu(avatarMenu, open);
  });

  document.addEventListener("click", (e) => {
    if (!avatarMenu || !avatarBtn) return;
    if (avatarMenu.contains(e.target) || avatarBtn.contains(e.target)) return;
    open = false;
    toggleMenu(avatarMenu, false);
  });

  // logout
  logoutBtn?.addEventListener("click", async () => {
    await supabase.auth.signOut();
    window.location.href = "/auth/login.html";
  });
}

main();