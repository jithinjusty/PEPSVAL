// /setup/profile-setup.js
import { supabase } from "/js/supabase.js";

const $ = (id) => document.getElementById(id);

const els = {
  form: $("setupForm"),
  errorBox: $("errorBox"),
  saveBtn: $("saveBtn"),

  photoInput: $("photoInput"),
  removePhotoBtn: $("removePhotoBtn"),
  avatarPreview: $("avatarPreview"),

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

  jobWrap: $("jobWrap"),
  jobTitle: $("jobTitle"),
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
};

let currentUser = null;
let countries = []; // {name, dial_code, code}

/* ----------------- Full maritime ranks (big list) ----------------- */
const RANKS = [
  // Deck (Merchant)
  "Master / Captain",
  "Chief Officer / C/O",
  "Second Officer / 2/O",
  "Third Officer / 3/O",
  "Deck Cadet",
  "AB / Able Seaman",
  "OS / Ordinary Seaman",
  "Bosun",
  "Chief Cook",
  "Cook",
  "Steward",
  "Trainee OS",
  "Trainee AB",

  // Engine (Merchant)
  "Chief Engineer",
  "Second Engineer",
  "Third Engineer",
  "Fourth Engineer",
  "Engine Cadet",
  "Motorman",
  "Oiler",
  "Fitter",
  "Wiper",

  // Electrical
  "ETO / Electro-Technical Officer",
  "Electrical Engineer",
  "Electrician",

  // Tanker / Special
  "Pumpman",
  "Gas Engineer / Cargo Engineer",

  // Offshore / OSV / AHTS
  "Master (OSV)",
  "Chief Mate (OSV)",
  "Mate (OSV)",
  "Engineer (OSV)",
  "AHTS Master",
  "PSV Master",
  "Crewboat Master",

  // Fishing / Passenger / Others
  "Chief Mate",
  "Second Mate",
  "Third Mate",
  "Safety Officer",
  "Trainer / Instructor",

  "Other"
];

/* ----------------- UI helpers ----------------- */
function show(el) { el && el.classList.remove("hidden"); }
function hide(el) { el && el.classList.add("hidden"); }

function showList(listEl) { listEl && listEl.classList.add("show"); }
function hideList(listEl) { listEl && listEl.classList.remove("show"); }

function showError(msg) {
  if (!els.errorBox) return;
  els.errorBox.style.display = "block";
  els.errorBox.textContent = msg || "Something went wrong.";
}
function clearError() {
  if (!els.errorBox) return;
  els.errorBox.style.display = "none";
  els.errorBox.textContent = "";
}

function isSeafarer() {
  return (els.accountType?.value || "") === "seafarer";
}
function isEmployerOrShore() {
  const v = els.accountType?.value || "";
  return v === "employer" || v === "shore";
}

function normalizeAccountType() {
  const v = els.accountType?.value || "";
  if (v === "other") {
    const other = (els.accountTypeOther?.value || "").trim();
    return other ? other : "Other";
  }
  if (!v) return "";
  return v.charAt(0).toUpperCase() + v.slice(1);
}

function getRank() {
  const v = (els.rankValue?.value || "").trim();
  if (v === "Other") {
    return (els.rankOther?.value || "").trim();
  }
  return v;
}

function getNationality() {
  return (els.countryValue?.value || "").trim();
}

function getPhone() {
  const dial = (els.dialValue?.value || "").trim();
  const num = (els.phoneInput?.value || "").trim();
  if (!num) return "";
  if (dial && !num.startsWith("+")) return `${dial} ${num}`;
  return num;
}

/* ----------------- Combo builder ----------------- */
function makeCombo({ inputEl, listEl, items, renderLabel, onPick }) {
  function draw(filtered) {
    listEl.innerHTML = "";

    if (!filtered.length) {
      const empty = document.createElement("div");
      empty.className = "comboEmpty";
      empty.textContent = "No results";
      listEl.appendChild(empty);
      return;
    }

    filtered.forEach((it) => {
      const row = document.createElement("div");
      row.className = "comboItem";
      row.innerHTML = renderLabel(it);
      row.addEventListener("click", () => {
        onPick(it);
        hideList(listEl);
      });
      listEl.appendChild(row);
    });
  }

  function filterNow() {
    const q = (inputEl.value || "").toLowerCase().trim();
    const filtered = !q
      ? items.slice(0, 120)
      : items.filter((it) => (renderLabel(it).replace(/<[^>]+>/g, "")).toLowerCase().includes(q)).slice(0, 120);

    draw(filtered);
    showList(listEl);
  }

  inputEl.addEventListener("focus", filterNow);
  inputEl.addEventListener("input", filterNow);

  document.addEventListener("click", (e) => {
    if (!e.target.closest(`[data-combo="${inputEl.closest(".combo")?.dataset.combo}"]`)) {
      hideList(listEl);
    }
  });

  // initial
  draw(items.slice(0, 120));
}

/* ----------------- Load countries ----------------- */
async function loadCountries() {
  const res = await fetch("/data/countries.json", { cache: "no-store" });
  const json = await res.json();
  countries = (json || []).filter(c => c?.name && c?.dial_code);
}

