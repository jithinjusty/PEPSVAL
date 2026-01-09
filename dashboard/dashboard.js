/* dashboard/dashboard.js
   Fixes:
   - Profile tab opens /profile/ (which now redirects to home.html)
   - Avatar click always opens menu
   - Menu buttons work: Profile (basic), Settings, Logout
   - Works even if some IDs/classes differ (fallback selectors)
*/

import { supabase } from "../js/supabase.js";

document.addEventListener("DOMContentLoaded", () => {
  wireDashboardNav();
  wireAvatarMenu();
  loadUserAvatarSafe();
});

/* -----------------------------
   NAV (bottom tabs)
--------------------------------*/
function wireDashboardNav() {
  // Try common selectors for bottom tabs
  const profileTab =
    document.querySelector('[data-tab="profile"]') ||
    document.querySelector("#tabProfile") ||
    document.querySelector(".tab-profile") ||
    findButtonByText("Profile");

  if (profileTab) {
    profileTab.addEventListener("click", (e) => {
      e.preventDefault();
      // NEW profile page (your new profile system)
      window.location.href = "/profile/";
    });
  }

  // Messages tab (keep existing routing if any)
  const messagesTab =
    document.querySelector('[data-tab="messages"]') ||
    document.querySelector("#tabMessages") ||
    document.querySelector(".tab-messages") ||
    findButtonByText("Messages");

  if (messagesTab) {
    // If your HTML already has href, do nothing. Else route:
    if (!messagesTab.getAttribute("href")) {
      messagesTab.addEventListener("click", (e) => {
        e.preventDefault();
        window.location.href = "/dashboard/index.html#messages";
      });
    }
  }
}

function findButtonByText(txt) {
  const all = Array.from(document.querySelectorAll("a,button,div"));
  return all.find((el) => (el.textContent || "").trim() === txt);
}

/* -----------------------------
   AVATAR + MENU
--------------------------------*/
function wireAvatarMenu() {
  // Try to find the avatar circle
  const avatarBtn =
    document.querySelector("#avatarBtn") ||
    document.querySelector(".avatar") ||
    document.querySelector(".top-avatar") ||
    document.querySelector('[data-avatar="btn"]') ||
    document.querySelector("header .avatar-circle") ||
    document.querySelector("header [class*='avatar']");

  if (!avatarBtn) return;

  // Make sure it's clickable
  avatarBtn.style.cursor = "pointer";
  avatarBtn.style.pointerEvents = "auto";
  avatarBtn.style.zIndex = "9999";

  // Create menu if not exists
  let menu = document.querySelector("#avatarMenu");
  if (!menu) {
    menu = document.createElement("div");
    menu.id = "avatarMenu";
    menu.style.position = "absolute";
    menu.style.top = "62px";
    menu.style.right = "14px";
    menu.style.width = "210px";
    menu.style.background = "rgba(255,255,255,0.95)";
    menu.style.border = "1px solid rgba(0,0,0,0.08)";
    menu.style.borderRadius = "14px";
    menu.style.boxShadow = "0 12px 30px rgba(0,0,0,0.12)";
    menu.style.padding = "8px";
    menu.style.display = "none";
    menu.style.zIndex = "99999";
    menu.innerHTML = `
      <button class="menuItem" data-act="profile">Profile</button>
      <button class="menuItem" data-act="settings">Settings</button>
      <button class="menuItem" data-act="logout" style="color:#b00020;">Logout</button>
    `;
    document.body.appendChild(menu);

    // Style buttons
    menu.querySelectorAll(".menuItem").forEach((b) => {
      b.style.width = "100%";
      b.style.padding = "12px 12px";
      b.style.border = "0";
      b.style.background = "transparent";
      b.style.textAlign = "left";
      b.style.borderRadius = "10px";
      b.style.fontSize = "15px";
      b.addEventListener("mouseenter", () => (b.style.background = "rgba(31,111,134,0.10)"));
      b.addEventListener("mouseleave", () => (b.style.background = "transparent"));
    });

    menu.addEventListener("click", async (e) => {
      const btn = e.target.closest("[data-act]");
      if (!btn) return;

      const act = btn.getAttribute("data-act");

      // Profile in menu = OLD basic profile page (as you requested)
      if (act === "profile") window.location.href = "/profile-setup.html";
      if (act === "settings") window.location.href = "/dashboard/settings.html";

      if (act === "logout") {
        try {
          await supabase.auth.signOut();
        } catch (err) {}
        window.location.href = "/auth/login.html";
      }
    });
  }

  // Toggle on avatar click
  avatarBtn.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    positionMenu(menu, avatarBtn);
    menu.style.display = menu.style.display === "none" ? "block" : "none";
  });

  // Close when clicking outside
  document.addEventListener("click", () => {
    const m = document.querySelector("#avatarMenu");
    if (m) m.style.display = "none";
  });
}

function positionMenu(menu, avatarBtn) {
  const r = avatarBtn.getBoundingClientRect();
  // place under avatar
  menu.style.top = `${Math.max(10, r.bottom + 10)}px`;
  menu.style.right = `14px`;
}

/* -----------------------------
   LOAD AVATAR IMAGE
--------------------------------*/
async function loadUserAvatarSafe() {
  try {
    const { data: auth } = await supabase.auth.getUser();
    const user = auth?.user;
    if (!user) return;

    // read profile
    const { data: prof } = await supabase
      .from("profiles")
      .select("full_name, avatar_url")
      .eq("id", user.id)
      .single();

    const avatarBtn =
      document.querySelector("#avatarBtn") ||
      document.querySelector(".avatar") ||
      document.querySelector(".top-avatar") ||
      document.querySelector('[data-avatar="btn"]') ||
      document.querySelector("header [class*='avatar']");

    if (!avatarBtn) return;

    const name =
      (prof?.full_name || user.email || "P").trim();

    // If avatar_url exists → show image
    if (prof?.avatar_url) {
      // If avatarBtn is a div/circle, set background image
      avatarBtn.style.backgroundImage = `url('${prof.avatar_url}')`;
      avatarBtn.style.backgroundSize = "cover";
      avatarBtn.style.backgroundPosition = "center";
      avatarBtn.textContent = ""; // remove letter
      return;
    }

    // Else show first letter
    const firstLetter = (name[0] || "P").toUpperCase();
    avatarBtn.textContent = firstLetter;
  } catch (e) {
    // do nothing (avoid breaking dashboard)
  }
}