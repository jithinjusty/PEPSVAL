import { supabase } from "../js/supabase.js";

const RANKS = [
  // Deck Officers
  "Master / Captain",
  "Chief Officer / Chief Mate (C/O)",
  "Second Officer / Second Mate (2/O)",
  "Third Officer / Third Mate (3/O)",
  "Junior Officer / 4th Officer (if applicable)",
  "Deck Cadet / Trainee OOW",

  // Deck Ratings
  "Boatswain (Bosun)",
  "Able Seaman (AB)",
  "Ordinary Seaman (OS)",
  "Deck Fitter",
  "Trainee OS",

  // Engine Officers
  "Chief Engineer",
  "Second Engineer",
  "Third Engineer",
  "Fourth Engineer",
  "Junior Engineer / 5th Engineer (if applicable)",
  "Trainee Marine Engineer (TME) / Engine Cadet",

  // Engine Ratings
  "Motorman",
  "Oiler",
  "Wiper",
  "Engine Fitter",

  // Electrical
  "Electro-Technical Officer (ETO)",
  "Electrician",
  "Electrical Cadet / Trainee",

  // Catering
  "Chief Cook",
  "Cook",
  "Messman",
  "Steward",
  "Chief Steward",

  // Offshore / Specialized
  "DPO (Dynamic Positioning Operator)",
  "Rigger",
  "Crane Operator",
  "Pumpman",

  // Other
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

  // Build ranks datalist
  rankList.innerHTML = RANKS.map(r => `<option value="${escapeHtml(r)}"></option>`).join("");

  // Build country + dial datalists
  if (COUNTRIES.length) {
    countryList.innerHTML = COUNTRIES
      .map(c => `<option value="${escapeHtml(cleanName(c.name))}"></option>`)
      .join("");

    dialList.innerHTML = COUNTRIES
      .filter(c => c.dial_code)
      .map(c => {
        const name = cleanName(c.name);
        const dial = cleanDial(c.dial_code);
        return `<option value="${escapeHtml(dial)}">${escapeHtml(name)}</option>`;
      })
      .join("");
  }

  // Auto-fill dial code when nationality selected
  nationalityInput.addEventListener("input", () => {
    const selected = (nationalityInput.value || "").trim().toLowerCase();
    if (!selected) return;

    const match = COUNTRIES.find(c => cleanName(c.name).toLowerCase() === selected);
    if (match?.dial_code) dialCodeInput.value = cleanDial(match.dial_code);
    validate();
  });

  // Account type rules
  accountType.addEventListener("change", () => {
    const type = accountType.value;

    // Other account type
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

  // Rank other rules
  rankInput.addEventListener("input", () => {
    const v = (rankInput.value || "").trim().toLowerCase();
    const isOther = v === "other (write)" || v === "other";
    rankOtherWrap.classList.toggle("hidden", !isOther);
    if (!isOther) rankOther.value = "";
    validate();
  });

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

  // Live validation
  [accountTypeOther, fullName, nationalityInput, dialCodeInput, phoneInput, rankOther].forEach(el => {
    el.addEventListener("input", validate);
  });

  function validate() {
    clearError();

    const type = accountType.value;
    const hasPhoto = !!avatarDataUrl;

    const nat = (nationalityInput.value || "").trim();
    const dial = cleanDial(dialCodeInput.value || "");
    const phone = (phoneInput.value || "").trim();

    // Your rule: cannot save without profile photo + mobile number
    if (!hasPhoto || !dial || !phone) {
      saveBtn.disabled = true;
      return;
    }

    // Also require nationality + account type for a proper profile
    if (!type || !nat) {
      saveBtn.disabled = true;
      return;
    }

    // Other account type requires text
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

    saveBtn.disabled = false;
  }

  validate();

  // Save
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    clearError();

    if (saveBtn.disabled) {
      showError("Please complete the required fields (*).");
      return;
    }

    const type = accountType.value;

    let accountTypeLabel = type;
    if (type === "other") accountTypeLabel = (accountTypeOther.value || "").trim();

    let finalRank = null;
    if (type === "seafarer") {
      const r = (rankInput.value || "").trim();
      const isOther = r.toLowerCase() === "other (write)" || r.toLowerCase() === "other";
      finalRank = isOther ? (rankOther.value || "").trim() : r;
      if (!finalRank) return showError("Please choose your rank.");
    }

    const payload = {
      id: session.user.id,
      email: session.user.email,
      full_name: (fullName.value || "").trim(),
      account_type: type,
      account_type_label: accountTypeLabel,
      rank: finalRank,
      nationality: (nationalityInput.value || "").trim(),
      phone_country_code: cleanDial(dialCodeInput.value || ""),
      phone_number: (phoneInput.value || "").trim(),
      avatar_url: avatarDataUrl || null,
      setup_complete: true,
      updated_at: new Date().toISOString()
    };

    const { error } = await supabase.from("profiles").upsert(payload, { onConflict: "id" });
    if (error) return showError(error.message || "Could not save profile.");

    window.location.href = "/dashboard.html";
  });
});

// Helpers
function cleanDial(v) {
  return String(v || "").replace(/\s+/g, "");
}
function cleanName(v) {
  return String(v || "").trim().replace(/([a-z])([A-Z])/g, "$1 $2"); // safety if any
}
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