/* dashboard.js — PEPSVAL Dashboard (Feed shell + avatar menu + post modal)
   - Works on GitHub Pages (static)
   - Shows avatar + dropdown menu (Profile / Settings / Change password / Log out)
   - Log out redirects safely to your login page (tries common paths)
*/

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/* =========================
   1) Supabase config
   ========================= */
const SUPABASE_URL =
  (window.SUPABASE_URL || localStorage.getItem("SUPABASE_URL") || "").trim();
const SUPABASE_ANON_KEY =
  (window.SUPABASE_ANON_KEY || localStorage.getItem("SUPABASE_ANON_KEY") || "").trim();

let sb = null;

function showFatal(msg) {
  const el = document.getElementById("fatalError");
  if (!el) {
    alert(msg);
    return;
  }
  el.style.display = "block";
  el.textContent = msg;
}

if (!SUPABASE_URL || !/^https?:\/\//i.test(SUPABASE_URL)) {
  showFatal(
    "Supabase is not configured. Missing SUPABASE_URL (must start with https://)."
  );
} else if (!SUPABASE_ANON_KEY) {
  showFatal("Supabase is not configured. Missing SUPABASE_ANON_KEY.");
} else {
  sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}

/* =========================
   2) Helpers
   ========================= */
const $ = (id) => document.getElementById(id);

function safeText(v) {
  return (v ?? "").toString().trim();
}

function firstLetter(nameOrEmail) {
  const s = safeText(nameOrEmail);
  return s ? s[0].toUpperCase() : "P";
}

function setAvatarUI({ avatarUrl, displayName, email }) {
  const btn = $("avatarBtn");
  const img = $("avatarImg");
  const fallback = $("avatarFallback");
  const nameEl = $("menuName");
  const emailEl = $("menuEmail");

  if (nameEl) nameEl.textContent = displayName || "Pepsval user";
  if (emailEl) emailEl.textContent = email || "";

  if (!btn) return;

  if (avatarUrl) {
    if (img) {
      img.src = avatarUrl;
      img.alt = displayName || "Profile";
      img.style.display = "block";
    }
    if (fallback) fallback.style.display = "none";
  } else {
    if (img) img.style.display = "none";
    if (fallback) {
      fallback.textContent = firstLetter(displayName || email || "P");
      fallback.style.display = "flex";
    }
  }
}

/* Try to find a login page path that exists on your site */
async function goToLogin() {
  const candidates = [
    "/auth/login.html",
    "/login.html",
    "/auth/login",
    "/login",
    "/auth/login.html?v=1", // cache-bust fallback
  ];

  for (const url of candidates) {
    try {
      const clean = url.replace(/\?v=\d+$/, "");
      const res = await fetch(clean, { method: "HEAD", cache: "no-store" });
      if (res.ok) {
        window.location.href = url;
        return;
      }
    } catch (_) {}
  }

  // final fallback
  window.location.href = "/auth/login.html";
}

/* =========================
   3) Auth gate + load user
   ========================= */
async function requireSession() {
  if (!sb) return null;

  const { data, error } = await sb.auth.getSession();
  if (error) {
    // If auth is broken, send to login
    await goToLogin();
    return null;
  }

  const session = data?.session;
  if (!session) {
    await goToLogin();
    return null;
  }
  return session;
}

async function loadProfile(userId) {
  // Try to read profile data if you have profiles table.
  // If not available, we still show dashboard with fallback name/email.
  try {
    const { data, error } = await sb
      .from("profiles")
      .select("full_name, avatar_url, username")
      .eq("id", userId)
      .maybeSingle();

    if (error) return null;
    return data || null;
  } catch (_) {
    return null;
  }
}

/* =========================
   4) UI wiring (menu + modal + tabs)
   ========================= */
