import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";

const DASHBOARD_URL = "/dashboard/"; // ✅ folder dashboard

// ===== Supabase config (your existing pattern) =====
const SUPABASE_URL = (window.SUPABASE_URL || localStorage.getItem("SUPABASE_URL") || "").trim();
const SUPABASE_ANON_KEY = (window.SUPABASE_ANON_KEY || localStorage.getItem("SUPABASE_ANON_KEY") || "").trim();

function isValidHttpUrl(u){ return /^https?:\/\/.+/i.test(u); }
function $(id){ return document.getElementById(id); }

const errorBox = $("errorBox");
function showError(msg){
  errorBox.style.display = "block";
  errorBox.textContent = msg;
}
function clearError(){
  errorBox.style.display = "none";
  errorBox.textContent = "";
}

let sb = null;
if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  showError("Supabase keys are missing. Please set SUPABASE_URL and SUPABASE_ANON_KEY.");
} else if (!isValidHttpUrl(SUPABASE_URL)) {
  showError("Invalid SUPABASE_URL. It must start with https://");
} else {
  sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}

// ===== Elements =====
const form = $("setupForm");
const saveBtn = $("saveBtn");

const accountType = $("accountType");
const accountTypeOtherWrap = $("accountTypeOtherWrap");
const accountTypeOther = $("accountTypeOther");

const fullName = $("fullName");

const rankWrap = $("rankWrap");
const rankSearch = $("rankSearch");
const rankValue = $("rankValue");
const rankList = $("rankList");
const rankOtherWrap = $("rankOtherWrap");
const rankOther = $("rankOther");

const countrySearch = $("countrySearch");
const countryValue = $("countryValue");
const countryList = $("countryList");

const dialSearch = $("dialSearch");
const dialValue = $("dialValue");
const dialList = $("dialList");
const phoneInput = $("phoneInput");

// Photo (optional)
const photoInput = $("photoInput");
const avatarPreview = $("avatarPreview");
const removePhotoBtn = $("removePhotoBtn");
let selectedPhotoFile = null;

// ===== Data (Ranks + Countries) =====
const RANKS = [
  "Master / Captain",
  "Chief Officer / C/O",
  "Second Officer / 2/O",
  "Third Officer / 3/O",
  "Deck Cadet",
  "Chief Engineer / C/E",
  "Second Engineer / 2/E",
  "Third Engineer / 3/E",
  "Fourth Engineer / 4/E",
  "Engine Cadet",
  "Bosun",
  "AB (Able Seaman)",
  "OS (Ordinary Seaman)",
  "Motorman",
  "Oiler",
  "Fitter",
  "Cook",
  "Steward",
  "Electrician / ETO",
  "Pumpman",
  "Crane Operator",
  "Other"
];

let COUNTRIES = []; // expects objects: {name, dial_code, code}

// IMPORTANT: you said "countries.json committed" — so we load from root.
async function loadCountries(){
  try{
    const res = await fetch("/countries.json?v=1", { cache: "no-store" });
    if(!res.ok) throw new Error("countries.json not found");
    const data = await res.json();
    if(!Array.isArray(data)) throw new Error("countries.json format invalid");
    COUNTRIES = data.map(c => ({
      name: (c.name || "").trim(),
      dial_code: (c.dial_code || "").toString().replace(/\s+/g,""),
      code: (c.code || "").trim()
    })).filter(c => c.name);
  }catch(e){
    // fallback minimal (so page never breaks)
    COUNTRIES = [
      { name:"India", dial_code:"+91", code:"IN" },
      { name:"Ireland", dial_code:"+353", code:"IE" },
      { name:"United Kingdom", dial_code:"+44", code:"GB" },
      { name:"Singapore", dial_code:"+65", code:"SG" },
      { name:"United Arab Emirates", dial_code:"+971", code:"AE" },
    ];
  }
}

// ===== Combo UI helper =====
function openList(listEl){ listEl.classList.add("show"); }
function closeList(listEl){ listEl.classList.remove("show"); }

