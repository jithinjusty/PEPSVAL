// /setup/profile-setup.js
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = window.SUPABASE_URL || localStorage.getItem("SUPABASE_URL") || "";
const SUPABASE_ANON_KEY = window.SUPABASE_ANON_KEY || localStorage.getItem("SUPABASE_ANON_KEY") || "";

const errorBox = document.getElementById("errorBox");
const setupForm = document.getElementById("setupForm");
const saveBtn = document.getElementById("saveBtn");

const accountType = document.getElementById("accountType");
const accountTypeOtherWrap = document.getElementById("accountTypeOtherWrap");
const accountTypeOther = document.getElementById("accountTypeOther");

const fullName = document.getElementById("fullName");
const dob = document.getElementById("dob");

const rankWrap = document.getElementById("rankWrap");
const rankSearch = document.getElementById("rankSearch");
const rankValue = document.getElementById("rankValue");
const rankList = document.getElementById("rankList");
const rankOtherWrap = document.getElementById("rankOtherWrap");
const rankOther = document.getElementById("rankOther");

const countrySearch = document.getElementById("countrySearch");
const countryValue = document.getElementById("countryValue");
const countryList = document.getElementById("countryList");

const dialSearch = document.getElementById("dialSearch");
const dialValue = document.getElementById("dialValue");
const dialList = document.getElementById("dialList");

const phoneInput = document.getElementById("phoneInput");

const photoInput = document.getElementById("photoInput");
const removePhotoBtn = document.getElementById("removePhotoBtn");
const avatarPreview = document.getElementById("avatarPreview");

let supabase = null;
let user = null;

let countries = [];
let ranks = [];

// local backup keys (useful if Supabase read fails temporarily)
const LS_PROFILE = "pepsval_profile_cache_v1";

function showError(msg) {
  errorBox.style.display = "block";
  errorBox.textContent = msg;
}

function clearError() {
  errorBox.style.display = "none";
  errorBox.textContent = "";
}

function isConfigured() {
  return SUPABASE_URL.startsWith("http") && SUPABASE_ANON_KEY.length > 20;
}

function normalizeDial(d) {
  if (!d) return "";
  return String(d).replace(/\s+/g, "").trim();
}

function setAvatarFromUrl(url) {
  avatarPreview.innerHTML = "";
  if (!url) {
    avatarPreview.innerHTML = `<span class="avatarHint">Add photo</span>`;
    avatarPreview.style.backgroundImage = "";
    return;
  }
  avatarPreview.style.backgroundImage = `url("${url}")`;
  avatarPreview.style.backgroundSize = "cover";
  avatarPreview.style.backgroundPosition = "center";
}

function setAvatarFromFile(file) {
  if (!file) return;
  const url = URL.createObjectURL(file);
  setAvatarFromUrl(url);
}

async function loadCountries() {
  // you said countries.json committed (likely inside /data/)
  const tryUrls = ["/data/countries.json", "/countries.json", "/data/country-codes.json"];
  for (const url of tryUrls) {
    try {
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) continue;
      const data = await res.json();
      if (Array.isArray(data) && data.length) return data;
    } catch {}
  }
  return [];
}

