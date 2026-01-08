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

  rankWrap: $("rankWrap"),
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

  // OPTIONAL: if your HTML has DOB input, keep id="dob"
  dob: $("dob"),
};

// ---------- UI Helpers ----------
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

function setBtnEnabled(ok) {
  if (!els.saveBtn) return;
  els.saveBtn.disabled = !ok;
  els.saveBtn.style.opacity = ok ? "1" : "0.65";
}

function requiredOk() {
  // IMPORTANT: Photo & Phone are NOT mandatory now ✅
  // Mandatory: accountType, nationality (countryValue)
  const accountOk = !!els.accountType?.value;

  const nationalityOk = !!els.countryValue?.value;

  // If account type is "other", require accountTypeOther text
  const otherOk =
    els.accountType?.value !== "other" ||
    (els.accountTypeOther?.value || "").trim().length > 1;

  // If seafarer selected, show rank and require it
  const isSeafarer = els.accountType?.value === "seafarer";
  const rankOk = !isSeafarer || !!els.rankValue?.value;
  const rankOtherOk =
    !isSeafarer ||
    els.rankValue?.value !== "__other__" ||
    (els.rankOther?.value || "").trim().length > 1;

  return accountOk && nationalityOk && otherOk && rankOk && rankOtherOk;
}

function wireValidation() {
  const inputs = [
    els.accountType,
    els.accountTypeOther,
    els.fullName,
    els.rankSearch,
    els.rankOther,
    els.countrySearch,
    els.dialSearch,
    els.phoneInput,
    els.dob,
  ].filter(Boolean);

  inputs.forEach((el) => {
    el.addEventListener("input", () => setBtnEnabled(requiredOk()));
    el.addEventListener("change", () => setBtnEnabled(requiredOk()));
  });

  setBtnEnabled(requiredOk());
}

// ---------- Combo (search dropdown) ----------
function makeCombo({ input, hidden, list, items, render, onPick }) {
  let open = false;
  let filtered = items.slice();

  function close() {
    open = false;
    if (list) list.style.display = "none";
  }
  function openList() {
    open = true;
    if (list) list.style.display = "block";
  }

  function draw() {
    if (!list) return;
    list.innerHTML = "";
    filtered.slice(0, 120).forEach((item) => {
      const div = document.createElement("div");
      div.className = "comboItem";
      div.textContent = render(item);
      div.addEventListener("click", () => {
        const label = render(item);
        input.value = label;
        hidden.value = item.value;
        close();
        onPick?.(item);
        setBtnEnabled(requiredOk());
      });
      list.appendChild(div);
    });
  }

  function filterNow() {
    const q = (input.value || "").trim().toLowerCase();
    if (!q) {
      filtered = items.slice();
    } else {
      filtered = items.filter((it) => render(it).toLowerCase().includes(q));
    }
    draw();
    openList();
  }

  input.addEventListener("focus", () => filterNow());
  input.addEventListener("input", () => filterNow());

  document.addEventListener("click", (e) => {
    if (!list || !input) return;
    const box = input.closest(".combo");
    if (!box) return;
    if (!box.contains(e.target)) close();
  });

  // initial
  if (list) list.style.display = "none";
  draw();

  return { close, filterNow };
}

// ---------- Data loading ----------
async function loadJSON(path) {
  const res = await fetch(path, { cache: "no-store" });
  if (!res.ok) throw new Error(`Failed to load ${path}`);
  return res.json();
}

let countries = [];
let ranks = [];

function buildRankList() {
  // fallback ranks (includes offshore / drill / OSV)
  const fallback = [
    "Master / Captain",
    "Chief Officer / C/O",
    "Second Officer / 2/O",
    "Third Officer / 3/O",
    "Chief Engineer",
    "Second Engineer",
    "Third Engineer",
    "Fourth Engineer",
    "ETO / Electro-Technical Officer",
    "Electrical Engineer",
    "Bosun",
    "AB / Able Seaman",
    "OS / Ordinary Seaman",
    "Pumpman",
    "Fitter",
    "Oiler",
    "Motorman",
    "Cook",
    "Steward",

    // Offshore / Oil & Gas
    "Offshore Installation Manager (OIM)",
    "Barge Master",
    "Toolpusher",
    "Driller",
    "Assistant Driller",
    "Chief Mate (Offshore)",
    "DPO / Dynamic Positioning Operator",
    "Senior DPO",
    "SDPO",
    "Crane Operator (Offshore)",
    "Roustabout",
    "Rigger",
    "Wireline Operator",
    "Mud Engineer",
    "Subsea Engineer",
    "ROV Pilot / Technician",
    "HSE Officer",
    "Safety Officer",
    "Ballast Control Operator",
    "Marine Controller",
    "Client Rep",
    "Medic / Offshore Medic",

    // OSV / AHTS
    "Master (OSV)",
    "Chief Mate (OSV)",
    "Mate (OSV)",
    "Engineer (OSV)",
    "AHTS Master",
    "PSV Master",
    "Crewboat Master",

    // Training
    "Cadet / Trainee Officer",
    "Deck Cadet",
    "Engine Cadet",
    "Intern / Trainee",
  ];

  return fallback.map((r) => ({ label: r, value: r }));
}