function renderList(listEl, items, onPick){
  listEl.innerHTML = "";
  if(!items.length){
    const d = document.createElement("div");
    d.className = "comboEmpty";
    d.textContent = "No results";
    listEl.appendChild(d);
    openList(listEl);
    return;
  }
  items.forEach(it => {
    const row = document.createElement("div");
    row.className = "comboItem";
    row.innerHTML = it.html;
    row.addEventListener("click", () => onPick(it));
    listEl.appendChild(row);
  });
  openList(listEl);
}

function filterByText(arr, key, q){
  const t = (q || "").toLowerCase().trim();
  if(!t) return arr.slice(0, 60);
  return arr.filter(x => (x[key] || "").toLowerCase().includes(t)).slice(0, 60);
}

function setupCombo({ inputEl, listEl, itemsProvider, itemToRow, onPick }){
  inputEl.addEventListener("focus", () => {
    const items = itemsProvider();
    renderList(listEl, items.map(itemToRow), (it) => onPick(it.value));
  });

  inputEl.addEventListener("input", () => {
    const items = itemsProvider(inputEl.value);
    renderList(listEl, items.map(itemToRow), (it) => onPick(it.value));
  });

  document.addEventListener("click", (e) => {
    if (listEl.contains(e.target) || inputEl.contains(e.target)) return;
    closeList(listEl);
  });
}

// ===== Photo preview (optional) =====
photoInput.addEventListener("change", () => {
  const f = photoInput.files?.[0] || null;
  selectedPhotoFile = f;
  if(!f){
    avatarPreview.innerHTML = `<span class="avatarHint">Add photo</span>`;
    return;
  }
  const url = URL.createObjectURL(f);
  avatarPreview.innerHTML = `<img src="${url}" alt="Profile photo" />`;
});

removePhotoBtn.addEventListener("click", () => {
  selectedPhotoFile = null;
  photoInput.value = "";
  avatarPreview.innerHTML = `<span class="avatarHint">Add photo</span>`;
});

// ===== Account type logic =====
function updateAccountTypeUI(){
  const t = accountType.value;

  // other field
  if(t === "other") accountTypeOtherWrap.classList.remove("hidden");
  else accountTypeOtherWrap.classList.add("hidden");

  // rank only for seafarer
  if(t === "seafarer") rankWrap.classList.remove("hidden");
  else {
    rankWrap.classList.add("hidden");
    rankValue.value = "";
    rankSearch.value = "";
    rankOtherWrap.classList.add("hidden");
    rankOther.value = "";
  }
}
accountType.addEventListener("change", updateAccountTypeUI);

// ===== Build combos =====
function initRankCombo(){
  setupCombo({
    inputEl: rankSearch,
    listEl: rankList,
    itemsProvider: (q) => filterByText(RANKS.map(r => ({label:r})), "label", q),
    itemToRow: (item) => ({
      value: item.label,
      html: `<strong>${item.label}</strong>`
    }),
    onPick: (value) => {
      rankSearch.value = value;
      rankValue.value = value;
      closeList(rankList);

      if(value === "Other"){
        rankOtherWrap.classList.remove("hidden");
      } else {
        rankOtherWrap.classList.add("hidden");
        rankOther.value = "";
      }
    }
  });
}

function initCountryCombos(){
  // Country name
  setupCombo({
    inputEl: countrySearch,
    listEl: countryList,
    itemsProvider: (q) => filterByText(COUNTRIES, "name", q),
    itemToRow: (c) => ({
      value: c,
      html: `<strong>${c.name}</strong> <span style="color:#5d7a88;">(${c.code})</span>`
    }),
    onPick: (c) => {
      countrySearch.value = c.name;
      countryValue.value = c.code || c.name;
      closeList(countryList);

      // Auto dial code
      if(c.dial_code){
        dialSearch.value = c.dial_code;
        dialValue.value = c.dial_code;
      }
    }
  });

  // Dial code
  setupCombo({
    inputEl: dialSearch,
    listEl: dialList,
    itemsProvider: (q) => {
      const t = (q || "").toLowerCase().trim();
      const base = COUNTRIES
        .filter(c => c.dial_code)
        .map(c => ({ name:c.name, dial_code:c.dial_code, code:c.code }));

      if(!t) return base.slice(0, 60);

      // search by dial code OR country name
      return base.filter(c =>
        c.dial_code.toLowerCase().includes(t) ||
        c.name.toLowerCase().includes(t)
      ).slice(0, 60);
    },
    itemToRow: (c) => ({
      value: c,
      html: `<strong>${c.dial_code}</strong> <span style="color:#5d7a88;">${c.name}</span>`
    }),
    onPick: (c) => {
      dialSearch.value = c.dial_code;
      dialValue.value = c.dial_code;
      closeList(dialList);

      // If user picked dial code, also set country (nice UX)
      if(c.code){
        countrySearch.value = c.name;
        countryValue.value = c.code;
      }
    }
  });
}

