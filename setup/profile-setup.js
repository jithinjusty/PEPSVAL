import { supabase } from "/js/supabase.js";
import { ROUTES } from "/js/config.js";

const $ = (id) => document.getElementById(id);

const els = {
  form: $("setupForm"),
  saveBtn: $("saveBtn"),
  errorBox: $("errorBox"),

  accountType: $("accountType"),

  fullName: $("fullName"),
  bio: $("bio"),

  // main dropdown reused
  rankWrap: $("rankWrap"),
  rankLabel: $("rankLabel"),
  rankHelp: $("rankHelp"),
  rankSearch: $("rankSearch"),
  rankValue: $("rankValue"),
  rankList: $("rankList"),
  rankOtherWrap: $("rankOtherWrap"),
  rankOther: $("rankOther"),

  countrySearch: $("countrySearch"),
  countryValue: $("countryValue"),
  countryList: $("countryList"),

  dialSearch: $("dialSearch"),
  dialValue: $("dialValue"),
  dialList: $("dialList"),
  phoneInput: $("phoneInput"),

  photoInput: $("photoInput"),
  removePhotoBtn: $("removePhotoBtn"),
  avatarPreview: $("avatarPreview"),
};

let currentUser = null;
let countries = [];

/* =========================================================
   1) Seafarer - ONLY onboard ship roles
   ========================================================= */
const SHIP_ROLES = [
  "Master / Captain",
  "Chief Officer / C/O",
  "Second Officer / 2/O",
  "Third Officer / 3/O",
  "Fourth Officer / 4/O",
  "Deck Cadet / Trainee",

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
  "Electrician",
  "Electronics Technician",

  "Safety Officer",
  "Security Officer (SSO)",
  "Medical Officer",

  "Other"
];

/* =========================================================
   2) Company / Institute types
   ========================================================= */
const COMPANY_TYPES = [
  "Ship Owner / Ship Management Company",
  "Crewing / Manning Agency",
  "Ship Operator / Charterer",
  "Shipyard / Repair Yard",
  "Maritime Training Institute",
  "Maritime Academy / College",
  "Class / Survey / Inspection Company",
  "P&I / Marine Insurance",
  "Port / Terminal Operator",
  "Ship Chandler / Supplier",
  "Marine Equipment Manufacturer",
  "Logistics / Freight / Forwarding",
  "Other"
];

/* =========================================================
   3) Other maritime professionals (NOT onboard ranks)
   ========================================================= */
const PROFESSIONAL_ROLES = [
  "Port Captain",
  "Marine Superintendent",
  "Technical Superintendent",
  "Fleet Manager",
  "HSQE / QHSE Officer",
  "Marine Surveyor",
  "VTS Operator / VTS Officer",
  "Pilot (Maritime)",
  "Port / Terminal Staff",
  "Crewing Manager",
  "Crew Coordinator / Operator",
  "Recruiter / Talent Acquisition",
  "Training Instructor",
  "Ship Broker / Chartering",
  "Marine Lawyer / Claims",
  "Marine Insurance / P&I Staff",
  "Customs / Immigration / Clearance Agent",
  "Ship Chandling Sales / Ops",
  "Maritime IT / Product / Software",
  "Other"
];

/* ---------------- UI helpers ---------------- */
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

function getNationality(){
  const chosen = (els.countryValue?.value || "").trim();
  const typed = (els.countrySearch?.value || "").trim();
  return chosen || typed;
}

/* ---------------- Combo ---------------- */
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
      ? items.slice(0, 250)
      : items.filter((it) => (it || "").toLowerCase().includes(q)).slice(0, 250);

    render(filtered);
    showList(listEl);
  }

  inputEl.addEventListener("focus", filterNow);
  inputEl.addEventListener("input", filterNow);

  document.addEventListener("click", (e) => {
    if (!e.target.closest(`[data-combo="${key}"]`)) hideList(listEl);
  });

  render(items.slice(0, 120));
}

/* ---------------- Countries ---------------- */
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

function getActiveList(){
  const v = (els.accountType?.value || "").trim();
  if (v === "seafarer") return SHIP_ROLES;
  if (v === "company") return COMPANY_TYPES;
  if (v === "professional") return PROFESSIONAL_ROLES;
  return [];
}

/* ✅ Now we save role EXACTLY as selected (DB supports it) */
function getRoleForDB(){
  return (els.accountType?.value || "").trim(); // seafarer | company | professional
}

function getSelectedTitle(){
  const chosen = (els.rankValue?.value || "").trim();
  const typed = (els.rankSearch?.value || "").trim();
  const v = chosen || typed;

  if (v === "Other") return (els.rankOther?.value || "").trim();
  return v;
}

/* ---------------- Validation ---------------- */
function validate(){
  clearError();

  const acct = (els.accountType?.value || "").trim();
  const acctOk = !!acct;

  const nationalityOk = getNationality().length > 1;

  const title = getSelectedTitle();
  const titleOk = title.length > 1;
  const otherOk = title !== "Other" || ((els.rankOther?.value || "").trim().length > 1);

  const ok = acctOk && nationalityOk && titleOk && otherOk;

  if (els.saveBtn) els.saveBtn.disabled = !ok;
  return ok;
}

