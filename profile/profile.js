import { supabase, getCurrentUser } from "../js/supabase.js";

const avatarEl = document.getElementById("profileAvatar");
const nameEl = document.getElementById("profileName");
const bioEl = document.getElementById("profileBio");

async function loadProfile() {
  const user = await getCurrentUser();

  if (!user || !user.profile) {
    console.error("No profile found");
    return;
  }

  const profile = user.profile;

  if (nameEl) nameEl.textContent = profile.full_name || "Unnamed Seafarer";
  if (bioEl) bioEl.textContent = profile.bio || "";

  if (avatarEl) {
    avatarEl.src = profile.avatar_url || "/assets/default-avatar.png";
  }
}

loadProfile();