// ===== Validation (Photo + phone NOT mandatory) =====
function validate(){
  clearError();

  const t = accountType.value;
  if(!t) return { ok:false, msg:"Please select account type." };

  if(t === "other"){
    if(!accountTypeOther.value.trim()) return { ok:false, msg:"Please specify account type." };
  }

  // Nationality required
  if(!countrySearch.value.trim()) return { ok:false, msg:"Please select nationality." };

  // Rank required only for seafarer
  if(t === "seafarer"){
    const r = rankValue.value || rankSearch.value;
    if(!r) return { ok:false, msg:"Please select your rank." };
    if(r === "Other" && !rankOther.value.trim()) return { ok:false, msg:"Please enter your rank (Other)." };
  }

  // Phone is optional, but if number entered, dial code must exist
  const phone = phoneInput.value.trim();
  if(phone && !dialSearch.value.trim()){
    return { ok:false, msg:"Please select country code for your mobile number." };
  }

  return { ok:true };
}

// ===== Save profile to Supabase =====
async function saveProfile(){
  if(!sb){
    showError("Supabase not configured.");
    return;
  }

  const { data: { session } } = await sb.auth.getSession();
  if(!session?.user){
    window.location.href = "/auth/login.html";
    return;
  }

  const t = accountType.value;

  const payload = {
    id: session.user.id,
    full_name: fullName.value.trim() || null,
    account_type: t === "other" ? (accountTypeOther.value.trim() || "other") : t,
    nationality: countrySearch.value.trim() || null,
    nationality_code: countryValue.value.trim() || null,
    phone_dial: dialSearch.value.trim() || null,
    phone_number: phoneInput.value.trim() || null,
  };

  // Rank only for seafarer
  if(t === "seafarer"){
    const chosen = (rankValue.value || rankSearch.value).trim();
    payload.rank = chosen === "Other" ? (rankOther.value.trim() || "Other") : chosen;
  } else {
    payload.rank = null;
  }

  // Avatar: optional. If no photo, do not touch avatar_url.
  // If you already have an upload system later, we’ll integrate it.
  // For now: if photo selected, we just store a local marker and you can upgrade later.
  // (NOT mandatory)
  if(selectedPhotoFile){
    // placeholder: do nothing now (avoid bugs)
    // We will add real Supabase Storage upload after everything is stable.
  }

  const { error } = await sb
    .from("profiles")
    .upsert(payload, { onConflict: "id" });

  if(error){
    showError("Database error saving profile: " + (error.message || "Unknown error"));
    return;
  }

  // ✅ Success → go dashboard folder (no 404)
  window.location.href = DASHBOARD_URL;
}

// ===== Submit =====
form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const v = validate();
  if(!v.ok){
    showError(v.msg);
    return;
  }

  saveBtn.disabled = true;
  saveBtn.textContent = "Saving...";
  try{
    await saveProfile();
  } finally {
    // if redirect happens, user won’t see this; if error, restore
    saveBtn.disabled = false;
    saveBtn.textContent = "Save & Continue";
  }
});

// ===== Boot =====
(async function boot(){
  await loadCountries();
  initRankCombo();
  initCountryCombos();
  updateAccountTypeUI();

  // If user is not logged in, go login (prevents weird behavior)
  if(sb){
    const { data: { session } } = await sb.auth.getSession();
    if(!session?.user){
      window.location.href = "/auth/login.html";
    }
  }
})();