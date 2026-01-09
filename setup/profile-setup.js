import { supabase } from "/js/supabase.js";

const $ = (id) => document.getElementById(id);
const hasHidden = (el) => el?.classList?.contains("hidden");

const els = {
  form: $("setupForm"),
  saveBtn: $("saveBtn"),
  errorBox: $("errorBox"),

  accountType: $("accountType"),
  accountTypeOtherWrap: $("accountTypeOtherWrap"),
  accountTypeOther: $("accountTypeOther"),

  fullName: $("fullName"),
  dob: $("dob"),

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

  companyWrap: $("companyWrap"),
  companyName: $("companyName"),

  countrySearch: $("countrySearch"),
  countryValue: $("countryValue"),
  countryList: $("countryList"),

  dialSearch: $("dialSearch"),
  dialValue: $("dialValue"),
  dialList: $("dialList"),

  phoneInput: $("phoneInput"),
  bio: $("bio"),

  photoInput: $("photoInput"),
  removePhotoBtn: $("removePhotoBtn"),
  avatarPreview: $("avatarPreview"),
};

let currentUser = null;
let countries = []; // expected objects: {name, dial_code, code}

/* --------- BIG RANK LIST --------- */
const RANKS = [
  // Deck - Merchant
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

  // Ratings - Deck
  "Bosun",
  "AB / Able Seaman",
  "OS / Ordinary Seaman",
  "Trainee AB",
  "Trainee OS",
  "Deck Fitter",
  "Carpenter",

  // Engine - Merchant
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

  // Electrical / ETO
  "ETO / Electro-Technical Officer",
  "Electrical Engineer",
  "Electrician",
  "Electronics Technician",

  // Tanker / Gas specific
  "Cargo Engineer (LNG/LPG)",
  "Gas Engineer (LNG/LPG)",
  "Loading Master",
  "Tanker PIC",
  "Crude Oil Tanker Officer",
  "Chemical Tanker Officer",
  "LNG Cargo Operator",

  // Offshore / DP / OSV
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

  // Offshore / Rig positions (shore/offshore but still “seafarer related”)
  "Rig Superintendent",
  "Rig Manager",
  "Toolpusher",
  "Driller",
  "Assistant Driller",
  "Crane Operator (Offshore)",
  "ROV Pilot / Technician",

  // Passenger / Cruise - Deck
  "Staff Captain",
  "Cruise Safety Officer",
  "Navigation Officer (Cruise)",
  "Bridge Officer (Cruise)",
  "Environmental Officer (Cruise)",

  // Cruise - Engine / Technical
  "Fleet Engineer (Cruise)",
  "Technical Officer (Cruise)",
  "Engine Officer (Cruise)",

  // Cruise / Hotel / Service (for seafarer category too)
  "Hotel Director (Cruise)",
  "Food & Beverage Manager (Cruise)",
  "Executive Chef (Cruise)",
  "Sous Chef (Cruise)",
  "Cook (Cruise)",
  "Housekeeping Manager (Cruise)",
  "Cabin Steward (Cruise)",
  "Bartender (Cruise)",
  "Waiter / Server (Cruise)",

  // Misc
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
  // Support both CSS styles: .show class AND inline display fallback
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

function normalizeAccountType(){
  const v = els.accountType?.value || "";
  if (v === "other") {
    const other = (els.accountTypeOther?.value || "").trim();
    return other ? other : "Other";
  }
  if (!v) return "";
  return v.charAt(0).toUpperCase() + v.slice(1);
}

function getRank(){
  const v = (els.rankValue?.value || "").trim();
  if (v === "Other") return (els.rankOther?.value || "").trim();
  return v;
}

function getRole(){
  const v = (els.roleValue?.value || "").trim();
  if (v === "Other") return (els.roleOther?.value || "").trim();
  return v;
}

function getNationality(){ return (els.countryValue?.value || "").trim(); }

function getPhone(){
  const dial = (els.dialValue?.value || "").trim();
  const num = (els.phoneInput?.value || "").trim();
  if (!num) return "";
  if (dial && !num.startsWith("+")) return `${dial} ${num}`;
  return num;
}

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
          const txt = (typeof it === "string" ? it : (it?.name || it?.dial_code || "")).toLowerCase();
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

  // initial
  render(items.slice(0, 120));
}

