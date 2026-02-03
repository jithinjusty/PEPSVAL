import { supabase } from "/js/supabase.js";

const $ = (id) => document.getElementById(id);

const els = {
  form: $("setupForm"),
  saveBtn: $("saveBtn"),
  errorBox: $("errorBox"),

  accountType: $("accountType"),
  accountTypeOtherWrap: $("accountTypeOtherWrap"),
  accountTypeOther: $("accountTypeOther"),

  fullName: $("fullName"),
  username: $("username"),
  email: $("email"),
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

  companyExtraSection: $("companyExtraSection"),
  secondaryPhone: $("secondaryPhone"),
  secondaryEmails: $("secondaryEmails"),
  services: $("services"),
  achievements: $("achievements"),
  vision: $("vision"),
  mission: $("mission"),
};

let currentUser = null;
let countries = [];
let avatarPath = null;

/* Seafarer ship roles only */
const RANKS = [
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
  "ETO / Electro-Technical Officer",
  "Electrician",
  "Cook / Messman",
  "Other"
];

/* Company / Institute and Maritime Professionals */
const ROLES = [
  "Crewing / Manning Company",
  "Ship Management Company",
  "Ship Owner / Operator",
  "Training Institute",
  "Maritime Academy / College",
  "Maritime Recruitment Agency",
  "Ship Chandling / Supplier",
  "Port / Terminal Company",
  "Classification Society",
  "Marine Insurance / P&I",
  "Shipyard / Repair",
  "Maritime Software / IT Company",
  "Logistics / Freight Forwarder",
  "Other",
  "Marine Superintendent",
  "Technical Superintendent",
  "Port Captain",
  "HSQE / QHSE Officer",
  "Marine Surveyor",
  "Auditor / Inspector",
  "DP / Simulator Instructor",
  "Crewing Manager",
  "Recruiter / Talent Acquisition",
  "Operations Manager",
  "Fleet Manager",
  "VTS Officer",
  "Port / Terminal Staff",
  "Immigration / Visa Agent",
  "Accounts / Finance",
  "IT / Product / Software",
  "Other"
];

function show(el) { el && el.classList.remove("hidden"); }
function hide(el) { el && el.classList.add("hidden"); }

function showList(listEl) {
  if (!listEl) return;
  listEl.classList.add("show");
  listEl.style.display = "block";
}
function hideList(listEl) {
  if (!listEl) return;
  listEl.classList.remove("show");
  listEl.style.display = "";
}

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

function isSeafarer() { return (els.accountType?.value || "") === "seafarer"; }
function isCompanyOrProfessional() {
  const v = els.accountType?.value || "";
  return v === "employer" || v === "shore" || v === "other";
}

function normalizeAccountType() {
  const v = els.accountType?.value || "";
  if (v === "other") {
    const other = (els.accountTypeOther?.value || "").trim();
    // For "other", we can return a custom label or just "other"
    // The profile page will treat it as "other" if it doesn't recognized it.
    return other ? other : "other";
  }
  return v; // returns seafarer, employer, or shore
}

function getRank() {
  const v = (els.rankValue?.value || "").trim();
  if (v === "Other") return (els.rankOther?.value || "").trim();
  return v;
}
function getRole() {
  const v = (els.roleValue?.value || "").trim();
  if (v === "Other") return (els.roleOther?.value || "").trim();
  return v;
}

function getNationality() { return (els.countryValue?.value || "").trim(); }

function getPhone() {
  const dial = (els.dialValue?.value || "").trim();
  const num = (els.phoneInput?.value || "").trim();
  if (!num) return "";
  if (dial && !num.startsWith("+")) return `${dial} ${num}`;
  return num;
}

function makeCombo({ comboName, inputEl, listEl, items, label, onPick }) {
  if (!inputEl || !listEl) return;
  const key = comboName;

  function render(list) {
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

  function filterNow() {
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
    if (!e.target.closest(`[data-combo="${key}"]`)) hideList(listEl);
  });

  render(items.slice(0, 120));
}