function buildRanks() {
  // Broad list (Deck + Engine + Offshore/Drilling + Catering + Shore/Office)
  // You can expand anytime by adding more strings.
  return [
    // Deck (merchant)
    "Master / Captain",
    "Chief Officer / C/O",
    "First Officer / 1/O",
    "Second Officer / 2/O",
    "Third Officer / 3/O",
    "Deck Cadet",
    "Bosun / Boatswain",
    "AB / Able Seaman",
    "OS / Ordinary Seaman",
    "Deck Fitter",
    "Deck Trainee",
    "Pilot",
    "Harbour Master",
    // Engine (merchant)
    "Chief Engineer / C/E",
    "Second Engineer / 2/E",
    "Third Engineer / 3/E",
    "Fourth Engineer / 4/E",
    "Junior Engineer",
    "Engine Cadet",
    "Motorman / Oiler",
    "Wiper",
    "Fitter",
    "Electrician / ETO",
    "Electro-Technical Officer (ETO)",
    "Electro-Technical Rating (ETR)",
    "Reefer Engineer",
    // Offshore / DP
    "DPO / Dynamic Positioning Operator",
    "Senior DPO",
    "Junior DPO",
    "DP Trainee",
    "Offshore Installation Manager (OIM)",
    "Barge Master",
    "Chief Mate (Offshore)",
    "Cargo Supervisor",
    "Ballast Control Operator (BCO)",
    "Crane Operator",
    "Roustabout",
    "Able Seafarer Deck (ASD)",
    "Able Seafarer Engine (ASE)",
    // Drilling / Rig
    "Toolpusher",
    "Driller",
    "Assistant Driller",
    "Derrickman",
    "Floorman / Roughneck",
    "Mud Engineer",
    "Subsea Engineer",
    "Maintenance Supervisor",
    "Mechanical Technician",
    "Electrical Technician",
    "Instrument Technician",
    "HSE Officer",
    "Medic / Offshore Paramedic",
    // Tanker / specialized
    "Chief Officer (Tanker)",
    "Cargo Officer (Tanker)",
    "Gas Engineer",
    "Pumpman",
    // Catering / hotel
    "Chief Cook",
    "Second Cook",
    "Cook",
    "Steward",
    "Chief Steward",
    "Messman",
    // Shore / office roles (for “Shore Staff”)
    "Marine Superintendent",
    "Technical Superintendent",
    "Crewing Officer",
    "Recruiter",
    "Port Captain",
    "HSQE Manager",
    "Operations Manager",
    "Training Coordinator",
    "Agent",
    "Surveyor",
    "Class Inspector",
    // Other
    "Other"
  ];
}

/** ---------- Simple combo dropdown helpers ---------- */
function createOptions(list, makeLabel, onPick) {
  return list.map(item => {
    const div = document.createElement("div");
    div.className = "comboItem";
    div.textContent = makeLabel(item);
    div.addEventListener("click", () => onPick(item));
    return div;
  });
}

function filterList(list, query, makeHaystack) {
  const q = (query || "").toLowerCase().trim();
  if (!q) return list;
  return list.filter(item => makeHaystack(item).toLowerCase().includes(q));
}

function openList(el) {
  el.style.display = "block";
}

function closeList(el) {
  el.style.display = "none";
}

function wireCombo({ inputEl, listEl, sourceList, makeLabel, makeHaystack, onPick }) {
  function render(query) {
    listEl.innerHTML = "";
    const filtered = filterList(sourceList(), query, makeHaystack).slice(0, 80);
    const nodes = createOptions(filtered, makeLabel, (item) => {
      onPick(item);
      closeList(listEl);
      validate();
    });
    nodes.forEach(n => listEl.appendChild(n));
    openList(listEl);
  }

  inputEl.addEventListener("focus", () => render(inputEl.value));
  inputEl.addEventListener("input", () => render(inputEl.value));

  document.addEventListener("click", (e) => {
    if (!listEl.contains(e.target) && e.target !== inputEl) {
      closeList(listEl);
    }
  });
}

/** ---------- Behavior rules ---------- */
function updateAccountTypeUI() {
  const t = accountType.value;

  // show "other account type" textbox
  if (t === "other") accountTypeOtherWrap.classList.remove("hidden");
  else accountTypeOtherWrap.classList.add("hidden");

  // rank only for seafarer
  if (t === "seafarer") rankWrap.classList.remove("hidden");
  else rankWrap.classList.add("hidden");

  // reset rank if not seafarer
  if (t !== "seafarer") {
    rankSearch.value = "";
    rankValue.value = "";
    rankOther.value = "";
    rankOtherWrap.classList.add("hidden");
  }

  validate();
}

function updateRankOtherUI() {
  const v = (rankValue.value || "").toLowerCase();
  if (v === "other") rankOtherWrap.classList.remove("hidden");
  else rankOtherWrap.classList.add("hidden");
  validate();
}