/* --------- Countries --------- */
async function loadCountries(){
  const res = await fetch("/data/countries.json", { cache: "no-store" });
  const json = await res.json();

  // Your countries.json already exists in /data
  countries = (json || [])
    .map(c => ({
      name: c.name || c.country || c.Country || "",
      dial_code: c.dial_code || c.dialCode || c.dial || "",
      code: c.code || c.iso2 || c.iso || ""
    }))
    .filter(c => c.name);

  // If dial_code missing for some, it’s ok (still show country list)
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

/* --------- Validation (controls Save button) --------- */
function validate(){
  clearError();

  const acct = els.accountType?.value || "";
  const acctOk = !!acct;

  const otherOk = acct !== "other" || ((els.accountTypeOther?.value || "").trim().length > 1);

  const nationalityOk = getNationality().length > 1;

  // Seafarer -> rank required
  const rankOk = !isSeafarer() || getRank().length > 1;
  const rankOtherOk = !(isSeafarer() && (els.rankValue?.value === "Other")) || ((els.rankOther?.value || "").trim().length > 1);

  // Employer/Shore -> role required
  const roleOk = !isEmployerOrShore() || getRole().length > 1;
  const roleOtherOk = !(isEmployerOrShore() && (els.roleValue?.value === "Other")) || ((els.roleOther?.value || "").trim().length > 1);

  const ok = acctOk && otherOk && nationalityOk && rankOk && rankOtherOk && roleOk && roleOtherOk;

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

  if (acct === "employer" || acct === "shore") {
    show(els.roleWrap);
    show(els.companyWrap);
  } else {
    hide(els.roleWrap);
    hide(els.companyWrap);
  }

  validate();
}

/* --------- Save (never silent fail) --------- */
async function saveProfile(){
  if (!validate()) {
    showError("Please complete the required fields (Account type, Nationality, Rank/Role).");
    return;
  }

  els.saveBtn.disabled = true;
  els.saveBtn.textContent = "Saving…";

  const payload = {
    id: currentUser.id,
    account_type: normalizeAccountType(),
    full_name: (els.fullName?.value || "").trim(),
    dob: els.dob?.value || null,

    rank: isSeafarer() ? getRank() : null,

    // Employer/Shore fields
    role: isEmployerOrShore() ? getRole() : null,
    company_name: isEmployerOrShore() ? (els.companyName?.value || "").trim() : null,

    nationality: getNationality(),
    phone: getPhone(),
    bio: (els.bio?.value || "").trim(),

    setup_complete: true,
    updated_at: new Date().toISOString()
  };

  const { error } = await supabase.from("profiles").upsert(payload, { onConflict: "id" });

  if (error) {
    console.warn("SUPABASE SAVE ERROR:", error);

    // Show the REAL error message so you can screenshot it for me if needed
    showError(`Save failed: ${error.message || "Unknown error"}`);
    els.saveBtn.disabled = false;
    els.saveBtn.textContent = "Save & Continue";
    return;
  }

  window.location.href = "/dashboard/index.html";
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

  // Role combo
  makeCombo({
    comboName: "role",
    inputEl: els.roleSearch,
    listEl: els.roleList,
    items: ROLES,
    label: (r) => `<strong>${r}</strong>`,
    onPick: (r) => {
      els.roleSearch.value = r;
      els.roleValue.value = r;
      if (r === "Other") show(els.roleOtherWrap); else hide(els.roleOtherWrap);
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

      // Auto dial if available
      if (c.dial_code) {
        els.dialSearch.value = c.dial_code;
        els.dialValue.value = c.dial_code;
      }
      validate();
    }
  });

  // Dial combo
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

  // Avatar preview
  els.photoInput?.addEventListener("change", (e) => setAvatarPreview(e.target.files?.[0] || null));
  els.removePhotoBtn?.addEventListener("click", () => {
    if (els.photoInput) els.photoInput.value = "";
    setAvatarPreview(null);
  });

  // Events
  els.accountType?.addEventListener("change", syncAccountUI);
  els.accountTypeOther?.addEventListener("input", validate);
  els.rankOther?.addEventListener("input", validate);
  els.roleOther?.addEventListener("input", validate);
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

  // Save (submit + click fallback)
  els.form?.addEventListener("submit", (e) => { e.preventDefault(); saveProfile(); });
  els.saveBtn?.addEventListener("click", (e) => { e.preventDefault(); saveProfile(); });

  // initial
  syncAccountUI();
  validate();
});