import { supabase, getCurrentUser } from "../js/supabase.js";

const editBtn = document.getElementById("editProfileBtn");
const saveBtn = document.getElementById("saveProfileBtn");

const avatarImg = document.getElementById("avatarImg");
const avatarFallback = document.getElementById("avatarFallback");
const typeBadge = document.getElementById("typeBadge");

const elProfileName = document.getElementById("profileName");
const elMiniRank = document.getElementById("miniRank");
const elMiniNationality = document.getElementById("miniNationality");

const fields = {
  full_name: document.getElementById("fullName"),
  rank: document.getElementById("rank"),
  nationality: document.getElementById("nationality"),
  // UI labels kept same, but we map them to real DB columns:
  // lastVessel -> company
  // availability -> job_title
  lastVessel: document.getElementById("lastVessel"),
  availability: document.getElementById("availability"),
  bio: document.getElementById("bio"),
  email: document.getElementById("email")
};

let currentUserId = null;

// ---------- helpers ----------
function safeText(v, fallback = "—") {
  const t = (v ?? "").toString().trim();
  return t.length ? t : fallback;
}

function normalizeEditableValue(v) {
  // Don’t save placeholder "—"
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

function setEditable(state) {
  // Only these are editable fields (email should not be contentEditable)
  const editableEls = [
    fields.full_name,
    fields.rank,
    fields.nationality,
    fields.lastVessel,
    fields.availability,
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

function setAvatar(url, nameForInitials) {
  const urlTrim = (url || "").trim();
  if (urlTrim) {
    avatarImg.src = urlTrim;
    avatarImg.classList.remove("hidden");
    avatarFallback.classList.add("hidden");
    avatarFallback.textContent = "";
  } else {
    avatarImg.removeAttribute("src");
    avatarImg.classList.add("hidden");
    avatarFallback.classList.remove("hidden");
    avatarFallback.textContent = initialsFromName(nameForInitials);
  }
}

function setAccountTypeBadge(account_type, account_type_label) {
  const label = (account_type_label || account_type || "").trim();
  if (!label) {
    typeBadge.classList.add("hidden");
    typeBadge.textContent = "";
    return;
  }
  typeBadge.classList.remove("hidden");
  typeBadge.textContent = label;
}

// ---------- data ----------
async function fetchProfile(userId) {
  const { data, error } = await supabase
    .from("profiles")
    .select(
      "id, full_name, rank, nationality, bio, email, avatar_url, account_type, account_type_label, company, job_title"
    )
    .eq("id", userId)
    .maybeSingle();

  if (error) throw error;
  return data;
}

async function ensureProfileRow(user) {
  // If profile row doesn’t exist, create a minimal one.
  const { data: existing, error: selErr } = await supabase
    .from("profiles")
    .select("id")
    .eq("id", user.id)
    .maybeSingle();

  if (selErr) throw selErr;

  if (!existing) {
    const insertPayload = {
      id: user.id,
      email: user.email || null,
      full_name:
        (user.user_metadata && user.user_metadata.full_name) ||
        user.email?.split("@")[0] ||
        null
    };

    const { error: insErr } = await supabase.from("profiles").insert(insertPayload);
    if (insErr) throw insErr;
  }
}

async function loadProfile() {
  const user = await getCurrentUser();
  if (!user) return;

  currentUserId = user.id;

  // make sure row exists
  await ensureProfileRow(user);

  const p = await fetchProfile(user.id);

  // Main fields
  fields.full_name.textContent = safeText(p?.full_name);
  fields.rank.textContent = safeText(p?.rank);
  fields.nationality.textContent = safeText(p?.nationality);

  // Map UI fields to real columns
  fields.lastVessel.textContent = safeText(p?.company);
  fields.availability.textContent = safeText(p?.job_title);

  fields.bio.textContent = safeText(p?.bio);
  fields.email.textContent = safeText(p?.email || user.email);

  // Header
  elProfileName.textContent = safeText(p?.full_name, "Profile");
  elMiniRank.textContent = safeText(p?.rank);
  elMiniNationality.textContent = safeText(p?.nationality);

  // Avatar + badge
  setAvatar(p?.avatar_url, p?.full_name || user.email || "P");
  setAccountTypeBadge(p?.account_type, p?.account_type_label);
}

// ---------- actions ----------
editBtn.onclick = () => setEditable(true);

saveBtn.onclick = async () => {
  if (!currentUserId) return;

  const updates = {
    full_name: normalizeEditableValue(fields.full_name.textContent),
    rank: normalizeEditableValue(fields.rank.textContent),
    nationality: normalizeEditableValue(fields.nationality.textContent),

    // UI -> DB mapping
    company: normalizeEditableValue(fields.lastVessel.textContent),
    job_title: normalizeEditableValue(fields.availability.textContent),

    bio: normalizeEditableValue(fields.bio.textContent),

    updated_at: new Date().toISOString()
  };

  // Remove nulls so we don’t overwrite existing values with null
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
};

// init
(async () => {
  try {
    setEditable(false);
    await loadProfile();
  } catch (e) {
    console.error("Profile load error:", e);
    alert("Profile load failed: " + (e.message || "Unknown error"));
  }
})();