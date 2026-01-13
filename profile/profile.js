import { supabase, getCurrentUser } from "../js/supabase.js";

const editBtn = document.getElementById("editProfileBtn");
const saveBtn = document.getElementById("saveProfileBtn");

const fields = {
  full_name: document.getElementById("fullName"),
  rank: document.getElementById("rank"),
  nationality: document.getElementById("nationality"),
  last_vessel: document.getElementById("lastVessel"),
  availability: document.getElementById("availability")
};

let currentUserId = null;

async function loadProfile() {
  const user = await getCurrentUser();
  if (!user || !user.profile) return;

  currentUserId = user.id;

  fields.full_name.value = user.profile.full_name || "";
  fields.rank.value = user.profile.rank || "";
  fields.nationality.value = user.profile.nationality || "";
  fields.last_vessel.value = user.profile.last_vessel || "";
  fields.availability.value = user.profile.availability || "";
}

function setEditable(isEditable) {
  Object.values(fields).forEach(input => {
    input.disabled = !isEditable;
  });

  editBtn.style.display = isEditable ? "none" : "inline-block";
  saveBtn.style.display = isEditable ? "inline-block" : "none";
}

editBtn.onclick = () => setEditable(true);

saveBtn.onclick = async () => {
  const updates = {
    full_name: fields.full_name.value,
    rank: fields.rank.value,
    nationality: fields.nationality.value,
    last_vessel: fields.last_vessel.value,
    availability: fields.availability.value
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