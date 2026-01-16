import { supabase } from "/js/supabase.js";
import { ROUTES } from "/js/config.js";

const $ = (id) => document.getElementById(id);

const els = {
  form: $("setupForm"),
  saveBtn: $("saveBtn"),
  errorBox: $("errorBox"),

  // In UI this is the account type selector (seafarer/employer/shore)
  accountType: $("accountType"),
  accountTypeOtherWrap: $("accountTypeOtherWrap"),
  accountTypeOther: $("accountTypeOther"),

  fullName: $("fullName"),
  dob: $("dob"), // kept in UI but NOT saved in V1 DB
  companyWrap: $("companyWrap"),
  companyName: $("companyName"), // kept in UI but NOT saved in V1 DB

  rankWrap: $("rankWrap"),
  rankSearch: $("rankSearch"),
  rankValue: $("rankValue"),
  rankList: $("rankList"),
  rankOtherWrap: $("rankOtherWrap"),
  rankOther: $("rankOther"),

  roleWrap: $("roleWrap"),
  roleSearch: $("roleSearch"),
  roleValue: $("roleValue"),
  roleList: $("roleList"),
  roleOtherWrap: $("roleOtherWrap"),
  roleOther: $("roleOther"),

  countrySearch: $("countrySearch"),
  countryValue: $("countryValue"),
  countryList: $("countryList"),

  dialSearch: $("dialSearch"),
  dialValue: $("dialValue"),
  dialList: $("dialList"),

  phoneInput: $("phoneInput"), // kept in UI but NOT saved in V1 DB
  bio: $("bio"),

  photoInput: $("photoInput"),
  removePhotoBtn: $("removePhotoBtn"),
  avatarPreview: $("avatarPreview"),
};

let currentUser = null;
let countries = []; // {name, dial_code, code}

/* --------- BIG RANK LIST --------- */
const RANKS = [
  "Master / Captain",
  "Chief Officer / C/O",
  "Second Officer / 2/O",
  "Third Officer / 3/O",
  "Fourth Officer / 4/O",
  "Deck Cadet / Trainee",
  "Junior Officer",
  "Safety Officer",
  "Security Officer (SSO)",
  "Medical Officer",
  "Bosun",
  "AB / Able Seaman",
  "OS / Ordinary Seaman",
  "Trainee AB",
  "Trainee OS",
  "Deck Fitter",
  "Carpenter",
  "Chief Engineer",
  "Second Engineer",
  "Third Engineer",
  "Fourth Engineer",
  "Fifth Engineer / Junior Engineer",
  "Engine Cadet / Trainee",
  "Motorman",
  "Oiler",
  "Wiper",
  "Fitter",
  "Pumpman",
  "Reefer Engineer",
  "Welder",
  "ETO / Electro-Technical Officer",
  "Electrical Engineer",
  "Electrician",
  "Electronics Technician",
  "Cargo Engineer (LNG/LPG)",
  "Gas Engineer (LNG/LPG)",
  "Loading Master",
  "Tanker PIC",
  "Crude Oil Tanker Officer",
  "Chemical Tanker Officer",
  "LNG Cargo Operator",
  "Master (OSV)",
  "Chief Mate (OSV)",
  "2nd Mate / DPO",
  "3rd Mate / Junior DPO",
  "Chief Engineer (OSV)",
  "2nd Engineer (OSV)",
  "3rd Engineer (OSV)",
  "Barge Master",
  "Rig Move Master",
  "Tow Master",
  "AHTS Master",
  "PSV Master",
  "Crewboat Master",
  "DPO / Dynamic Positioning Operator",
  "Senior DPO",
  "DP Maintenance Technician",
  "Rig Superintendent",
  "Rig Manager",
  "Toolpusher",
  "Driller",
  "Assistant Driller",
  "Crane Operator (Offshore)",
  "ROV Pilot / Technician",
  "Staff Captain",
  "Cruise Safety Officer",
  "Navigation Officer (Cruise)",
  "Bridge Officer (Cruise)",
  "Environmental Officer (Cruise)",
  "Fleet Engineer (Cruise)",
  "Technical Officer (Cruise)",
  "Engine Officer (Cruise)",
  "Hotel Director (Cruise)",
  "Food & Beverage Manager (Cruise)",
  "Executive Chef (Cruise)",
  "Sous Chef (Cruise)",
  "Cook (Cruise)",
  "Housekeeping Manager (Cruise)",
  "Cabin Steward (Cruise)",
  "Bartender (Cruise)",
  "Waiter / Server (Cruise)",
  "Pilot (Maritime)",
  "VTS Officer",
  "Marine Surveyor",
  "Port Captain",
  "Superintendent",
  "Cadet (Other)",
  "Other"
];