/* ---------------- Switch UI based on category ---------------- */
function syncAccountUI(){
  show(els.rankWrap);

  const v = (els.accountType?.value || "").trim();

  if (els.rankLabel) {
    if (v === "seafarer") els.rankLabel.innerHTML = `Ship role <span class="req">*</span>`;
    else if (v === "company") els.rankLabel.innerHTML = `Company / Institute type <span class="req">*</span>`;
    else if (v === "professional") els.rankLabel.innerHTML = `Professional role <span class="req">*</span>`;
    else els.rankLabel.innerHTML = `Role / Type <span class="req">*</span>`;
  }

  if (els.rankHelp) {
    if (v === "seafarer") els.rankHelp.textContent = "Choose your onboard ship role only.";
    else if (v === "company") els.rankHelp.textContent = "Choose what type of company/institute you are.";
    else if (v === "professional") els.rankHelp.textContent = "Choose your shore-side maritime role.";
    else els.rankHelp.textContent = "Type to search or scroll and choose.";
  }

  if (els.rankSearch) {
    if (v === "seafarer") els.rankSearch.placeholder = "Search ship role (e.g., Second Officer)";
    else if (v === "company") els.rankSearch.placeholder = "Search company/institute type";
    else if (v === "professional") els.rankSearch.placeholder = "Search professional role";
    else els.rankSearch.placeholder = "Search…";
  }

  // reset selection on category change
  els.rankSearch.value = "";
  els.rankValue.value = "";
  if (els.rankOther) els.rankOther.value = "";
  hide(els.rankOtherWrap);

  // rebuild list
  makeCombo({
    comboName: "rank",
    inputEl: els.rankSearch,
    listEl: els.rankList,
    items: getActiveList(),
    label: (r) => `<strong>${r}</strong>`,
    onPick: (r) => {
      els.rankSearch.value = r;
      els.rankValue.value = r;
      if (r === "Other") show(els.rankOtherWrap); else hide(els.rankOtherWrap);
      validate();
    }
  });

  validate();
}

/* ---------------- Save ---------------- */
async function saveProfile(){
  if (!validate()) {
    showError("Please complete required fields: Category, Nationality, and your Role/Type.");
    return;
  }

  els.saveBtn.disabled = true;
  els.saveBtn.textContent = "Saving…";

  const payload = {
    id: currentUser.id,
    full_name: (els.fullName?.value || "").trim() || null,
    role: getRoleForDB(),
    nationality: getNationality() || null,
    rank: getSelectedTitle() || null, // stored as position/type
    bio: (els.bio?.value || "").trim() || null,
    setup_complete: true,
    updated_at: new Date().toISOString()
  };

  const { error } = await supabase.from("profiles").upsert(payload, { onConflict: "id" });

  if (error) {
    showError(`Save failed: ${error.message || "Unknown error"}`);
    els.saveBtn.disabled = false;
    els.saveBtn.textContent = "Save & Continue";
    return;
  }

  window.location.href = ROUTES?.feed || "/feed/index.html";
}

/* ---------------- Init ---------------- */
document.addEventListener("DOMContentLoaded", async () => {
  const { data } = await supabase.auth.getUser();
  currentUser = data?.user;

  if (!currentUser) {
    window.location.href = "/auth/login.html";
    return;
  }

  await loadCountries();

  // Country combo
  makeCombo({
    comboName: "country",
    inputEl: els.countrySearch,
    listEl: els.countryList,
    items: countries.map(c => c.name),
    label: (name) => `<strong>${name}</strong>`,
    onPick: (name) => {
      els.countrySearch.value = name;
      els.countryValue.value = name;
      validate();
    }
  });

  // Dial combo (UI only)
  makeCombo({
    comboName: "dial",
    inputEl: els.dialSearch,
    listEl: els.dialList,
    items: countries.filter(c => c.dial_code).map(c => `${c.dial_code} — ${c.name}`),
    label: (row) => {
      const [code, ...rest] = row.split(" — ");
      return `<strong>${code}</strong> <span class="muted">— ${rest.join(" — ")}</span>`;
    },
    onPick: (row) => {
      const code = row.split(" — ")[0].trim();
      els.dialSearch.value = code;
      els.dialValue.value = code;
      validate();
    }
  });

  // Avatar preview (UI only for now)
  els.photoInput?.addEventListener("change", (e) => {
    const file = e.target.files?.[0] || null;
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
  });

  els.removePhotoBtn?.addEventListener("click", () => {
    if (els.photoInput) els.photoInput.value = "";
    if (els.avatarPreview) {
      els.avatarPreview.style.backgroundImage = "";
      els.avatarPreview.innerHTML = `<span class="avatarHint">Add photo</span>`;
    }
  });

  // validate while typing
  els.rankSearch?.addEventListener("input", validate);
  els.rankOther?.addEventListener("input", validate);
  els.countrySearch?.addEventListener("input", validate);
  els.fullName?.addEventListener("input", validate);
  els.bio?.addEventListener("input", validate);

  els.accountType?.addEventListener("change", syncAccountUI);

  els.form?.addEventListener("submit", (e) => { e.preventDefault(); saveProfile(); });
  els.saveBtn?.addEventListener("click", (e) => { e.preventDefault(); saveProfile(); });

  // initial
  syncAccountUI();
  validate();
});