/* ----------------- Avatar preview (no upload now) ----------------- */
function setAvatarPreview(file) {
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

/* ----------------- Validation (controls Save button) ----------------- */
function validate() {
  clearError();

  const acct = els.accountType?.value || "";
  const acctOk = !!acct;

  const otherOk = acct !== "other" || ((els.accountTypeOther?.value || "").trim().length > 1);

  const nationalityOk = (getNationality().length > 1);

  const rankOk = !isSeafarer() || (getRank().length > 0);
  const rankOtherOk = !(isSeafarer() && (els.rankValue?.value === "Other")) || ((els.rankOther?.value || "").trim().length > 1);

  const jobOk = !isEmployerOrShore() || ((els.jobTitle?.value || "").trim().length > 1);

  const ok = acctOk && otherOk && nationalityOk && rankOk && rankOtherOk && jobOk;

  if (els.saveBtn) els.saveBtn.disabled = !ok;
  return ok;
}

/* ----------------- Account type UI switching ----------------- */
function syncAccountUI() {
  const acct = els.accountType?.value || "";

  // Other account type text
  if (acct === "other") show(els.accountTypeOtherWrap);
  else hide(els.accountTypeOtherWrap);

  // Seafarer ranks
  if (acct === "seafarer") show(els.rankWrap);
  else hide(els.rankWrap);

  // Employer / shore job fields
  if (acct === "employer" || acct === "shore") {
    show(els.jobWrap);
    show(els.companyWrap);
  } else {
    hide(els.jobWrap);
    hide(els.companyWrap);
  }

  validate();
}

/* ----------------- Save ----------------- */
async function saveProfile() {
  if (!validate()) {
    showError("Please complete the required fields.");
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
    nationality: getNationality(),
    phone: getPhone(),
    job_title: isEmployerOrShore() ? (els.jobTitle?.value || "").trim() : null,
    company_name: isEmployerOrShore() ? (els.companyName?.value || "").trim() : null,
    bio: (els.bio?.value || "").trim(),
    setup_complete: true,
    updated_at: new Date().toISOString()
  };

  const { error } = await supabase.from("profiles").upsert(payload, { onConflict: "id" });

  if (error) {
    console.warn(error);
    showError("Save failed. Your Supabase profiles table is missing some columns (job_title/company_name/bio/setup_complete).");
    els.saveBtn.disabled = false;
    els.saveBtn.textContent = "Save & Continue";
    return;
  }

  window.location.href = "/dashboard/index.html";
}

/* ----------------- Init ----------------- */
document.addEventListener("DOMContentLoaded", async () => {
  // Require login
  const { data } = await supabase.auth.getUser();
  currentUser = data?.user;

  if (!currentUser) {
    window.location.href = "/auth/login.html";
    return;
  }

  // Load countries list
  await loadCountries();

  // Rank combo
  makeCombo({
    inputEl: els.rankSearch,
    listEl: els.rankList,
    items: RANKS.map(r => ({ r })),
    renderLabel: (it) => `<strong>${it.r}</strong>`,
    onPick: (it) => {
      els.rankSearch.value = it.r;
      els.rankValue.value = it.r;
      if (it.r === "Other") show(els.rankOtherWrap);
      else hide(els.rankOtherWrap);
      validate();
    }
  });

  // Country combo (nationality)
  makeCombo({
    inputEl: els.countrySearch,
    listEl: els.countryList,
    items: countries.map(c => ({ c })),
    renderLabel: (it) => `<strong>${it.c.name}</strong>`,
    onPick: (it) => {
      els.countrySearch.value = it.c.name;
      els.countryValue.value = it.c.name;

      // Auto dial code
      els.dialSearch.value = it.c.dial_code;
      els.dialValue.value = it.c.dial_code;
      validate();
    }
  });

  // Dial combo (world dial codes)
  makeCombo({
    inputEl: els.dialSearch,
    listEl: els.dialList,
    items: countries.map(c => ({ c })),
    renderLabel: (it) => `<strong>${it.c.dial_code}</strong> <span class="muted">— ${it.c.name}</span>`,
    onPick: (it) => {
      els.dialSearch.value = it.c.dial_code;
      els.dialValue.value = it.c.dial_code;
      validate();
    }
  });

  // Avatar preview only
  els.photoInput?.addEventListener("change", (e) => {
    const file = e.target.files?.[0] || null;
    setAvatarPreview(file);
  });
  els.removePhotoBtn?.addEventListener("click", () => {
    if (els.photoInput) els.photoInput.value = "";
    setAvatarPreview(null);
  });

  // Account type logic
  els.accountType?.addEventListener("change", syncAccountUI);
  els.accountTypeOther?.addEventListener("input", validate);
  els.rankOther?.addEventListener("input", validate);
  els.jobTitle?.addEventListener("input", validate);
  els.companyName?.addEventListener("input", validate);
  els.phoneInput?.addEventListener("input", validate);
  els.bio?.addEventListener("input", validate);
  els.fullName?.addEventListener("input", validate);
  els.dob?.addEventListener("change", validate);

  // Save
  els.form?.addEventListener("submit", (e) => {
    e.preventDefault();
    clearError();
    saveProfile();
  });

  // initial UI
  syncAccountUI();
  validate();
});