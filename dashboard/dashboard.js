/* dashboard/dashboard.js (NO imports)
   Fix:
   - Avatar menu works + looks clean
   - Logout works (uses global supabase client)
   - Bottom Profile opens /profile/
*/

document.addEventListener("DOMContentLoaded", () => {
  wireBottomProfile();
  wireAvatarMenu();
  loadUserAvatarSafe();
});

/* -----------------------------
   Bottom Profile tab
--------------------------------*/
function wireBottomProfile() {
  const profileTab =
    document.querySelector('[data-tab="profile"]') ||
    document.querySelector("#tabProfile") ||
    findByText("Profile");

  if (profileTab) {
    profileTab.addEventListener("click", (e) => {
      e.preventDefault();
      window.location.href = "/profile/";
    });
  }
}

function findByText(txt) {
  const all = Array.from(document.querySelectorAll("a,button,div,span"));
  return all.find((el) => (el.textContent || "").trim() === txt);
}

/* -----------------------------
   Avatar menu (clean)
--------------------------------*/
function wireAvatarMenu() {
  const avatarBtn =
    document.querySelector("#avatarBtn") ||
    document.querySelector(".avatar") ||
    document.querySelector('[data-avatar="btn"]') ||
    document.querySelector("header [class*='avatar']");

  if (!avatarBtn) return;

  avatarBtn.style.cursor = "pointer";
  avatarBtn.style.position = avatarBtn.style.position || "relative";
  avatarBtn.style.zIndex = "9999";

  let menu = document.querySelector("#avatarMenu");
  if (!menu) {
    menu = document.createElement("div");
    menu.id = "avatarMenu";
    menu.className = "pv-menu";
    menu.innerHTML = `
      <button class="pv-item" data-act="profile">Basic profile</button>
      <button class="pv-item" data-act="settings">Settings</button>
      <button class="pv-item pv-danger" data-act="logout">Log out</button>
    `;
    document.body.appendChild(menu);
  }

  // Toggle
  avatarBtn.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    positionMenu(menu, avatarBtn);
    menu.style.display = menu.style.display === "block" ? "none" : "block";
  });

  // Click actions
  menu.addEventListener("click", async (e) => {
    const btn = e.target.closest("[data-act]");
    if (!btn) return;

    const act = btn.getAttribute("data-act");

    if (act === "profile") window.location.href = "/profile-setup.html";
    if (act === "settings") window.location.href = "/dashboard/settings.html";

    if (act === "logout") {
      await doLogout();
    }
  });

  // Close outside
  document.addEventListener("click", () => (menu.style.display = "none"));

  injectMenuStylesOnce();
}

function positionMenu(menu, avatarBtn) {
  const r = avatarBtn.getBoundingClientRect();
  menu.style.top = `${r.bottom + 10}px`;
  menu.style.left = `${Math.max(10, r.right - 220)}px`;
}

/* -----------------------------
   Logout (robust)
--------------------------------*/
async function doLogout() {
  try {
    const client = getSupabaseClient();
    if (client?.auth?.signOut) {
      await client.auth.signOut();
    }
  } catch (e) {
    // ignore
  }
  // Always redirect (even if signOut fails)
  window.location.href = "/auth/login.html";
}

function getSupabaseClient() {
  // Common globals you might have
  return (
    window.supabase ||
    window.supabaseClient ||
    window._supabase ||
    null
  );
}

/* -----------------------------
   Avatar initial / photo
--------------------------------*/
async function loadUserAvatarSafe() {
  try {
    const client = getSupabaseClient();
    if (!client?.auth?.getUser) return;

    const { data: auth } = await client.auth.getUser();
    const user = auth?.user;
    if (!user) return;

    const { data: prof } = await client
      .from("profiles")
      .select("full_name, avatar_url")
      .eq("id", user.id)
      .single();

    const avatarBtn =
      document.querySelector("#avatarBtn") ||
      document.querySelector(".avatar") ||
      document.querySelector('[data-avatar="btn"]') ||
      document.querySelector("header [class*='avatar']");

    if (!avatarBtn) return;

    const name = (prof?.full_name || user.email || "P").trim();
    const firstLetter = (name[0] || "P").toUpperCase();

    if (prof?.avatar_url) {
      avatarBtn.style.backgroundImage = `url('${prof.avatar_url}')`;
      avatarBtn.style.backgroundSize = "cover";
      avatarBtn.style.backgroundPosition = "center";
      avatarBtn.textContent = "";
    } else {
      avatarBtn.textContent = firstLetter;
    }
  } catch (e) {}
}

function injectMenuStylesOnce() {
  if (document.getElementById("pvMenuStyles")) return;
  const st = document.createElement("style");
  st.id = "pvMenuStyles";
  st.textContent = `
    .pv-menu{
      position:absolute;
      display:none;
      width:220px;
      background: rgba(255,255,255,0.96);
      border: 1px solid rgba(0,0,0,0.08);
      border-radius: 16px;
      box-shadow: 0 18px 40px rgba(0,0,0,0.14);
      padding: 8px;
      z-index: 99999;
      backdrop-filter: blur(10px);
    }
    .pv-item{
      width:100%;
      padding: 12px 12px;
      border:0;
      background: transparent;
      text-align:left;
      border-radius: 12px;
      font-size: 15px;
      font-weight: 600;
      color:#0b2230;
    }
    .pv-item:hover{ background: rgba(31,111,134,0.10); }
    .pv-danger{ color:#b00020; }
  `;
  document.head.appendChild(st);
}