// /setup/profile-setup.js
import { supabase } from "/js/supabase.js";

const $ = (id) => document.getElementById(id);

const state = {
  countries: [],
  ranks: [
    "Cadet",
    "Deck Cadet",
    "Third Officer",
    "Second Officer",
    "Chief Officer",
    "Master",
    "OS",
    "AB",
    "Bosun",
    "Trainee OS",
    "Engine Cadet",
    "Fourth Engineer",
    "Third Engineer",
    "Second Engineer",
    "Chief Engineer",
    "Motorman",
    "Fitter",
    "Cook",
    "Other"
  ],
  selectedCountry: null,
  selectedRank: null,
  avatarFile: null,
  avatarPreviewUrl: ""
};

function show(el) { el && el.classList.remove("hidden"); }
function hide(el) { el && el.classList.add("hidden"); }

function setError(msg) {
  const box = $("errorBox");
  if (!box) return;
  if (!msg) {
    box.style.display = "none";
    box.textContent = "";
    return;
  }
  box.style.display = "block";
  box.textContent = msg;
}

function isSeafarerType(val) {
  return val === "seafarer";
}

function normalizeAccountType() {
  const v = $("accountType")?.value || "";
  if (v === "other") {
    const other = ($("accountTypeOther")?.value || "").trim();
    return other ? other : "Other";
  }
  if (!v) return "";
  // capitalise first letter
  return v.charAt(0).toUpperCase() + v.slice(1);
}

function getRankValue() {
  // rankValue is hidden
  const raw = ($("rankValue")?.value || "").trim();
  if (raw === "Other") {
    const other = ($("rankOther")?.value || "").trim();
    return other ? other : "Other";
  }
  return raw;
}

function getNationalityValue() {
  // countryValue is hidden (we store country name)
  return ($("countryValue")?.value || "").trim();
}

function getPhoneValue() {
  const dial = ($("dialValue")?.value || "").trim();
  const num = ($("phoneInput")?.value || "").trim();
  if (!num) return "";
  if (dial && !num.startsWith("+")) return `${dial} ${num}`;
  return num;
}

function validateForm() {
  setError("");

  const acct = $("accountType")?.value || "";
  const acctOtherNeeded = acct === "other";
  const acctOtherOk = !acctOtherNeeded || (($("accountTypeOther")?.value || "").trim().length > 1);

  const nationality = getNationalityValue();
  const nationalityOk = nationality.length > 1;

  const seafarer = isSeafarerType(acct);
  const rankOk = !seafarer || getRankValue().length > 0;

  const rankOtherNeeded = seafarer && (getRankValue() === "Other");
  const rankOtherOk = !rankOtherNeeded || (($("rankOther")?.value || "").trim().length > 1);

  const ok = acct && acctOtherOk && nationalityOk && rankOk && rankOtherOk;

  const btn = $("saveBtn");
  if (btn) btn.disabled = !ok;

  return ok;
}

/* ---------- Combo helpers ---------- */
function renderComboList(listEl, items, onPick) {
  listEl.innerHTML = "";
  items.forEach((item) => {
    const div = document.createElement("div");
    div.className = "comboItem";
    div.textContent = item.label;
    div.addEventListener("click", () => onPick(item));
    listEl.appendChild(div);
  });
}

function filterItems(items, q) {
  const s = (q || "").toLowerCase().trim();
  if (!s) return items.slice(0, 80);
  return items.filter(it => it.label.toLowerCase().includes(s)).slice(0, 80);
}

/* ---------- Load countries.json ---------- */
async function loadCountries() {
  try {
    const res = await fetch("/data/countries.json", { cache: "no-store" });
    const json = await res.json();

    // Expecting array of objects; support common shapes
    // Example shapes:
    // { name, dial_code, code } OR { country, dialCode } etc.
    const countries = json.map((c) => {
      const name = c.name || c.country || c.country_name || c.Country || "";
      const dial = c.dial_code || c.dialCode || c.dial || c.calling_code || "";
      return {
        name: name,
        dial: dial,
        label: dial ? `${name} (${dial})` : name
      };
    }).filter(x => x.name);

    state.countries = countries;
  } catch (e) {
    console.warn("countries.json load failed", e);
    state.countries = [];
  }
}

/* ---------- Avatar preview ---------- */
function setAvatarPreview(file) {
  state.avatarFile = file || null;

  const preview = $("avatarPreview");
  if (!preview) return;

  if (!file) {
    preview.style.backgroundImage = "";
    preview.innerHTML = `<span class="avatarHint">Add photo</span>`;
    state.avatarPreviewUrl = "";
    return;
  }

  const url = URL.createObjectURL(file);
  state.avatarPreviewUrl = url;
  preview.innerHTML = "";
  preview.style.backgroundSize = "cover";
  preview.style.backgroundPosition = "center";
  preview.style.backgroundImage = `url("${url}")`;
}

/* ---------- Optional upload (safe: if fails, continue) ---------- */
async function tryUploadAvatar(userId) {
  if (!state.avatarFile) return "";

  // Try upload to bucket "avatars" (if bucket exists)
  // If bucket doesn’t exist, we simply skip without breaking.
  try {
    const ext = (state.avatarFile.name.split(".").pop() || "jpg").toLowerCase();
    const path = `${userId}/avatar.${ext}`;

    const { error: upErr } = await supabase.storage
      .from("avatars")
      .upload(path, state.avatarFile, { upsert: true });

    if (upErr) {
      console.warn("Avatar upload failed:", upErr);
      return "";
    }

    const { data } = supabase.storage.from("avatars").getPublicUrl(path);
    return data?.publicUrl || "";
  } catch (e) {
    console.warn("Avatar upload exception:", e);
    return "";
  }
}

