import { supabase } from "../js/supabase.js";

const RANKS = [
  "Master / Captain",
  "Chief Officer / Chief Mate (C/O)",
  "Second Officer / Second Mate (2/O)",
  "Third Officer / Third Mate (3/O)",
  "Junior Officer / 4th Officer (if applicable)",
  "Deck Cadet / Trainee OOW",
  "Boatswain (Bosun)",
  "Able Seaman (AB)",
  "Ordinary Seaman (OS)",
  "Deck Fitter",
  "Trainee OS",
  "Chief Engineer",
  "Second Engineer",
  "Third Engineer",
  "Fourth Engineer",
  "Junior Engineer / 5th Engineer (if applicable)",
  "Trainee Marine Engineer (TME) / Engine Cadet",
  "Motorman",
  "Oiler",
  "Wiper",
  "Engine Fitter",
  "Electro-Technical Officer (ETO)",
  "Electrician",
  "Electrical Cadet / Trainee",
  "Chief Cook",
  "Cook",
  "Messman",
  "Steward",
  "Chief Steward",
  "DPO (Dynamic Positioning Operator)",
  "Rigger",
  "Crane Operator",
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

  // Require login
  const { data: sessionData } = await supabase.auth.getSession();
  const session = sessionData?.session;
  if (!session) {
    window.location.href = "/auth/login.html";
    return;
  }

  let avatarDataUrl = "";

  const showError = (msg) => {
    errorBox.textContent = msg;
    errorBox.style.display = "block";
  };
  const clearError = () => {
    errorBox.textContent = "";
    errorBox.style.display = "none";
  };

  // Load countries
  try {
    const res = await fetch("/data/countries.json", { cache: "no-store" });
    COUNTRIES = await res.json();
  } catch {
    COUNTRIES = [];
  }

  // Build dropdowns
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

  // Auto-fill dial code when country selected
  countryCombo.onSelect = (countryName) => {
    const match = COUNTRIES.find(c => cleanName(c.name).toLowerCase() === String(countryName).toLowerCase());
    if (match?.dial_code) dialCombo.setValue(cleanDial(match.dial_code));
    validate();
  };

  // Account type rules
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

  // Rank other rules
  rankCombo.onSelect = (val) => {
    const isOther = String(val).toLowerCase().includes("other");
    rankOtherWrap.classList.toggle("hidden", !isOther);
    if (!isOther) rankOther.value = "";
    validate();
  };

  // Photo required
  photoInput.addEventListener("change", async () => {
    clearError();
    const file = photoInput.files?.[0];
    if (!file) {
      avatarDataUrl = "";
      renderAvatar("");
      validate();
      return;
    }
    avatarDataUrl = await compressImageToDataUrl(file, 360, 0.82);
    renderAvatar(avatarDataUrl);
    validate();
  });

  removePhotoBtn.addEventListener("click", () => {
    photoInput.value = "";
    avatarDataUrl = "";
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

  // Validate when typing
  [accountTypeOther, fullName, phoneInput, rankOther].forEach(el => el.addEventListener("input", validate));
  rankSearch.addEventListener("input", validate);
  countrySearch.addEventListener("input", validate);
  dialSearch.addEventListener("input", validate);

  function validate() {
    clearError();

    const type = accountType.value;

    const hasPhoto = !!avatarDataUrl;
    const dial = cleanDial(dialCombo.getValue() || dialSearch.value);
    const phone = (phoneInput.value || "").trim();

    const nationality = (countryCombo.getValue() || countrySearch.value || "").trim();

    // Your rule: cannot save without profile photo + mobile number
    if (!hasPhoto || !dial || !phone) { saveBtn.disabled = true; return; }

    // also require account type + nationality
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

  // Save
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    clearError();

    if (saveBtn.disabled) return showError("Please complete the required fields (*).");

    const type = accountType.value;

    let accountTypeLabel = type;
    if (type === "other") accountTypeLabel = (accountTypeOther.value || "").trim();

    const nationality = (countryCombo.getValue() || countrySearch.value || "").trim();

    let finalRank = null;
    if (type === "seafarer") {
      const r = (rankCombo.getValue() || rankSearch.value || "").trim();
      const isOther = r.toLowerCase().includes("other");
      finalRank = isOther ? (rankOther.value || "").trim() : r;
      if (!finalRank) return showError("Please choose your rank.");
    }

    const dial = cleanDial(dialCombo.getValue() || dialSearch.value || "");
    const phone = (phoneInput.value || "").trim();

    const payload = {
      id: session.user.id,
      email: session.user.email,
      full_name: (fullName.value || "").trim(),
      account_type: type,
      account_type_label: accountTypeLabel,
      rank: finalRank,
      nationality,
      phone_country_code: dial,
      phone_number: phone,
      avatar_url: avatarDataUrl || null,
      setup_complete: true,
      updated_at: new Date().toISOString()
    };

    const { error } = await supabase.from("profiles").upsert(payload, { onConflict: "id" });
    if (error) return showError(error.message || "Could not save profile.");

    window.location.href = "/dashboard.html";
  });
});

/* ---------- combo helper ---------- */
function makeCombo({ input, valueEl, listEl, items }) {
  const wrapper = input.closest(".combo");
  let filtered = items.slice();

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
    filtered = !q
      ? items
      : items.filter(it => String(it.label).toLowerCase().includes(q) || String(it.value).toLowerCase().includes(q));

    listEl.innerHTML = filtered.slice(0, 200).map(it => {
      const sub = it.sub ? `<small>${escapeHtml(it.sub)}</small>` : "";
      return `<div class="comboItem" data-value="${escapeHtml(it.value)}">${escapeHtml(it.label)}${sub}</div>`;
    }).join("") || `<div class="comboItem" data-value="">No results</div>`;
  }

  input.addEventListener("focus", open);
  input.addEventListener("click", open);
  input.addEventListener("input", () => {
    valueEl.value = ""; // typing means not selected yet
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

  // initial render
  render();
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
function compressImageToDataUrl(file, maxSize = 360, quality = 0.82) {
  return new Promise((resolve) => {
    const img = new Image();
    const reader = new FileReader();
    reader.onload = () => {
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");

        const w = img.width, h = img.height;
        const scale = Math.min(1, maxSize / Math.max(w, h));
        const nw = Math.round(w * scale);
        const nh = Math.round(h * scale);

        canvas.width = nw;
        canvas.height = nh;
        ctx.drawImage(img, 0, 0, nw, nh);

        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}