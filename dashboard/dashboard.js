// /dashboard/dashboard.js
import { supabase } from "/js/supabase.js";

document.addEventListener("DOMContentLoaded", async () => {
  // ✅ Guard: must be logged in
  const { data } = await supabase.auth.getUser();
  if (!data?.user) {
    window.location.href = "/auth/login.html";
    return;
  }

  // ✅ Setup avatar menu (keep simple + stable)
  setupAvatarMenu();
});

function setupAvatarMenu() {
  const avatarBtn =
    document.getElementById("avatarBtn") ||
    document.getElementById("avatar") ||
    document.querySelector(".pv-avatar") ||
    document.querySelector("[data-avatar]");

  if (!avatarBtn) return;

  let menu = document.getElementById("avatarMenu");
  if (!menu) {
    menu = document.createElement("div");
    menu.id = "avatarMenu";
    menu.className = "pv-menu";
    menu.style.display = "none";
    menu.innerHTML = `
      <button class="pv-item" data-act="profile">Basic profile</button>
      <button class="pv-item" data-act="settings">Settings</button>
      <button class="pv-item pv-danger" data-act="logout">Log out</button>
    `;
    document.body.appendChild(menu);
  }

  injectMenuStylesOnce();

  avatarBtn.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    menu.style.display = (menu.style.display === "block") ? "none" : "block";
    positionMenu(menu, avatarBtn);
  });

  menu.addEventListener("click", async (e) => {
    const btn = e.target.closest("button");
    if (!btn) return;

    const act = btn.dataset.act;

    if (act === "profile") window.location.href = "/profile/home.html";
    if (act === "settings") window.location.href = "/dashboard/settings.html";

    if (act === "logout") {
      await doLogout();
    }
  });

  document.addEventListener("click", () => (menu.style.display = "none"));
}

async function doLogout() {
  try {
    await supabase.auth.signOut();  // ✅ real logout
  } catch (e) {
    // ignore
  }
  window.location.href = "/auth/login.html"; // ✅ no loop now
}

function positionMenu(menu, avatarBtn) {
  const r = avatarBtn.getBoundingClientRect();
  menu.style.position = "fixed";
  menu.style.top = `${Math.round(r.bottom + 8)}px`;
  menu.style.left = `${Math.round(Math.min(window.innerWidth - 220, r.left))}px`;
  menu.style.zIndex = "9999";
}

function injectMenuStylesOnce() {
  if (document.getElementById("pvMenuStyles")) return;
  const s = document.createElement("style");
  s.id = "pvMenuStyles";
  s.textContent = `
    .pv-menu{
      width: 220px;
      background: rgba(255,255,255,.96);
      border: 1px solid rgba(31,111,134,.18);
      border-radius: 14px;
      box-shadow: 0 18px 45px rgba(0,0,0,.15);
      padding: 8px;
      backdrop-filter: blur(10px);
    }
    .pv-item{
      width: 100%;
      text-align: left;
      border: 0;
      background: transparent;
      padding: 10px 10px;
      border-radius: 10px;
      font-weight: 800;
      cursor: pointer;
    }
    .pv-item:hover{ background: rgba(31,111,134,.10); }
    .pv-danger{ color: #c0392b; }
  `;
  document.head.appendChild(s);
}