function wireAvatarMenu() {
  const btn = $("avatarBtn");
  const menu = $("avatarMenu");
  const backdrop = $("menuBackdrop");

  const openMenu = () => {
    if (!menu) return;
    menu.hidden = false;
    if (backdrop) backdrop.hidden = false;
    btn?.setAttribute("aria-expanded", "true");
  };

  const closeMenu = () => {
    if (!menu) return;
    menu.hidden = true;
    if (backdrop) backdrop.hidden = true;
    btn?.setAttribute("aria-expanded", "false");
  };

  btn?.addEventListener("click", (e) => {
    e.preventDefault();
    if (!menu) return;
    if (menu.hidden) openMenu();
    else closeMenu();
  });

  backdrop?.addEventListener("click", closeMenu);

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeMenu();
  });

  // Menu links
  const profileLink = $("menuProfile");
  const settingsLink = $("menuSettings");
  const changePwLink = $("menuChangePw");
  const logoutBtn = $("menuLogout");

  profileLink?.addEventListener("click", (e) => {
    e.preventDefault();
    closeMenu();
    // if you have a profile page later, update here
    window.location.href = "/dashboard/profile.html";
  });

  settingsLink?.addEventListener("click", (e) => {
    e.preventDefault();
    closeMenu();
    window.location.href = "/dashboard/settings.html";
  });

  changePwLink?.addEventListener("click", (e) => {
    e.preventDefault();
    closeMenu();
    // your existing reset/change page
    window.location.href = "/reset.html";
  });

  logoutBtn?.addEventListener("click", async (e) => {
    e.preventDefault();
    closeMenu();

    try {
      if (sb) await sb.auth.signOut();
    } catch (_) {}

    // clear common token keys (safe)
    localStorage.removeItem("sb-access-token");
    localStorage.removeItem("sb-refresh-token");

    await goToLogin();
  });
}

function wireCreatePostModal() {
  const openBtn = $("navCreate");
  const overlay = $("modalOverlay");
  const modal = $("postModal");
  const closeBtn = $("closeModalBtn");

  const open = () => {
    if (overlay) overlay.hidden = false;
    if (modal) modal.hidden = false;
  };

  const close = () => {
    if (overlay) overlay.hidden = true;
    if (modal) modal.hidden = true;
  };

  openBtn?.addEventListener("click", (e) => {
    e.preventDefault();
    open();
  });

  closeBtn?.addEventListener("click", (e) => {
    e.preventDefault();
    close();
  });

  overlay?.addEventListener("click", close);

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") close();
  });

  // For now this is UI-only. Posting will be wired later.
  const postForm = $("postForm");
  postForm?.addEventListener("submit", (e) => {
    e.preventDefault();
    close();
    alert("Post feature will be enabled in next step.");
  });
}

function wireBottomNav() {
  const navFeed = $("navFeed");
  const navJobs = $("navJobs");
  const navSearch = $("navSearch");
  const navMessages = $("navMessages");
  const navProfile = $("navProfile");

  navFeed?.addEventListener("click", (e) => {
    e.preventDefault();
    // already on feed
  });

  navJobs?.addEventListener("click", (e) => {
    e.preventDefault();
    window.location.href = "/dashboard/jobs.html";
  });

  navSearch?.addEventListener("click", (e) => {
    e.preventDefault();
    window.location.href = "/dashboard/search.html";
  });

  navMessages?.addEventListener("click", (e) => {
    e.preventDefault();
    window.location.href = "/dashboard/messages.html";
  });

  navProfile?.addEventListener("click", (e) => {
    e.preventDefault();
    window.location.href = "/dashboard/profile.html";
  });
}

/* =========================
   5) Boot
   ========================= */
(async function boot() {
  // Wire UI first (even if auth fails, no harm)
  wireAvatarMenu();
  wireCreatePostModal();
  wireBottomNav();

  if (!sb) return;

  const session = await requireSession();
  if (!session) return;

  const user = session.user;
  const email = safeText(user?.email);

  // default values from auth
  let displayName = safeText(user?.user_metadata?.full_name) || "";
  let avatarUrl = safeText(user?.user_metadata?.avatar_url) || "";

  // Try profiles table (if exists)
  const profile = await loadProfile(user.id);
  if (profile) {
    displayName =
      safeText(profile.full_name) ||
      safeText(profile.username) ||
      displayName ||
      "Pepsval user";
    avatarUrl = safeText(profile.avatar_url) || avatarUrl;
  } else {
    displayName = displayName || "Pepsval user";
  }

  // Update welcome text if present
  const welcome = $("welcomeText");
  if (welcome) {
    welcome.textContent =
      "This is your dashboard feed. Soon you’ll see posts from seafarers, employers, and shore staff based on your preferences.";
  }

  setAvatarUI({ avatarUrl, displayName, email });
})();
```0