/* ---------- Main ---------- */
document.addEventListener("DOMContentLoaded", async () => {
  // Require auth
  const { data } = await supabase.auth.getUser();
  const user = data?.user;
  if (!user) {
    window.location.href = "/auth/login.html";
    return;
  }

  // Load countries
  await loadCountries();

  // Setup Rank combo
  const rankItems = state.ranks.map(r => ({ label: r, value: r }));
  const rankList = $("rankList");
  const rankSearch = $("rankSearch");
  const rankValue = $("rankValue");

  function pickRank(item) {
    rankValue.value = item.value;
    rankSearch.value = item.value;
    $("rankList").style.display = "none";

    // show/hide rankOther
    if (item.value === "Other") show($("rankOtherWrap"));
    else hide($("rankOtherWrap"));

    validateForm();
  }

  if (rankSearch && rankList) {
    renderComboList(rankList, filterItems(rankItems, ""), pickRank);

    rankSearch.addEventListener("input", () => {
      renderComboList(rankList, filterItems(rankItems, rankSearch.value), pickRank);
      rankList.style.display = "block";
    });

    rankSearch.addEventListener("focus", () => {
      renderComboList(rankList, filterItems(rankItems, rankSearch.value), pickRank);
      rankList.style.display = "block";
    });
  }

  // Setup Country combo
  const countryList = $("countryList");
  const countrySearch = $("countrySearch");
  const countryValue = $("countryValue");

  const countryItems = state.countries.map(c => ({ label: c.label, value: c.name, dial: c.dial }));

  function pickCountry(item) {
    countryValue.value = item.value;
    countrySearch.value = item.value;
    $("countryList").style.display = "none";

    // Auto-fill dial code
    if (item.dial) {
      $("dialValue").value = item.dial;
      $("dialSearch").value = item.dial;
    }

    validateForm();
  }

  if (countrySearch && countryList) {
    renderComboList(countryList, filterItems(countryItems, ""), pickCountry);

    countrySearch.addEventListener("input", () => {
      renderComboList(countryList, filterItems(countryItems, countrySearch.value), pickCountry);
      countryList.style.display = "block";
    });

    countrySearch.addEventListener("focus", () => {
      renderComboList(countryList, filterItems(countryItems, countrySearch.value), pickCountry);
      countryList.style.display = "block";
    });
  }

  // Dial combo (simple: let user type, we don’t need a list)
  const dialSearch = $("dialSearch");
  const dialValue = $("dialValue");
  if (dialSearch && dialValue) {
    dialSearch.addEventListener("input", () => {
      dialValue.value = dialSearch.value.trim();
    });
  }

  // Account type show/hide logic
  const accountType = $("accountType");
  const otherWrap = $("accountTypeOtherWrap");
  const rankWrap = $("rankWrap");

  function syncAccountUI() {
    const v = accountType.value;

    // other text
    if (v === "other") show(otherWrap);
    else hide(otherWrap);

    // rank only for seafarer
    if (isSeafarerType(v)) show(rankWrap);
    else hide(rankWrap);

    validateForm();
  }

  accountType.addEventListener("change", syncAccountUI);
  $("accountTypeOther")?.addEventListener("input", validateForm);
  $("rankOther")?.addEventListener("input", validateForm);

  // Avatar input
  $("photoInput")?.addEventListener("change", (e) => {
    const file = e.target.files?.[0] || null;
    setAvatarPreview(file);
  });

  $("removePhotoBtn")?.addEventListener("click", () => {
    if ($("photoInput")) $("photoInput").value = "";
    setAvatarPreview(null);
  });

  // Close combo lists on outside click
  document.addEventListener("click", (e) => {
    const inRank = e.target.closest('[data-combo="rank"]');
    const inCountry = e.target.closest('[data-combo="country"]');
    if (!inRank && $("rankList")) $("rankList").style.display = "none";
    if (!inCountry && $("countryList")) $("countryList").style.display = "none";
  });

  // Prefill name if available
  if ($("fullName") && user.user_metadata?.full_name) {
    $("fullName").value = user.user_metadata.full_name;
  }

  syncAccountUI();
  validateForm();

  // Save
  $("setupForm")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!validateForm()) {
      setError("Please complete the required fields.");
      return;
    }

    setError("");

    $("saveBtn").disabled = true;
    $("saveBtn").textContent = "Saving…";

    const account_type = normalizeAccountType();
    const full_name = ($("fullName")?.value || "").trim();
    const dob = $("dob")?.value || null;
    const rank = getRankValue();
    const nationality = getNationalityValue();
    const phone = getPhoneValue();

    // Try upload avatar (safe)
    const avatar_url = await tryUploadAvatar(user.id);

    // Save into profiles
    const payload = {
      id: user.id,
      account_type,
      full_name,
      dob,
      rank: isSeafarerType($("accountType").value) ? rank : null,
      nationality,
      phone,
      avatar_url: avatar_url || null,
      setup_complete: true,
      updated_at: new Date().toISOString()
    };

    const { error } = await supabase.from("profiles").upsert(payload, { onConflict: "id" });

    if (error) {
      console.warn("profiles upsert error", error);
      setError("Save failed. Your Supabase profiles table is missing some columns.");
      $("saveBtn").disabled = false;
      $("saveBtn").textContent = "Save & Continue";
      return;
    }

    // Go to dashboard
    window.location.href = "/dashboard/index.html";
  });
});