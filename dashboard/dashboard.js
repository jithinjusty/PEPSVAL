import { supabase } from "/js/supabase.js";

/* -----------------------
  Helpers
------------------------ */
const $ = (q) => document.querySelector(q);
const $$ = (q) => Array.from(document.querySelectorAll(q));
const show = (el) => el && el.classList.remove("hidden");
const hide = (el) => el && el.classList.add("hidden");

/* -----------------------
  Auth
------------------------ */
async function requireUser() {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data?.user) {
    window.location.href = "/auth/login.html";
    return null;
  }
  return data.user;
}

/* -----------------------
  Profile load
------------------------ */
async function loadProfile(userId) {
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .maybeSingle();

  if (error) return null;
  return data || null;
}

/* -----------------------
  Avatar
------------------------ */
function setAvatar(imgUrl, fallbackText = "P") {
  // Support both: image + circle fallback
  const avatarImg = $("#topAvatarImg");
  const avatarCircle = $("#topAvatarCircle");

  if (avatarImg && imgUrl) {
    avatarImg.src = imgUrl;
    show(avatarImg);
    hide(avatarCircle);
    return;
  }

  if (avatarCircle) {
    avatarCircle.textContent = fallbackText;
    show(avatarCircle);
  }
  hide(avatarImg);
}

/* -----------------------
  Avatar menu
------------------------ */
function wireAvatarMenu(profile) {
  const btn = $("#topAvatarBtn");
  const menu = $("#avatarMenu");
  const nameEl = $("#avatarMenuName");

  if (nameEl) nameEl.textContent = profile?.full_name || "Profile";

  if (!btn || !menu) return;

  const openMenu = () => show(menu);
  const closeMenu = () => hide(menu);

  btn.addEventListener("click", (e) => {
    e.stopPropagation();
    if (menu.classList.contains("hidden")) openMenu();
    else closeMenu();
  });

  document.addEventListener("click", () => closeMenu());

  const mProfile = $("#menuProfile");
  const mSettings = $("#menuSettings");
  const mLogout = $("#menuLogout");

  mProfile?.addEventListener("click", () => (window.location.href = "/profile/index.html"));
  mSettings?.addEventListener("click", () => (window.location.href = "/setup/profile-setup.html"));
  mLogout?.addEventListener("click", async () => {
    await supabase.auth.signOut();
    window.location.href = "/auth/login.html";
  });
}

/* -----------------------
  Navigation wiring
  (safe: does nothing if element not found)
------------------------ */
function wireNav() {
  // Messages
  const msgBtn =
    $("#navMessages") ||
    $('[data-nav="messages"]') ||
    $('a[href*="messages"]');

  if (msgBtn) {
    msgBtn.addEventListener("click", (e) => {
      e.preventDefault();
      window.location.href = "/messages/index.html";
    });
  }

  // Profile
  const profileBtn =
    $("#navProfile") ||
    $('[data-nav="profile"]') ||
    $('a[href*="/profile"]');

  if (profileBtn) {
    profileBtn.addEventListener("click", (e) => {
      e.preventDefault();
      window.location.href = "/profile/index.html";
    });
  }
}

/* -----------------------
  Badge counts
  Total badge on Messages tab = unread notifications + unread messages
------------------------ */
async function getUnreadNotificationsCount(userId) {
  const { count, error } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("recipient_id", userId)
    .eq("is_read", false);

  if (error) return 0;
  return count || 0;
}

// Not implemented yet (DM tables not built). Keep 0 for now.
async function getUnreadMessagesCount() {
  return 0;
}

function setMessagesBadge(total) {
  // Support multiple possible badge locations safely
  const badgeEls = [
    $("#messagesBadge"),
    $("#msgBadge"),
    $('[data-badge="messages"]'),
    $("#navMessages .badge")
  ].filter(Boolean);

  badgeEls.forEach((el) => {
    el.textContent = String(total);
    if (total > 0) show(el);
    else hide(el);
  });
}

async function refreshBadges(userId) {
  const noti = await getUnreadNotificationsCount(userId);
  const msg = await getUnreadMessagesCount();
  const total = noti + msg;
  setMessagesBadge(total);
}

/* -----------------------
  Boot
------------------------ */
async function init() {
  const user = await requireUser();
  if (!user) return;

  const profile = await loadProfile(user.id);

  // Avatar fallback letter
  const fallbackLetter = (profile?.full_name || user.email || "P")
    .trim()
    .slice(0, 1)
    .toUpperCase();

  setAvatar(profile?.avatar_url || null, fallbackLetter);

  // Avatar menu
  wireAvatarMenu(profile);

  // Nav
  wireNav();

  // Badge refresh
  await refreshBadges(user.id);
  setInterval(() => refreshBadges(user.id).catch(() => {}), 10000);
}

init();