/* --------- Employer / Shore role list --------- */
const ROLES = [
  "Crewing Manager",
  "Crew Operator / Crew Coordinator",
  "Recruiter / Talent Acquisition",
  "Manning Agent / Agency Staff",
  "HR Manager",
  "Operations Manager",
  "Fleet Manager",
  "Marine Superintendent",
  "Technical Superintendent",
  "HSQE / QHSE Officer",
  "Training / Instructor",
  "Port Captain",
  "Chartering / Commercial",
  "Marine Surveyor",
  "Ship Chandler / Supplier",
  "Port / Terminal Staff",
  "Immigration / Visa Agent",
  "Accounts / Finance",
  "IT / Product / Software",
  "Other"
];

/* --------- UI helpers --------- */
function show(el){ el && el.classList.remove("hidden"); }
function hide(el){ el && el.classList.add("hidden"); }

function showList(listEl){
  if (!listEl) return;
  listEl.classList.add("show");
  listEl.style.display = "block";
}
function hideList(listEl){
  if (!listEl) return;
  listEl.classList.remove("show");
  listEl.style.display = "";
}

function showError(msg){
  if (!els.errorBox) return;
  els.errorBox.style.display = "block";
  els.errorBox.textContent = msg || "Something went wrong.";
}
function clearError(){
  if (!els.errorBox) return;
  els.errorBox.style.display = "none";
  els.errorBox.textContent = "";
}

function isSeafarer(){ return (els.accountType?.value || "") === "seafarer"; }
function isEmployerOrShore(){
  const v = els.accountType?.value || "";
  return v === "employer" || v === "shore";
}

/**
 * IMPORTANT:
 * In V1 DB, profiles.role must be exactly: seafarer | employer | shore
 * (We do NOT store "account_type" anymore.)
 */
function getRoleForDB(){
  const v = (els.accountType?.value || "").trim();
  // If user selected "other", we still must store one of the allowed roles.
  // So we default to "shore" (closest). You can change later.
  if (v === "other") return "shore";
  return v; // seafarer/employer/shore
}

function getRank(){
  const v = (els.rankValue?.value || "").trim();
  if (v === "Other") return (els.rankOther?.value || "").trim();
  return v;
}

function getNationality(){ return (els.countryValue?.value || "").trim(); }

/* --------- Generic Combo --------- */
function makeCombo({ comboName, inputEl, listEl, items, label, onPick }) {
  if (!inputEl || !listEl) return;
  const key = comboName;

  function render(list){
    listEl.innerHTML = "";
    if (!list.length) {
      const empty = document.createElement("div");
      empty.className = "comboEmpty";
      empty.textContent = "No results";
      listEl.appendChild(empty);
      return;
    }
    list.forEach((it) => {
      const row = document.createElement("div");
      row.className = "comboItem";
      row.innerHTML = label(it);
      row.addEventListener("click", () => {
        onPick(it);
        hideList(listEl);
      });
      listEl.appendChild(row);
    });
  }

  function filterNow(){
    const q = (inputEl.value || "").toLowerCase().trim();
    const filtered = !q
      ? items.slice(0, 200)
      : items.filter((it) => {
          const txt = (typeof it === "string"
            ? it
            : (it?.name || it?.dial_code || "")).toLowerCase();
          return txt.includes(q);
        }).slice(0, 200);

    render(filtered);
    showList(listEl);
  }

  inputEl.addEventListener("focus", filterNow);
  inputEl.addEventListener("input", filterNow);

  document.addEventListener("click", (e) => {
    if (!e.target.closest(`[data-combo="${key}"]`)) {
      hideList(listEl);
    }
  });

  render(items.slice(0, 120));
}

/* --------- Countries --------- */
async function loadCountries(){
  const res = await fetch("/data/countries.json", { cache: "no-store" });
  const json = await res.json();

  countries = (json || [])
    .map(c => ({
      name: c.name || c.country || c.Country || "",
      dial_code: c.dial_code || c.dialCode || c.dial || "",
      code: c.code || c.iso2 || c.iso || ""
    }))
    .filter(c => c.name);
}

/* --------- Avatar preview only --------- */
function setAvatarPreview(file){
  if (!els.avatarPreview) return;

  if (!file) {
    els.avatarPreview.style.backgroundImage = "";
    els.avatarPreview.innerHTML = `<span class="avatarHint">Add photo</span>`;
    return;
  }
  const url = URL.createObjectURL(file);
  els.avatarPreview.innerHTML = "";
  els.avatarPreview.style.backgroundSize = "cover";
  els.avatarPreview.style.backgroundPosition = "center";
  els.avatarPreview.style.backgroundImage = `url("${url}")`;
}

/* --------- Validation --------- */
function validate(){
  clearError();

  const acct = (els.accountType?.value || "").trim();
  const acctOk = !!acct;

  const otherOk = acct !== "other" || ((els.accountTypeOther?.value || "").trim().length > 1);
  const nationalityOk = getNationality().length > 1;

  // Seafarer -> rank required
  const rankOk = !isSeafarer() || getRank().length > 1;
  const rankOtherOk = !(isSeafarer() && (els.rankValue?.value === "Other")) ||
    ((els.rankOther?.value || "").trim().length > 1);

  const ok = acctOk && otherOk && nationalityOk && rankOk && rankOtherOk;

  if (els.saveBtn) els.saveBtn.disabled = !ok;
  return ok;
}

