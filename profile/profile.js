import { supabase, getCurrentUser } from "../js/supabase.js";

const editBtn = document.getElementById("editProfileBtn");
const saveBtn = document.getElementById("saveProfileBtn");

const fields = {
  full_name: document.getElementById("fullName"),
  rank: document.getElementById("rank"),
  nationality: document.getElementById("nationality"),
  last_vessel: document.getElementById("lastVessel"),
  availability: document.getElementById("availability"),
  bio: document.getElementById("bio")
};

let currentUserId = null;

// Make divs editable or not
function setEditable(state) {
  Object.values(fields).forEach(el => {
    el.contentEditable = state;
    el.style.background = state ? "#eef6fb" : "";
  });

  editBtn.classList.toggle("hidden", state);
  saveBtn.classList.toggle("hidden", !state);
}

async function loadProfile() {
  const user = await getCurrentUser();
  if (!user || !user.profile) return;

  currentUserId = user.id;
  const p = user.profile;

  fields.full_name.textContent = p.full_name || "—";
  fields.rank.textContent = p.rank || "—";
  fields.nationality.textContent = p.nationality || "—";
  fields.last_vessel.textContent = p.last_vessel || "—";
  fields.availability.textContent = p.availability || "—";
  fields.bio.textContent = p.bio || "—";

  document.getElementById("profileName").textContent = p.full_name || "Profile";
  document.getElementById("miniRank").textContent = p.rank || "—";
  document.getElementById("miniNationality").textContent = p.nationality || "—";
}

editBtn.onclick = () => setEditable(true);

saveBtn.onclick = async () => {
  const updates = {
    full_name: fields.full_name.textContent.trim(),
    rank: fields.rank.textContent.trim(),
    nationality: fields.nationality.textContent.trim(),
    last_vessel: fields.last_vessel.textContent.trim(),
    availability: fields.availability.textContent.trim(),
    bio: fields.bio.textContent.trim()
  };

  const { error } = await supabase
    .from("profiles")
    .update(updates)
    .eq("id", currentUserId);

  if (error) {
    alert("Save failed");
    console.error(error);
  } else {
    setEditable(false);
    loadProfile();
  }
};

loadProfile();
setEditable(false);