async function loadData() {
  // countries.json already committed by you ✅
  countries = await loadJSON("/data/countries.json");

  // optional ranks file (if you create later)
  try {
    const r = await loadJSON("/data/ranks.json");
    ranks = (Array.isArray(r) ? r : []).map((x) => ({
      label: typeof x === "string" ? x : x.label,
      value: typeof x === "string" ? x : x.value,
    }));
  } catch {
    ranks = buildRankList();
  }
}

// ---------- Auth / Profile ----------
async function requireUser() {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data?.user) {
    // If not logged in, go back to login
    window.location.href = "/auth/login.html";
    return null;
  }
  return data.user;
}

function setAvatarPreviewFromUrl(url) {
  if (!els.avatarPreview) return;
  els.avatarPreview.innerHTML = "";
  if (!url) {
    const hint = document.createElement("span");
    hint.className = "avatarHint";
    hint.textContent = "Add photo";
    els.avatarPreview.appendChild(hint);
    els.avatarPreview.style.backgroundImage = "";
    return;
  }
  els.avatarPreview.style.backgroundImage = `url("${url}")`;
  els.avatarPreview.style.backgroundSize = "cover";
  els.avatarPreview.style.backgroundPosition = "center";
}

function setAvatarPreviewFromFile(file) {
  const url = URL.createObjectURL(file);
  setAvatarPreviewFromUrl(url);
}

async function loadExistingProfile(userId) {
  // read what exists and pre-fill inputs
  const { data, error } = await supabase
    .from("profiles")
    .select(
      "full_name, account_type, account_type_other, rank, rank_other, nationality, dial_code, phone, dob, avatar_url"
    )
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    // no crash, just show
    showError("Could not load profile. You can still save again.");
    return;
  }
  if (!data) return;

  if (els.fullName) els.fullName.value = data.full_name || "";
  if (els.accountType && data.account_type) els.accountType.value = data.account_type;
  if (els.accountTypeOther) els.accountTypeOther.value = data.account_type_other || "";

  // rank only for seafarer
  if (data.account_type === "seafarer") {
    if (els.rankWrap) els.rankWrap.classList.remove("hidden");

    if (data.rank) {
      els.rankValue.value = data.rank;
      els.rankSearch.value = data.rank;
    }
    if (data.rank_other) {
      if (els.rankOtherWrap) els.rankOtherWrap.classList.remove("hidden");
      els.rankOther.value = data.rank_other;
    }
  }

  // nationality
  if (data.nationality) {
    els.countryValue.value = data.nationality;
    els.countrySearch.value = data.nationality;
  }

  // dial code (IMPORTANT: keep saved, don’t reset to +91)
  if (data.dial_code) {
    els.dialValue.value = data.dial_code;
    els.dialSearch.value = data.dial_code;
  }

  if (data.phone && els.phoneInput) els.phoneInput.value = data.phone;

  if (els.dob && data.dob) els.dob.value = data.dob;

  // avatar
  if (data.avatar_url) setAvatarPreviewFromUrl(data.avatar_url);

  // show/hide other account type
  toggleAccountTypeUI();
  setBtnEnabled(requiredOk());
}

function toggleAccountTypeUI() {
  const t = els.accountType?.value || "";
  const isOther = t === "other";
  const isSeafarer = t === "seafarer";

  if (els.accountTypeOtherWrap) {
    els.accountTypeOtherWrap.classList.toggle("hidden", !isOther);
  }

  if (els.rankWrap) {
    els.rankWrap.classList.toggle("hidden", !isSeafarer);
  }

  // if not seafarer clear rank values
  if (!isSeafarer) {
    if (els.rankSearch) els.rankSearch.value = "";
    if (els.rankValue) els.rankValue.value = "";
    if (els.rankOther) els.rankOther.value = "";
    if (els.rankOtherWrap) els.rankOtherWrap.classList.add("hidden");
  }
}

// ---------- Avatar upload ----------
async function uploadAvatar(userId, file) {
  if (!file) return null;

  // bucket name we use: "avatars"
  const bucket = "avatars";

  const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
  const path = `${userId}/avatar.${ext}`;

  // upload
  const { error: upErr } = await supabase.storage
    .from(bucket)
    .upload(path, file, { upsert: true, contentType: file.type });

  if (upErr) {
    // Don’t block saving other fields
    console.warn("Avatar upload failed:", upErr.message);
    return null;
  }

  // public url
  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return data?.publicUrl || null;
}