function validate() {
  clearError();

  // required: account type
  if (!accountType.value) {
    saveBtn.disabled = true;
    return;
  }

  // required: specify account type if "other"
  if (accountType.value === "other" && !accountTypeOther.value.trim()) {
    saveBtn.disabled = true;
    return;
  }

  // required: nationality
  if (!countryValue.value) {
    saveBtn.disabled = true;
    return;
  }

  // required: rank only for seafarer
  if (accountType.value === "seafarer") {
    if (!rankValue.value) {
      saveBtn.disabled = true;
      return;
    }
    if (rankValue.value.toLowerCase() === "other" && !rankOther.value.trim()) {
      saveBtn.disabled = true;
      return;
    }
  }

  // photo and phone are OPTIONAL now ✅
  saveBtn.disabled = false;
}

/** ---------- Supabase profile load/save ---------- */
async function getProfile() {
  // assumes profiles table uses user.id as primary key "id"
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  if (error) throw error;
  return data || null;
}

async function upsertProfile(payload) {
  const { error } = await supabase
    .from("profiles")
    .upsert(payload, { onConflict: "id" });

  if (error) throw error;
}

async function uploadAvatar(file) {
  // optional: if you created a storage bucket called "avatars"
  // if not present, we just skip upload gracefully
  try {
    const fileExt = file.name.split(".").pop();
    const filePath = `${user.id}/${Date.now()}.${fileExt}`;

    const { error: upErr } = await supabase
      .storage
      .from("avatars")
      .upload(filePath, file, { upsert: true });

    if (upErr) throw upErr;

    const { data } = supabase.storage.from("avatars").getPublicUrl(filePath);
    return data?.publicUrl || "";
  } catch {
    // bucket not configured
    return "";
  }
}

function saveLocalCache(obj) {
  try {
    localStorage.setItem(LS_PROFILE, JSON.stringify(obj));
  } catch {}
}

