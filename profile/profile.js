import { supabase } from "/js/supabase.js";
import { requireAuth, getMyProfile } from "/js/guard.js";

const editBtn = document.getElementById("editProfileBtn");
const saveBtn = document.getElementById("saveProfileBtn");

const typeBadge = document.getElementById("typeBadge");
const elProfileName = document.getElementById("profileName");
const elMiniTitleLabel = document.getElementById("miniTitleLabel");
const elMiniTitle = document.getElementById("miniTitle");
const elMiniNationality = document.getElementById("miniNationality");

const aboutTitle = document.getElementById("aboutTitle");
const titleLabel = document.getElementById("titleLabel");
const tabSeaBtn = document.getElementById("tabSeaBtn");

const fields = {
  full_name: document.getElementById("fullName"),
  titleValue: document.getElementById("titleValue"), // stored in profiles.rank (for all roles)
  nationality: document.getElementById("nationality"),
  bio: document.getElementById("bio"),
  email: document.getElementById("email"),
};

const avatarFallback = document.getElementById("avatarFallback");

let currentUserId = null;
let currentRole = "seafarer";

function safeText(v, fallback = "—") {
  const t = (v ?? "").toString().trim();
  return t.length ? t : fallback;
}

function normalizeEditableValue(v) {
  const t = (v ?? "").toString().trim();
  if (!t || t === "—") return null;
  return t;
}

function initialsFromName(name) {
  const parts = (name || "").trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "P";
  const first = parts[0][0] || "";
  const last = (parts.length > 1 ? parts[parts.length - 1][0] : "") || "";
  return (first + last).toUpperCase() || "P";
}

function roleLabel(role) {
  if (role === "company") return "Company / Institute";
  if (role === "professional") return "Maritime Professional";
  return "Seafarer";
}

function titleLabelForRole(role) {
  if (role === "company") return "Company type";
  if (role === "professional") return "Professional role";
  return "Ship role";
}

function aboutTitleForRole(role) {
  if (role === "company") return "Company profile";
  if (role === "professional") return "Professional profile";
  return "Seafarer profile";
}

function setEditable(state) {
  const editableEls = [
    fields.full_name,
    fields.titleValue,
    fields.nationality,
    fields.bio
  ];

  editableEls.forEach(el => {
    if (!el) return;
    el.contentEditable = state;
    el.style.background = state ? "#eef6fb" : "";
  });

  editBtn?.classList.toggle("hidden", state);
  saveBtn?.classList.toggle("hidden", !state);
}

async function fetchProfileRow(userId) {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name, role, rank, nationality, bio, setup_complete")
    .eq("id", userId)
    .single();

  if (error) throw error;
  return data;
}

function applyRoleUI(role) {
  const label = roleLabel(role);
  currentRole = role || "seafarer";

  if (typeBadge) typeBadge.textContent = label;

  const titleLbl = titleLabelForRole(currentRole);
  if (titleLabel) titleLabel.textContent = titleLbl;
  if (elMiniTitleLabel) elMiniTitleLabel.textContent = titleLbl;
  if (aboutTitle) aboutTitle.textContent = aboutTitleForRole(currentRole);

  // Sea Service only for seafarer
  const seaVisible = currentRole === "seafarer";
  if (tabSeaBtn) tabSeaBtn.style.display = seaVisible ? "" : "none";

  // If currently on sea tab and role isn't seafarer, force About tab
  if (!seaVisible) {
    const seaPane = document.getElementById("tab_sea");
    if (seaPane && !seaPane.classList.contains("hidden")) {
      switchTab("about");
    }
  }
}

function wireTabs() {
  const tabs = Array.from(document.querySelectorAll(".tab[data-tab]"));
  tabs.forEach(btn => {
    btn.addEventListener("click", () => switchTab(btn.dataset.tab));
  });
}

function switchTab(name) {
  const tabs = Array.from(document.querySelectorAll(".tab[data-tab]"));
  const panes = ["about", "posts", "documents", "sea"].map(x => document.getElementById(`tab_${x}`));

  tabs.forEach(t => t.classList.toggle("active", t.dataset.tab === name));
  panes.forEach(p => {
    if (!p) return;
    p.classList.toggle("hidden", p.id !== `tab_${name}`);
  });
}

async function loadProfile() {
  const session = await requireAuth();
  if (!session) return;

  const me = await getMyProfile(session.user.id);
  if (!me || me.setup_complete !== true) {
    window.location.href = "/setup/profile-setup.html";
    return;
  }

  currentUserId = session.user.id;

  const p = await fetchProfileRow(currentUserId);

  applyRoleUI(p.role);

  // About fields
  fields.full_name.textContent = safeText(p.full_name);
  fields.titleValue.textContent = safeText(p.rank); // we store category-specific title in rank
  fields.nationality.textContent = safeText(p.nationality);
  fields.bio.textContent = safeText(p.bio);
  fields.email.textContent = safeText(session.user.email);

  // Header
  elProfileName.textContent = safeText(p.full_name, "Profile");
  elMiniTitle.textContent = safeText(p.rank);
  elMiniNationality.textContent = safeText(p.nationality);

  // Avatar initials
  if (avatarFallback) avatarFallback.textContent = initialsFromName(p.full_name || session.user.email || "P");
}

// actions
editBtn?.addEventListener("click", () => setEditable(true));

saveBtn?.addEventListener("click", async () => {
  if (!currentUserId) return;

  const updates = {
    full_name: normalizeEditableValue(fields.full_name.textContent),
    rank: normalizeEditableValue(fields.titleValue.textContent),
    nationality: normalizeEditableValue(fields.nationality.textContent),
    bio: normalizeEditableValue(fields.bio.textContent),
    updated_at: new Date().toISOString()
  };

  Object.keys(updates).forEach(k => {
    if (updates[k] === null) delete updates[k];
  });

  const { error } = await supabase.from("profiles").update(updates).eq("id", currentUserId);

  if (error) {
    alert("Save failed: " + (error.message || "Unknown error"));
    console.error("Profile save error:", error);
    return;
  }

  setEditable(false);
  await loadProfile();
});

// init
(async () => {
  try {
    setEditable(false);
    wireTabs();
    await loadProfile();
  } catch (e) {
    console.error("Profile load error:", e);
    alert("Profile load failed: " + (e.message || "Unknown error"));
  }
})();