// /dashboard/dashboard.js
import { supabase } from "/js/supabase.js";

const ROUTES = {
  login: "/auth/login.html",            // change if your login file is elsewhere
  profileSetup: "/setup/profile-setup.html",
  settings: "/dashboard/settings.html",
  dashboard: "/dashboard/index.html"
};

const avatarBtn = document.getElementById("avatarBtn");
const avatarMenu = document.getElementById("avatarMenu");

const avatarImg = document.getElementById("avatarImg");
const avatarFallback = document.getElementById("avatarFallback");

const menuAvatarImg = document.getElementById("menuAvatarImg");
const menuAvatarFallback = document.getElementById("menuAvatarFallback");
const menuName = document.getElementById("menuName");
const menuSmall = document.getElementById("menuSmall");

const goProfile = document.getElementById("goProfile");
const goSettings = document.getElementById("goSettings");
const doLogout = document.getElementById("doLogout");

function initialsFromName(name) {
  if (!name) return "P";
  const parts = name.trim().split(/\s+/).slice(0, 2);
  const letters = parts.map(p => p[0]?.toUpperCase()).filter(Boolean);
  return letters.join("") || "P";
}

function openMenu() {
  avatarMenu.style.display = "block";
  avatarMenu.setAttribute("aria-hidden", "false");
  avatarBtn.setAttribute("aria-expanded", "true");
}

function closeMenu() {
  avatarMenu.style.display = "none";
  avatarMenu.setAttribute("aria-hidden", "true");
  avatarBtn.setAttribute("aria-expanded", "false");
}

function toggleMenu() {
  const isOpen = avatarMenu.style.display === "block";
  isOpen ? closeMenu() : openMenu();
}

function setAvatar(photoUrl, displayName) {
  const initials = initialsFromName(displayName);

  avatarFallback.textContent = initials;
  menuAvatarFallback.textContent = initials;

  // reset
  avatarImg.style.display = "none";
  menuAvatarImg.style.display = "none";
  avatarImg.removeAttribute("src");
  menuAvatarImg.removeAttribute("src");

  if (photoUrl && typeof photoUrl === "string" && photoUrl.startsWith("http")) {
    avatarImg.src = photoUrl;
    menuAvatarImg.src = photoUrl;

    avatarImg.onload = () => { avatarImg.style.display = "block"; };
    menuAvatarImg.onload = () => { menuAvatarImg.style.display = "block"; };
  }
}

async function requireAuth() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) {
    window.location.href = ROUTES.login;
    return null;
  }
  return session.user;
}

async function loadProfile(userId) {
  // Only select columns that should exist in your profiles table
  const { data, error } = await supabase
    .from("profiles")
    .select("full_name, avatar_url, account_type")
    .eq("id", userId)
    .single();

  if (error) return null;
  return data;
}

function wireUI() {
  avatarBtn.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    toggleMenu();
  });

  document.addEventListener("click", () => closeMenu());
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeMenu();
  });
  avatarMenu.addEventListener("click", (e) => e.stopPropagation());

  goProfile.addEventListener("click", () => {
    window.location.href = ROUTES.profileSetup;
  });

  goSettings.addEventListener("click", () => {
    window.location.href = ROUTES.settings;
  });

  doLogout.addEventListener("click", async () => {
    closeMenu();
    await supabase.auth.signOut();
    window.location.href = ROUTES.login;
  });

  // “+” button (for later posts)
  const openCreate = document.getElementById("openCreate");
  if (openCreate) {
    openCreate.addEventListener("click", () => {
      alert("Create post — coming next.");
    });
  }
}

async function init() {
  wireUI();

  const user = await requireAuth();
  if (!user) return;

  // Load profile and show avatar/name
  const profile = await loadProfile(user.id);

  const displayName =
    profile?.full_name ||
    user.user_metadata?.full_name ||
    user.email ||
    "Your profile";

  menuName.textContent = displayName;
  menuSmall.textContent = "Welcome aboard";

  setAvatar(profile?.avatar_url || null, displayName);
}

init();