/* --------- Account UI switching --------- */
function syncAccountUI(){
  const acct = els.accountType?.value || "";

  if (acct === "other") show(els.accountTypeOtherWrap);
  else hide(els.accountTypeOtherWrap);

  if (acct === "seafarer") show(els.rankWrap);
  else hide(els.rankWrap);

  // Employer/Shore: show employer fields (UI only; not saved in V1 DB)
  if (acct === "employer" || acct === "shore") {
    show(els.roleWrap);
    show(els.companyWrap);
  } else {
    hide(els.roleWrap);
    hide(els.companyWrap);
  }

  validate();
}

/* --------- Save (aligned to V1 DB) --------- */
async function saveProfile(){
  if (!validate()) {
    showError("Please complete the required fields (Account type, Nationality, Rank if Seafarer).");
    return;
  }

  els.saveBtn.disabled = true;
  els.saveBtn.textContent = "Saving…";

  const payload = {
    id: currentUser.id,

    // V1 DB fields
    full_name: (els.fullName?.value || "").trim() || null,
    role: getRoleForDB(), // seafarer/employer/shore (allowed by DB constraint)
    nationality: getNationality() || null,
    rank: isSeafarer() ? (getRank() || null) : null,
    bio: (els.bio?.value || "").trim() || null,

    setup_complete: true,
    updated_at: new Date().toISOString()
  };

  const { error } = await supabase.from("profiles").upsert(payload, { onConflict: "id" });

  if (error) {
    console.warn("SUPABASE SAVE ERROR:", error);
    showError(`Save failed: ${error.message || "Unknown error"}`);
    els.saveBtn.disabled = false;
    els.saveBtn.textContent = "Save & Continue";
    return;
  }

  // ✅ After first-time setup -> go to Feed
  window.location.href = ROUTES?.feed || "/feed/index.html";
}

/* --------- Init --------- */
document.addEventListener("DOMContentLoaded", async () => {
  const { data } = await supabase.auth.getUser();
  currentUser = data?.user;

  if (!currentUser) {
    window.location.href = "/auth/login.html";
    return;
  }

  await loadCountries();

  // Rank combo
  makeCombo({
    comboName: "rank",
    inputEl: els.rankSearch,
    listEl: els.rankList,
    items: RANKS,
    label: (r) => `<strong>${r}</strong>`,
    onPick: (r) => {
      els.rankSearch.value = r;
      els.rankValue.value = r;
      if (r === "Other") show(els.rankOtherWrap); else hide(els.rankOtherWrap);
      validate();
    }
  });

  // Country combo
  makeCombo({
    comboName: "country",
    inputEl: els.countrySearch,
    listEl: els.countryList,
    items: countries,
    label: (c) => `<strong>${c.name}</strong>`,
    onPick: (c) => {
      els.countrySearch.value = c.name;
      els.countryValue.value = c.name;

      // UI-only dial auto-fill (not saved in V1 DB)
      if (c.dial_code) {
        els.dialSearch.value = c.dial_code;
        els.dialValue.value = c.dial_code;
      }
      validate();
    }
  });

  // Dial combo (UI only)
  makeCombo({
    comboName: "dial",
    inputEl: els.dialSearch,
    listEl: els.dialList,
    items: countries.filter(c => c.dial_code),
    label: (c) => `<strong>${c.dial_code}</strong> <span class="muted">— ${c.name}</span>`,
    onPick: (c) => {
      els.dialSearch.value = c.dial_code;
      els.dialValue.value = c.dial_code;
      validate();
    }
  });

  // Avatar preview (UI only; storage later)
  els.photoInput?.addEventListener("change", (e) => setAvatarPreview(e.target.files?.[0] || null));
  els.removePhotoBtn?.addEventListener("click", () => {
    if (els.photoInput) els.photoInput.value = "";
    setAvatarPreview(null);
  });

  // Events
  els.accountType?.addEventListener("change", syncAccountUI);
  els.accountTypeOther?.addEventListener("input", validate);
  els.rankOther?.addEventListener("input", validate);
  els.companyName?.addEventListener("input", validate);
  els.countrySearch?.addEventListener("input", validate);
  els.dialSearch?.addEventListener("input", () => {
    els.dialValue.value = (els.dialSearch.value || "").trim();
    validate();
  });
  els.phoneInput?.addEventListener("input", validate);
  els.bio?.addEventListener("input", validate);
  els.fullName?.addEventListener("input", validate);
  els.dob?.addEventListener("change", validate);

  // Save
  els.form?.addEventListener("submit", (e) => { e.preventDefault(); saveProfile(); });
  els.saveBtn?.addEventListener("click", (e) => { e.preventDefault(); saveProfile(); });

  // initial
  syncAccountUI();
  validate();
});