// ---------- Save ----------
async function saveProfile(user) {
  clearError();

  const accountType = els.accountType?.value || "";
  const accountTypeOther = (els.accountTypeOther?.value || "").trim();

  const fullName = (els.fullName?.value || "").trim();

  const isSeafarer = accountType === "seafarer";
  const rank = isSeafarer ? (els.rankValue?.value || "") : null;
  const rankOther =
    isSeafarer && rank === "__other__" ? (els.rankOther?.value || "").trim() : null;

  const nationality = (els.countryValue?.value || "").trim();

  const dialCode = (els.dialValue?.value || "").trim() || null;
  const phone = (els.phoneInput?.value || "").trim() || null;

  const dob = els.dob ? (els.dob.value || null) : null;

  // OPTIONAL avatar
  const file = els.photoInput?.files?.[0] || null;
  let avatarUrl = null;
  try {
    avatarUrl = await uploadAvatar(user.id, file);
    if (avatarUrl) setAvatarPreviewFromUrl(avatarUrl);
  } catch (e) {
    console.warn(e);
  }

  // save (ONLY columns that are safe / known)
  const payload = {
    id: user.id,
    full_name: fullName || null,
    account_type: accountType,
    account_type_other: accountType === "other" ? accountTypeOther : null,
    rank: isSeafarer ? rank : null,
    rank_other: rankOther || null,
    nationality: nationality || null,
    dial_code: dialCode,
    phone: phone,
    dob: dob,
  };

  if (avatarUrl) payload.avatar_url = avatarUrl;

  const { error } = await supabase.from("profiles").upsert(payload, { onConflict: "id" });

  if (error) {
    showError(`Database error saving profile: ${error.message}`);
    return false;
  }

  return true;
}

// ---------- Boot ----------
async function main() {
  try {
    await loadData();
    const user = await requireUser();
    if (!user) return;

    // UI events
    if (els.accountType) {
      els.accountType.addEventListener("change", () => {
        toggleAccountTypeUI();
        setBtnEnabled(requiredOk());
      });
    }

    // Photo
    if (els.photoInput) {
      els.photoInput.addEventListener("change", () => {
        const file = els.photoInput.files?.[0];
        if (file) setAvatarPreviewFromFile(file);
      });
    }
    if (els.removePhotoBtn) {
      els.removePhotoBtn.addEventListener("click", () => {
        if (els.photoInput) els.photoInput.value = "";
        setAvatarPreviewFromUrl("");
      });
    }

    // Rank combo
    const rankItems = [
      ...ranks.map((r) => ({ label: r.label, value: r.value })),
      { label: "Other (write manually)", value: "__other__" },
    ];
    makeCombo({
      input: els.rankSearch,
      hidden: els.rankValue,
      list: els.rankList,
      items: rankItems,
      render: (x) => x.label,
      onPick: (x) => {
        if (x.value === "__other__") {
          els.rankOtherWrap?.classList.remove("hidden");
          els.rankOther?.focus();
        } else {
          els.rankOtherWrap?.classList.add("hidden");
          if (els.rankOther) els.rankOther.value = "";
        }
      },
    });

    // Country combo (Nationality)
    const countryItems = countries.map((c) => ({
      label: c.name,
      value: c.name,
      dial: (c.dial_code || "").replace(/\s+/g, ""),
    }));

    makeCombo({
      input: els.countrySearch,
      hidden: els.countryValue,
      list: els.countryList,
      items: countryItems,
      render: (x) => x.label,
      onPick: (x) => {
        // auto-fill dial code ONLY if user hasn't chosen one yet
        // and always keep saved value when profile loads
        if (!els.dialValue.value && x.dial) {
          els.dialValue.value = x.dial;
          els.dialSearch.value = x.dial;
        }
      },
    });

    // Dial combo
    const dialItems = countries
      .map((c) => (c.dial_code || "").replace(/\s+/g, ""))
      .filter(Boolean)
      .map((d) => ({ label: d, value: d }));

    // unique
    const seen = new Set();
    const uniqueDialItems = dialItems.filter((x) => {
      if (seen.has(x.value)) return false;
      seen.add(x.value);
      return true;
    });

    makeCombo({
      input: els.dialSearch,
      hidden: els.dialValue,
      list: els.dialList,
      items: uniqueDialItems,
      render: (x) => x.label,
      onPick: () => {},
    });

    // Load existing profile to keep dial code + avatar on refresh ✅
    await loadExistingProfile(user.id);

    // Validation
    wireValidation();

    // Submit
    els.form?.addEventListener("submit", async (e) => {
      e.preventDefault();
      clearError();
      if (!requiredOk()) {
        showError("Please complete the required fields.");
        return;
      }

      els.saveBtn.disabled = true;
      els.saveBtn.textContent = "Saving...";

      const ok = await saveProfile(user);

      els.saveBtn.disabled = false;
      els.saveBtn.textContent = "Save & Continue";

      if (!ok) return;

      // go to dashboard folder ✅
      window.location.href = "/dashboard/";
    });
  } catch (e) {
    console.error(e);
    showError(e?.message || "Something went wrong loading setup.");
  }
}

main();