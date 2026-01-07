import { supabase } from "../js/supabase.js";

const RANKS = [
  "Master / Captain",
  "Chief Officer / Chief Mate (C/O)",
  "Second Officer / Second Mate (2/O)",
  "Third Officer / Third Mate (3/O)",
  "Deck Cadet / Trainee OOW",
  "Boatswain (Bosun)",
  "Able Seaman (AB)",
  "Ordinary Seaman (OS)",
  "Chief Engineer",
  "Second Engineer",
  "Third Engineer",
  "Fourth Engineer",
  "Trainee Marine Engineer (TME) / Engine Cadet",
  "Motorman",
  "Oiler",
  "Wiper",
  "Electro-Technical Officer (ETO)",
  "Chief Cook",
  "Cook",
  "Messman",
  "Steward",
  "DPO (Dynamic Positioning Operator)",
  "Pumpman",
  "Other (write)"
];

let COUNTRIES = [];

document.addEventListener("DOMContentLoaded", async () => {
  const form = document.getElementById("setupForm");

  const accountType = document.getElementById("accountType");
  const accountTypeOtherWrap = document.getElementById("accountTypeOtherWrap");
  const accountTypeOther = document.getElementById("accountTypeOther");

  const fullName = document.getElementById("fullName");

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
  const avatarPreview = document.getElementById("avatarPreview");
  const removePhotoBtn = document.getElementById("removePhotoBtn");

  const errorBox = document.getElementById("errorBox");
  const saveBtn = document.getElementById("saveBtn");

  const showError = (msg) => {
    errorBox.textContent = msg;
    errorBox.style.display = "block";
  };
  const clearError = () => {
    errorBox.textContent = "";
    errorBox.style.display = "none";
  };

  // Must be logged in
  const { data: sessionData, error: sessionErr } = await supabase.auth.getSession();
  const session = sessionData?.session;

  if (sessionErr || !session) {
    window.location.href = "/auth/login.html";
    return;
  }

  // Load countries json
  try {
    const res = await fetch("/data/countries.json", { cache: "no-store" });
    COUNTRIES = await res.json();
  } catch {
    COUNTRIES = [];
  }

  // Combos
  const rankCombo = makeCombo({
    input: rankSearch,
    valueEl: rankValue,
    listEl: rankList,
    items: RANKS.map(r => ({ label: r, value: r }))
  });

  const countryCombo = makeCombo({
    input: countrySearch,
    valueEl: countryValue,
    listEl: countryList,
    items: COUNTRIES.map(c => ({ label: cleanName(c.name), value: cleanName(c.name) }))
  });

  const dialCombo = makeCombo({
    input: dialSearch,
    valueEl: dialValue,
    listEl: dialList,
    items: COUNTRIES
      .filter(c => c.dial_code)
      .map(c => ({ label: cleanDial(c.dial_code), value: cleanDial(c.dial_code), sub: cleanName(c.name) }))
  });

  // auto dial from country
  countryCombo.onSelect = (countryName) => {
    const match = COUNTRIES.find(c => cleanName(c.name).toLowerCase() === String(countryName).toLowerCase());
    if (match?.dial_code) dialCombo.setValue(cleanDial(match.dial_code));
    validate();
  };

  // account type changes
  accountType.addEventListener("change", () => {
    const type = accountType.value;

    accountTypeOtherWrap.classList.toggle("hidden", type !== "other");
    if (type !== "other") accountTypeOther.value = "";

    rankWrap.classList.toggle("hidden", type !== "seafarer");
    if (type !== "seafarer") {
      rankCombo.setValue("");
      rankOtherWrap.classList.add("hidden");
      rankOther.value = "";
    }

    validate();
  });

  // rank other field
  rankCombo.onSelect = (val) => {
    const isOther = String(val).toLowerCase().includes("other");
    rankOtherWrap.classList.toggle("hidden", !isOther);
    if (!isOther) rankOther.value = "";
    validate();
  };

  // Profile photo
  let avatarFile = null;
  let avatarPreviewUrl = "";

  photoInput.addEventListener("change", async () => {
    clearError();
    const file = photoInput.files?.[0];
    avatarFile = file || null;

    if (!file) {
      avatarPreviewUrl = "";
      renderAvatar("");
      validate();
      return;
    }

    avatarPreviewUrl = await fileToDataUrl(file);
    renderAvatar(avatarPreviewUrl);
    validate();
  });

  removePhotoBtn.addEventListener("click", () => {
    photoInput.value = "";
    avatarFile = null;
    avatarPreviewUrl = "";
    renderAvatar("");
    validate();
  });

  function renderAvatar(dataUrl) {
    avatarPreview.innerHTML = "";
    if (!dataUrl) {
      const span = document.createElement("span");
      span.className = "avatarHint";
      span.textContent = "Add photo";
      avatarPreview.appendChild(span);
      return;
    }
    const img = document.createElement("img");
    img.src = dataUrl;
    img.alt = "Profile photo";
    avatarPreview.appendChild(img);
  }

  // validate on input
  [accountTypeOther, fullName, phoneInput, rankOther].forEach(el => el.addEventListener("input", validate));
  [rankSearch, countrySearch, dialSearch].forEach(el => el.addEventListener("input", validate));

  function validate() {
    clearError();

    const type = accountType.value;
    const dial = cleanDial(dialCombo.getValue() || dialSearch.value);
    const phone = (phoneInput.value || "").trim();
    const nationality = (countryCombo.getValue() || countrySearch.value || "").trim();
    const hasPhoto = !!avatarFile;

    // Your rule: cannot save without profile photo + mobile number
    if (!hasPhoto || !dial || !phone) { saveBtn.disabled = true; return; }

    // also need account type + nationality
    if (!type || !nationality) { saveBtn.disabled = true; return; }

    if (type === "other" && !(accountTypeOther.value || "").trim()) { saveBtn.disabled = true; return; }

    if (type === "seafarer") {
      const rank = (rankCombo.getValue() || rankSearch.value || "").trim();
      if (!rank) { saveBtn.disabled = true; return; }

      const isOther = rank.toLowerCase().includes("other");
      if (isOther && !(rankOther.value || "").trim()) { saveBtn.disabled = true; return; }
    }

    saveBtn.disabled = false;
  }

  validate();

  // SUBMIT
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    clearError();

    if (saveBtn.disabled) {
      showError("Please complete the required fields (*).");
      return;
    }

    saveBtn.disabled = true;
    saveBtn.textContent = "Saving…";

    try {
      const userId = session.user.id;

      // build values
      const type = accountType.value;

      let accountTypeLabel = type;
      if (type === "other") accountTypeLabel = (accountTypeOther.value || "").trim();

      const nationality = (countryCombo.getValue() || countrySearch.value || "").trim();

      let finalRank = null;
      if (type === "seafarer") {
        const r = (rankCombo.getValue() || rankSearch.value || "").trim();
        const isOther = r.toLowerCase().includes("other");
        finalRank = isOther ? (rankOther.value || "").trim() : r;
      }

      const dial = cleanDial(dialCombo.getValue() || dialSearch.value || "");
      const phone = (phoneInput.value || "").trim();

      // Upload avatar to Supabase Storage (bucket: avatars)
      // If bucket not present, we fallback to saving base64 preview (still works)
      let avatarUrl = null;

      if (avatarFile) {
        const fileExt = (avatarFile.name.split(".").pop() || "jpg").toLowerCase();
        const filePath = `${userId}/${Date.now()}.${fileExt}`;

        const { data: up, error: upErr } = await supabase.storage
          .from("avatars")
          .upload(filePath, avatarFile, { upsert: true });

        if (!upErr && up?.path) {
          const { data: pub } = supabase.storage.from("avatars").getPublicUrl(up.path);
          avatarUrl = pub?.publicUrl || null;
        } else {
          // fallback
          avatarUrl = avatarPreviewUrl || null;
        }
      }

      const payload = {
        id: userId,
        email: session.user.email,
        full_name: (fullName.value || "").trim(),
        account_type: type,
        account_type_label: accountTypeLabel,
        rank: finalRank,
        nationality,
        phone_country_code: dial,
        phone_number: phone,
        avatar_url: avatarUrl,
        setup_complete: true,
        updated_at: new Date().toISOString()
      };

      const { error } = await supabase.from("profiles").upsert(payload, { onConflict: "id" });
      if (error) throw new Error(error.message || "Could not save profile.");

      window.location.href = "/dashboard.html";
    } catch (err) {
      showError(err?.message || "Something went wrong. Please try again.");
      saveBtn.disabled = false;
      saveBtn.textContent = "Save & Continue";
    }
  });
});