function loadLocalCache() {
  try {
    const raw = localStorage.getItem(LS_PROFILE);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function applyProfileToUI(p) {
  if (!p) return;

  // account
  if (p.account_type) accountType.value = p.account_type;
  if (p.account_type_other) accountTypeOther.value = p.account_type_other;

  // name/dob
  if (p.full_name) fullName.value = p.full_name;
  if (p.dob) dob.value = p.dob;

  // rank
  if (p.rank) {
    rankValue.value = p.rank;
    rankSearch.value = p.rank;
  }
  if (p.rank_other) rankOther.value = p.rank_other;

  // nationality
  if (p.nationality) {
    countryValue.value = p.nationality;
    countrySearch.value = p.nationality;
  }

  // phone (IMPORTANT FIX: do NOT default to +91)
  const savedDial = normalizeDial(p.phone_dial);
  if (savedDial) {
    dialValue.value = savedDial;
    dialSearch.value = savedDial;
  } else {
    // if dial missing but nationality exists, auto-pick from nationality
    autoPickDialFromNationality();
  }

  if (p.phone_number) phoneInput.value = p.phone_number;

  // avatar
  if (p.avatar_url) setAvatarFromUrl(p.avatar_url);

  updateAccountTypeUI();
  updateRankOtherUI();
  validate();
}

function autoPickDialFromNationality() {
  const nat = (countryValue.value || "").trim();
  if (!nat || !countries.length) return;

  const match = countries.find(c => (c.name || "").toLowerCase() === nat.toLowerCase());
  const dial = normalizeDial(match?.dial_code || "");
  if (!dial) return;

  // only set if user doesn't already have a dial selected
  if (!dialValue.value) {
    dialValue.value = dial;
    dialSearch.value = dial;
  }
}

/** ---------- init ---------- */
async function init() {
  if (!isConfigured()) {
    showError("Supabase is not configured. Add SUPABASE_URL and SUPABASE_ANON_KEY.");
    saveBtn.disabled = true;
    return;
  }

  supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  // auth
  const { data: authData, error: authErr } = await supabase.auth.getUser();
  if (authErr || !authData?.user) {
    // not logged in -> send to login
    window.location.href = "/login.html";
    return;
  }
  user = authData.user;

  // load data files
  countries = await loadCountries();
  ranks = buildRanks();

  /** wire rank combo */
  wireCombo({
    inputEl: rankSearch,
    listEl: rankList,
    sourceList: () => ranks,
    makeLabel: (r) => r,
    makeHaystack: (r) => r,
    onPick: (r) => {
      rankSearch.value = r;
      rankValue.value = r;
      updateRankOtherUI();
    }
  });

  /** wire country combo */
  wireCombo({
    inputEl: countrySearch,
    listEl: countryList,
    sourceList: () => countries,
    makeLabel: (c) => c.name,
    makeHaystack: (c) => `${c.name} ${c.code} ${c.dial_code}`,
    onPick: (c) => {
      countrySearch.value = c.name;
      countryValue.value = c.name;

      // IMPORTANT: auto-pick dial from nationality selection
      const dial = normalizeDial(c.dial_code);
      if (dial) {
        dialValue.value = dial;
        dialSearch.value = dial;
      }

      validate();
    }
  });

  /** wire dial combo */
  wireCombo({
    inputEl: dialSearch,
    listEl: dialList,
    sourceList: () => countries.filter(c => c.dial_code),
    makeLabel: (c) => `${normalizeDial(c.dial_code)} — ${c.name}`,
    makeHaystack: (c) => `${c.name} ${c.code} ${c.dial_code}`,
    onPick: (c) => {
      const dial = normalizeDial(c.dial_code);
      dialSearch.value = dial;
      dialValue.value = dial;
      validate();
    }
  });

  // photo preview
  photoInput.addEventListener("change", (e) => {
    const file = e.target.files?.[0];
    if (file) setAvatarFromFile(file);
    validate();
  });

  removePhotoBtn.addEventListener("click", () => {
    photoInput.value = "";
    setAvatarFromUrl("");
    validate();
  });

  // account type changes
  accountType.addEventListener("change", updateAccountTypeUI);
  accountTypeOther.addEventListener("input", validate);

  // fields
  fullName.addEventListener("input", validate);
  dob.addEventListener("change", validate);
  rankOther.addEventListener("input", validate);
  phoneInput.addEventListener("input", validate);

  // initial UI
  updateAccountTypeUI();
  validate();

  // Load profile (Supabase first, fallback to local cache)
  try {
    const profile = await getProfile();
    if (profile) {
      applyProfileToUI(profile);
      saveLocalCache(profile);
    } else {
      const cached = loadLocalCache();
      if (cached) applyProfileToUI(cached);
    }
  } catch (e) {
    // fallback to local cache if Supabase read fails
    const cached = loadLocalCache();
    if (cached) applyProfileToUI(cached);
  }

  // submit handler
  setupForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    clearError();
    saveBtn.disabled = true;

    try {
      // optional avatar upload
      let avatarUrl = "";
      const file = photoInput.files?.[0];
      if (file) {
        avatarUrl = await uploadAvatar(file);
      }

      // build payload with columns that are safe & simple
      // (avoid nationality_code / schema-cache issues)
      const payload = {
        id: user.id,
        account_type: accountType.value,
        account_type_other: accountType.value === "other" ? accountTypeOther.value.trim() : null,
        full_name: fullName.value.trim() || null,
        dob: dob.value || null,
        rank: accountType.value === "seafarer" ? (rankValue.value || null) : null,
        rank_other: (accountType.value === "seafarer" && (rankValue.value || "").toLowerCase() === "other")
          ? (rankOther.value.trim() || null)
          : null,
        nationality: countryValue.value || null,
        phone_dial: dialValue.value ? normalizeDial(dialValue.value) : null,
        phone_number: phoneInput.value.trim() || null,
      };

      if (avatarUrl) payload.avatar_url = avatarUrl;

      await upsertProfile(payload);

      // cache
      saveLocalCache(payload);

      // go dashboard
      window.location.href = "/dashboard/";
    } catch (err) {
      const msg = String(err?.message || err || "Unknown error");

      // helpful message if schema cache complains about missing columns
      if (msg.toLowerCase().includes("schema cache") || msg.toLowerCase().includes("could not find the")) {
        showError(
          "Database schema missing columns. Add these columns in Supabase 'profiles' table:\n" +
          "- account_type (text)\n- account_type_other (text)\n- full_name (text)\n- dob (date)\n" +
          "- rank (text)\n- rank_other (text)\n- nationality (text)\n- phone_dial (text)\n" +
          "- phone_number (text)\n- avatar_url (text)\n\n" +
          "Then refresh and try again."
        );
      } else {
        showError("Database error saving profile: " + msg);
      }

      saveBtn.disabled = false;
      return;
    }

    saveBtn.disabled = false;
  });
}

init();