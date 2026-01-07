// dashboard/dashboard.js
// Works on GitHub Pages (static). Uses Supabase if you provide URL + anon key.

import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";

/**
 * HOW THIS FINDS YOUR SUPABASE KEYS:
 * - Preferred: window.SUPABASE_URL and window.SUPABASE_ANON_KEY (from /js/config.js if you have it)
 * - OR: localStorage keys: SUPABASE_URL, SUPABASE_ANON_KEY
 *
 * If you already use a config file elsewhere, keep it.
 * This dashboard will still work.
 */
const SUPABASE_URL =
  window.SUPABASE_URL ||
  localStorage.getItem("SUPABASE_URL") ||
  "";

const SUPABASE_ANON_KEY =
  window.SUPABASE_ANON_KEY ||
  localStorage.getItem("SUPABASE_ANON_KEY") ||
  "";

let supabase = null;
if (SUPABASE_URL && SUPABASE_ANON_KEY) {
  supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}

const $ = (id) => document.getElementById(id);

const avatarBtn = $("avatarBtn");
const avatarImg = $("avatarImg");
const avatarFallback = $("avatarFallback");
const menu = $("menu");
const menuName = $("menuName");
const menuEmail = $("menuEmail");
const logoutBtn = $("logoutBtn");

const plusBtn = $("plusBtn");
const modal = $("postModal");
const overlay = $("modalOverlay");
const closeModalBtn = $("closeModalBtn");
const createPostBtnTop = $("createPostBtnTop");
const publishBtn = $("publishBtn");
const toast = $("toast");

function showToast(msg) {
  toast.textContent = msg;
  toast.hidden = false;
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => (toast.hidden = true), 2200);
}

function openModal() {
  overlay.hidden = false;
  modal.hidden = false;
}
function closeModal() {
  overlay.hidden = true;
  modal.hidden = true;
}

// --- MENU TOGGLE ---
function openMenu() {
  menu.classList.add("show");
  menu.setAttribute("aria-hidden", "false");
}
function closeMenu() {
  menu.classList.remove("show");
  menu.setAttribute("aria-hidden", "true");
}

avatarBtn.addEventListener("click", (e) => {
  e.stopPropagation();
  if (menu.classList.contains("show")) closeMenu();
  else openMenu();
});

document.addEventListener("click", () => closeMenu());
menu.addEventListener("click", (e) => e.stopPropagation());

// --- MODAL ---
plusBtn.addEventListener("click", openModal);
createPostBtnTop.addEventListener("click", (e) => {
  e.preventDefault();
  openModal();
});
overlay.addEventListener("click", closeModal);
closeModalBtn.addEventListener("click", closeModal);

publishBtn.addEventListener("click", () => {
  // UI-only for now
  closeModal();
  showToast("Post saved (UI only for now).");
});

// --- AUTH / PROFILE LOADING ---
async function requireSessionOrRedirect() {
  if (!supabase) {
    showToast("Supabase keys missing (dashboard opened in demo mode).");
    // Demo mode: still show UI
    menuName.textContent = "Demo user";
    menuEmail.textContent = "Add Supabase keys to enable login.";
    setAvatarFromName("Demo user");
    return;
  }

  const { data: { session }, error } = await supabase.auth.getSession();
  if (error) {
    console.error(error);
    window.location.href = "/auth/login.html";
    return;
  }

  if (!session) {
    window.location.href = "/auth/login.html";
    return;
  }

  const email = session.user?.email || "—";
  menuEmail.textContent = email;

  // Try loading profile from public.profiles
  // Common columns: full_name, avatar_url
  let fullName = "";
  let avatarUrl = "";

  try {
    const { data, error: pErr } = await supabase
      .from("profiles")
      .select("full_name, avatar_url")
      .eq("id", session.user.id)
      .maybeSingle();

    if (pErr) {
      console.warn("profiles read error:", pErr.message);
    } else if (data) {
      fullName = data.full_name || "";
      avatarUrl = data.avatar_url || "";
    }
  } catch (e) {
    console.warn("profiles fetch exception:", e);
  }

  // Fallback name
  const displayName =
    fullName ||
    (email.includes("@") ? email.split("@")[0] : "User");

  menuName.textContent = displayName;
  setAvatar(displayName, avatarUrl);

  // Logout
  logoutBtn.addEventListener("click", async () => {
    try {
      await supabase.auth.signOut();
    } catch (e) {
      console.warn(e);
    }
    window.location.href = "/auth/login.html";
  });
}

function setAvatarFromName(name) {
  const first = (name || "P").trim().charAt(0).toUpperCase();
  avatarFallback.textContent = first;
  avatarFallback.style.display = "grid";
  avatarImg.style.display = "none";
}

function setAvatar(name, avatarUrl) {
  if (avatarUrl && typeof avatarUrl === "string") {
    avatarImg.src = avatarUrl;
    avatarImg.onload = () => {
      avatarImg.style.display = "block";
      avatarFallback.style.display = "none";
    };
    avatarImg.onerror = () => {
      setAvatarFromName(name);
    };
  } else {
    setAvatarFromName(name);
  }
}

// Start
requireSessionOrRedirect();