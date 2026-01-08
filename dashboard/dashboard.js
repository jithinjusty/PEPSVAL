import { supabase } from "/js/supabase.js";

const $ = (id) => document.getElementById(id);

async function getMyProfile(userId){
  const { data, error } = await supabase
    .from("profiles")
    .select("full_name, first_name, last_name, avatar_url")
    .eq("id", userId)
    .maybeSingle();

  if (error) return { name: "Profile", avatar_url: "" };

  const name =
    (data?.full_name || "").trim() ||
    [data?.first_name, data?.last_name].filter(Boolean).join(" ").trim() ||
    "Profile";

  return { name, avatar_url: data?.avatar_url || "" };
}

function wireBottomNav(){
  // Your bottom nav ids may differ; we support common ones.
  const profileBtn =
    $("navProfile") ||
    $("tabProfile") ||
    document.querySelector('[data-nav="profile"]') ||
    document.querySelector('a[href*="profile"]');

  if (profileBtn) {
    // Always go to NEW profile page
    profileBtn.href = "/profile/home.html";
  }
}

function wireAvatarMenu({ name, avatar_url }){
  const avatarBtn = $("avatarBtn");
  const avatarImg = $("avatarImg");
  const menu = $("avatarMenu");
  const menuName = $("avatarMenuName");

  if (menuName) menuName.textContent = name;
  if (avatarImg && avatar_url) avatarImg.src = avatar_url;

  // Toggle menu
  avatarBtn?.addEventListener("click", (e) => {
    e.preventDefault();
    menu?.classList.toggle("open");
  });

  // Close when click outside
  document.addEventListener("click", (e) => {
    if (!menu || !avatarBtn) return;
    const inside = menu.contains(e.target) || avatarBtn.contains(e.target);
    if (!inside) menu.classList.remove("open");
  });

  // Menu links
  const mProfile = $("menuProfile");
  const mSettings = $("menuSettings");
  const mLogout = $("menuLogout");

  // NEW profile page
  if (mProfile) mProfile.href = "/profile/home.html";

  // Old basic setup page should be only in Settings
  if (mSettings) mSettings.href = "/setup/profile-setup.html";

  mLogout?.addEventListener("click", async (e) => {
    e.preventDefault();
    await supabase.auth.signOut();
    window.location.href = "/auth/login.html";
  });
}

async function init(){
  const { data } = await supabase.auth.getUser();
  const user = data?.user;

  if (!user) {
    window.location.href = "/auth/login.html";
    return;
  }

  wireBottomNav();

  const me = await getMyProfile(user.id);
  wireAvatarMenu(me);
}

init();