/* ---------- combo helper ---------- */
function makeCombo({ input, valueEl, listEl, items }) {
  const wrapper = input.closest(".combo");

  const api = {
    onSelect: null,
    setValue(v) {
      const val = String(v || "");
      input.value = val;
      valueEl.value = val;
    },
    getValue() {
      return valueEl.value;
    }
  };

  function open() {
    wrapper.classList.add("open");
    render();
  }
  function close() {
    wrapper.classList.remove("open");
  }

  function render() {
    const q = (input.value || "").trim().toLowerCase();
    const filtered = !q ? items : items.filter(it =>
      String(it.label).toLowerCase().includes(q) ||
      String(it.value).toLowerCase().includes(q) ||
      String(it.sub || "").toLowerCase().includes(q)
    );

    listEl.innerHTML = filtered.slice(0, 250).map(it => {
      const sub = it.sub ? `<small>${escapeHtml(it.sub)}</small>` : "";
      return `<div class="comboItem" data-value="${escapeHtml(it.value)}">${escapeHtml(it.label)}${sub}</div>`;
    }).join("") || `<div class="comboItem" data-value="">No results</div>`;
  }

  input.addEventListener("focus", open);
  input.addEventListener("click", open);
  input.addEventListener("input", () => {
    valueEl.value = "";
    open();
  });

  listEl.addEventListener("click", (e) => {
    const item = e.target.closest(".comboItem");
    if (!item) return;
    const val = item.getAttribute("data-value") || "";
    api.setValue(val);
    close();
    api.onSelect && api.onSelect(val);
  });

  document.addEventListener("click", (e) => {
    if (!wrapper.contains(e.target)) close();
  });

  return api;
}

/* ---------- utils ---------- */
function cleanDial(v) { return String(v || "").replace(/\s+/g, ""); }
function cleanName(v) { return String(v || "").trim().replace(/([a-z])([A-Z])/g, "$1 $2"); }
function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (m) => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"
  }[m]));
}

function fileToDataUrl(file){
  return new Promise((resolve) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result || ""));
    r.readAsDataURL(file);
  });
}