import { supabase } from "./js/supabase.js";

const RANKS = [
  // Deck Officers
  "Master / Captain",
  "Chief Officer / Chief Mate (C/O)",
  "Second Officer / Second Mate (2/O)",
  "Third Officer / Third Mate (3/O)",
  "Deck Cadet / Trainee OOW",

  // Deck Ratings
  "Boatswain (Bosun)",
  "Able Seaman (AB)",
  "Ordinary Seaman (OS)",
  "Trainee OS",

  // Engine Officers
  "Chief Engineer",
  "Second Engineer",
  "Third Engineer",
  "Fourth Engineer",
  "Trainee Marine Engineer (TME) / Engine Cadet",

  // Engine Ratings
  "Motorman",
  "Oiler",
  "Wiper",

  // ETO
  "Electro-Technical Officer (ETO)",
  "Electrical Cadet / Trainee",

  // Catering / Hotel
  "Chief Cook",
  "Cook",
  "Steward",
  "Chief Steward",

  // Offshore / Special
  "DPO (Dynamic Positioning Operator)",
  "Rigger",
  "Crane Operator",
  "Pumpman",

  // Other
  "Other (write)"
];

// Countries (name + dial code) loaded from /data/countries.json
let COUNTRIES = [];

document.addEventListener("DOMContentLoaded", async () => {
  const form = document.getElementById("setupForm");
  const accountType = document.getElementById("accountType");
  const accountTypeOtherWrap = document.getElementById("accountTypeOtherWrap");
  const accountTypeOther = document.getElementById("accountTypeOther");

  const fullName = document.getElementById("fullName");

  const rankWrap = document.getElementById("rankWrap");
  const rankInput = document.getElementById("rankInput");
  const rankList = document.getElementById("rankList");
  const rankOtherWrap = document.getElementById("rankOtherWrap");
  const rankOther = document.getElementById("rankOther");

  const nationalityInput = document.getElementById("nationalityInput");
  const countryList = document.getElementById("countryList");

  const dialCodeInput = document.getElementById("dialCodeInput");
  const dialList = document.getElementById("dialList");
  const phoneInput = document.getElementById("phoneInput");

  const photoInput = document.getElementById("photoInput");
  const avatarPreview = document.getElementById("avatarPreview");
  const removePhotoBtn = document.getElementById("removePhotoBtn");

  const errorBox = document.getElementById("errorBox");
  const saveBtn = document.getElementById("saveBtn");

  // Session required
  const { data: sessionData } = await supabase.auth.getSession();
  const session = sessionData?.session;
  if (!session) {
    window.location.href = "/auth/login.html";
    return;
  }

  let avatarDataUrl = ""; // we store compressed image as dataURL for now

  function showError(msg) {
    errorBox.textContent = msg;
    errorBox.style.display = "block";
  }
  function clearError() {
    errorBox.textContent = "";
    errorBox.style.display = "none";
  }

  // Load countries JSON (all countries + codes)
  try {
    const res = await fetch("/data/countries.json", { cache: "no-store" });
    COUNTRIES = await res.json();
  } catch (e) {
    // If countries file missing, still allow page to load
    COUNTRIES = [];
  }

  // Fill rank datalist
  rankList.innerHTML = RANKS.map(r => `<option value="${escapeHtml(r)}"></option>`).join("");

  // Fill countries + dial codes (searchable)
  if (COUNTRIES.length) {
    // Nationality list
    countryList.innerHTML = COUNTRIES
      .map(c => `<option value="${escapeHtml(String(c.name).trim())}"></option>`)
      .join("");

    // Dial code list (value is dial code; label is country name)
    dialList.innerHTML = COUNTRIES
      .filter(c => c.dial_code)
      .map(c => {
        const name = String(c.name).trim();
        const dial = String(c.dial_code).replace(/\s+/g, "");
        return `<option value="${escapeHtml(dial)}">${escapeHtml(name)}</option>`;
      })
      .join("");
  }

  // Auto-fill dial code when nationality changes
  nationalityInput.addEventListener("input", () => {
    const selected = (nationalityInput.value || "").trim().toLowerCase();
    if (!selected) return;

    const match = COUNTRIES.find(c => String(c.name).trim().toLowerCase() === selected);
    if (match?.dial_code) {
      const dial = String(match.dial_code).replace(/\s+/g, "");
      dialCodeInput.value = dial;
    }
    validate();
  });

  // Account type change behavior
  accountType.addEventListener("change", () => {
    const type = accountType.value;

    // Other account type text
    accountTypeOtherWrap.classList.toggle("hidden", type !== "other");
    if (type !== "other") accountTypeOther.value = "";

    // Rank only for seafarer
    rankWrap.classList.toggle("hidden", type !== "seafarer");
    if (type !== "seafarer") {
      rankInput.value = "";
      rankOtherWrap.classList.add("hidden");
      rankOther.value = "";
    }

    validate();
  });

  // Rank other toggle
  rankInput.addEventListener("input", () => {
    const v = (rankInput.value || "").trim().toLowerCase();
    const isOther = v === "other (write)" || v === "other";
    rankOtherWrap.classList.toggle("hidden", !isOther);
    if (!isOther) rankOther.value = "";
    validate();
  });

  // Live validation
  [fullName, nationalityInput, dialCodeInput, phoneInput, accountTypeOther, rankOther].forEach(el => {
    el.addEventListener("input", validate);
  });

  // Photo selection (required)
  photoInput.addEventListener("change", async () => {
    clearError();
    const file = photoInput.files?.[0];
    if (!file) {
      avatarDataUrl = "";
      renderAvatar("");
      validate();
      return;
    }

    // Compress to keep it light (good for GitHub pages + DB)
    avatarDataUrl = await compressImageToDataUrl(file, 320, 0.82);
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

  function validate() {
    clearError();

    const type = accountType.value;
    const hasPhoto = !!avatarDataUrl;

    const dial = (dialCodeInput.value || "").trim();
    const phone = (phoneInput.value || "").trim();

    // Required always:
    if (!hasPhoto) {
      saveBtn.disabled = true;
      return;
    }
    if (!dial || !phone) {
      saveBtn.disabled = true;
      return;
    }

    // Account type other must be filled if selected
    if (type === "other" && !(accountTypeOther.value || "").trim()) {
      saveBtn.disabled = true;
      return;
    }

    // Seafarer rank required
    if (type === "seafarer") {
      const r = (rankInput.value || "").trim();
      if (!r) { saveBtn.disabled = true; return; }

      const isOther = r.toLowerCase() === "other (write)" || r.toLowerCase() === "other";
      if (isOther && !(rankOther.value || "").trim()) { saveBtn.disabled = true; return; }
    }

    // Nationality required
    if (!(nationalityInput.value || "").trim()) {
      saveBtn.disabled = true;
      return;
    }

    saveBtn.disabled = false;
  }

  validate();

  // Submit
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    clearError();

    if (saveBtn.disabled) {
      showError("Please complete the required fields (*).");
      return;
    }

    const type = accountType.value;

    const nationality = (nationalityInput.value || "").trim();
    const dial = (dialCodeInput.value || "").trim().replace(/\s+/g, "");
    const phone = (phoneInput.value || "").trim();

    let finalAccountType = type;
    if (type === "other") finalAccountType = (accountTypeOther.value || "").trim();

    let finalRank = "";
    if (type === "seafarer") {
      const r = (rankInput.value || "").trim();
      const isOther = r.toLowerCase() === "other (write)" || r.toLowerCase() === "other";
      finalRank = isOther ? (rankOther.value || "").trim() : r;
      if (!finalRank) {
        showError("Please choose your rank.");
        return;
      }
    }

    const payload = {
      id: session.user.id,
      email: session.user.email,
      full_name: (fullName.value || "").trim(),
      account_type: type,                 // base type
      account_type_label: finalAccountType, // label if other
      rank: finalRank || null,
      nationality: nationality,
      phone_country_code: dial,
      phone_number: phone,
      avatar_url: avatarDataUrl || null,
      setup_complete: true,
      updated_at: new Date().toISOString()
    };

    const { error } = await supabase
      .from("profiles")
      .upsert(payload, { onConflict: "id" });

    if (error) {
      showError(error.message || "Could not save profile.");
      return;
    }

    window.location.href = "/dashboard.html";
  });
});

// Helpers
function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (m) => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"
  }[m]));
}

function compressImageToDataUrl(file, maxSize = 320, quality = 0.82) {
  return new Promise((resolve) => {
    const img = new Image();
    const reader = new FileReader();

    reader.onload = () => {
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");

        const w = img.width;
        const h = img.height;
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
```0