async function loadCountries() {
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

function setAvatarPreviewFromUrl(url) {
  if (!els.avatarPreview) return;
  els.avatarPreview.innerHTML = "";
  els.avatarPreview.style.backgroundSize = "cover";
  els.avatarPreview.style.backgroundPosition = "center";
  els.avatarPreview.style.backgroundImage = url ? `url("${url}")` : "";
  if (!url) els.avatarPreview.innerHTML = `<span class="avatarHint">Add photo</span>`;
}


/* ===================== EDITOR INTEGRATION ===================== */
let pendingBlob = null;

function openCropWithFile(file) {
  if (window.PepsvalEditor) {
    window.PepsvalEditor.open(file, (blob) => {
      pendingBlob = blob;
      const url = URL.createObjectURL(blob);
      setAvatarPreviewFromUrl(url);
      validate();
    });
  } else {
    // Fallback: just use file direct
    pendingBlob = file;
    setAvatarPreviewFromUrl(URL.createObjectURL(file));
    validate();
  }
}

/* ===================== VALIDATION + UI ===================== */
function validate() {
  clearError();

  const acct = els.accountType?.value || "";
  const acctOk = !!acct;
  const otherOk = acct !== "other" || ((els.accountTypeOther?.value || "").trim().length > 1);

  const nationalityOk = getNationality().length > 1;

  const rankOk = !isSeafarer() || getRank().length > 1;
  const rankOtherOk = !(isSeafarer() && (els.rankValue?.value === "Other")) || ((els.rankOther?.value || "").trim().length > 1);

  const roleOk = !isCompanyOrProfessional() || getRole().length > 1;
  const roleOtherOk = !(isCompanyOrProfessional() && (els.roleValue?.value === "Other")) || ((els.roleOther?.value || "").trim().length > 1);

  const username = (els.username?.value || "").trim().toLowerCase();
  const usernameOk = /^[a-z][a-z0-9._]{2,19}$/.test(username);

  const ok = acctOk && otherOk && nationalityOk && rankOk && rankOtherOk && roleOk && roleOtherOk && usernameOk;
  if (els.saveBtn) els.saveBtn.disabled = !ok;
  return ok;
}

function syncAccountUI() {
  const acct = els.accountType?.value || "";

  if (acct === "other") show(els.accountTypeOtherWrap);
  else hide(els.accountTypeOtherWrap);

  if (acct === "seafarer") show(els.rankWrap);
  else hide(els.rankWrap);

  if (acct === "employer" || acct === "shore" || acct === "other") {
    show(els.roleWrap);
    show(els.companyWrap);
    // Show extra section only for employers or based on user choice
    if (acct === "employer") {
      show(els.companyExtraSection);
    } else {
      hide(els.companyExtraSection);
    }
  } else {
    hide(els.roleWrap);
    hide(els.companyWrap);
    hide(els.companyExtraSection);
  }

  validate();
}

async function uploadAvatarIfAny() {
  if (!pendingBlob) return null;
  if (!currentUser?.id) return null;

  const path = `${currentUser.id}/avatar.webp`;

  const { error: upErr } = await supabase
    .storage
    .from("avatars")
    .upload(path, pendingBlob, { upsert: true, contentType: "image/webp" });

  if (upErr) throw upErr;

  avatarPath = path;
  return path;
}

async function saveProfile() {
  if (!validate()) {
    showError("Please complete the required fields (Account type, Nationality, Role).");
    return;
  }

  els.saveBtn.disabled = true;
  els.saveBtn.textContent = "Saving…";

  try {
    await uploadAvatarIfAny();

    const payload = {
      id: currentUser.id,
      account_type: normalizeAccountType(),
      username: (els.username?.value || "").trim().toLowerCase(),
      full_name: (els.fullName?.value || "").trim(),
      email: els.email?.value || currentUser.email,
      dob: els.dob?.value || null,

      rank: isSeafarer() ? getRank() : null,

      role: isCompanyOrProfessional() ? getRole() : null,
      company_name: isCompanyOrProfessional() ? (els.companyName?.value || "").trim() : null,

      nationality: getNationality(),
      phone: getPhone(),
      bio: (els.bio?.value || "").trim(),

      avatar_url: avatarPath,
      setup_complete: true,
      updated_at: new Date().toISOString(),

      // Extra Company Fields
      secondary_phones: isCompanyOrProfessional() ? (els.secondaryPhone?.value || "").trim() : null,
      secondary_emails: isCompanyOrProfessional() ? (els.secondaryEmails?.value || "").trim() : null,
      services: isCompanyOrProfessional() ? (els.services?.value || "").trim() : null,
      achievements: isCompanyOrProfessional() ? (els.achievements?.value || "").trim() : null,
      vision: isCompanyOrProfessional() ? (els.vision?.value || "").trim() : null,
      mission: isCompanyOrProfessional() ? (els.mission?.value || "").trim() : null
    };

    const { error } = await supabase.from("profiles").upsert(payload, { onConflict: "id" });
    if (error) throw error;

    window.location.href = "/feed/index.html";
  } catch (e) {
    console.error("SAVE ERROR:", e);
    showError(`Save failed: ${e.message || "Unknown error"}`);
    els.saveBtn.disabled = false;
    els.saveBtn.textContent = "Save & Continue";
  }
}

document.addEventListener("DOMContentLoaded", async () => {
  const { data } = await supabase.auth.getUser();
  currentUser = data?.user;

  if (!currentUser) {
    window.location.href = "/auth/login.html";
    return;
  }

  await loadCountries();

  if (els.email) els.email.value = currentUser.email || "";

  // Check if account type was set during signup
  const metaType = currentUser.user_metadata?.account_type;
  if (metaType && els.accountType) {
    els.accountType.value = metaType;
    els.accountType.disabled = true; // Lock it

    // Hide the container entirely so user doesn't even see the choice
    const s1 = document.getElementById("step1");
    if (s1) s1.style.display = "none";

    syncAccountUI(); // Show correct fields (Rank vs Role)
  }

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

  makeCombo({
    comboName: "country",
    inputEl: els.countrySearch,
    listEl: els.countryList,
    items: countries,
    label: (c) => `<strong>${c.name}</strong>`,
    onPick: (c) => {
      els.countrySearch.value = c.name;
      els.countryValue.value = c.name;
      if (c.dial_code) {
        els.dialSearch.value = c.dial_code;
        els.dialValue.value = c.dial_code;
      }
      validate();
    }
  });

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

  els.photoInput?.addEventListener("change", (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    openCropWithFile(file);
  });

  els.removePhotoBtn?.addEventListener("click", () => {
    pendingBlob = null;
    avatarPath = null;
    if (els.photoInput) els.photoInput.value = "";
    setAvatarPreviewFromUrl(null);
    validate();
  });

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
  els.username?.addEventListener("input", validate);
  els.fullName?.addEventListener("input", validate);
  els.dob?.addEventListener("change", validate);

  els.form?.addEventListener("submit", (e) => { e.preventDefault(); saveProfile(); });
  els.saveBtn?.addEventListener("click", (e) => { e.preventDefault(); saveProfile(); });

  syncAccountUI();
  validate();
});
