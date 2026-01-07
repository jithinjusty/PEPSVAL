import { supabase } from "../js/supabase.js";

document.addEventListener("DOMContentLoaded", async () => {
  // ===== Elements =====
  const form = document.getElementById("setupForm");
  const err = document.getElementById("errorBox");
  const btn = document.getElementById("saveBtn");

  const photoInput = document.getElementById("photoInput");
  const removePhotoBtn = document.getElementById("removePhotoBtn");
  const avatarPreview = document.getElementById("avatarPreview");

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

  // ===== State =====
  let currentUser = null;
  let photoFile = null;
  let countries = [];

  // ===== Helpers =====
  const showError = (m) => {
    err.textContent = m;
    err.style.display = "block";
  };
  const clearError = () => {
    err.textContent = "";
    err.style.display = "none";
  };
  const setLoading = (on) => {
    btn.disabled = on;
    btn.textContent = on ? "Saving…" : "Save & Continue";
  };

  function normalize(s) {
    return (s || "").trim().toLowerCase();
  }

  function setComboValue({ searchEl, valueEl, listEl, label }) {
    searchEl.value = label;
    valueEl.value = label;
    if (listEl) listEl.style.display = "none";
  }

  // Enable/disable save based on required fields
  const refreshSaveState = () => {
    const at = (accountType?.value || "").trim();

    const atOtherOk =
      normalize(at) !== "other" || (accountTypeOther?.value || "").trim().length > 0;

    const hasPhoto = !!photoFile;

    // ✅ allow manual entry fallback
    const nationalityChosen =
      (countryValue?.value || "").trim().length > 0 || (countrySearch?.value || "").trim().length > 0;

    const dialChosen =
      (dialValue?.value || "").trim().length > 0 || (dialSearch?.value || "").trim().length > 0;

    const hasPhone = (phoneInput?.value || "").trim().length > 0;

    // rank required only for seafarer/shore
    const needsRank = normalize(at) === "seafarer" || normalize(at) === "shore";
    const rankChosen =
      !needsRank ||
      (rankValue?.value || "").trim().length > 0 ||
      (rankSearch?.value || "").trim().length > 0;

    const rankIsOther =
      normalize(rankValue?.value) === "other" || normalize(rankSearch?.value) === "other";
    const rankOtherOk = !needsRank || !rankIsOther || (rankOther?.value || "").trim().length > 0;

    const ok =
      hasPhoto &&
      at &&
      atOtherOk &&
      nationalityChosen &&
      dialChosen &&
      hasPhone &&
      rankChosen &&
      rankOtherOk;

    btn.disabled = !ok;
  };

  // ===== Require login =====
  const { data: sessionData, error: sessErr } = await supabase.auth.getSession();
  if (sessErr || !sessionData?.session?.user) {
    window.location.href = "/auth/login.html";
    return;
  }
  currentUser = sessionData.session.user;

  // ===== Photo handling =====
  photoInput.addEventListener("change", () => {
    photoFile = photoInput.files?.[0] || null;

    if (photoFile && avatarPreview) {
      const url = URL.createObjectURL(photoFile);
      avatarPreview.style.backgroundImage = `url("${url}")`;
      avatarPreview.style.backgroundSize = "cover";
      avatarPreview.style.backgroundPosition = "center";
      avatarPreview.innerHTML = "";
    }
    refreshSaveState();
  });

  removePhotoBtn.addEventListener("click", (e) => {
    e.preventDefault();
    photoInput.value = "";
    photoFile = null;

    if (avatarPreview) {
      avatarPreview.style.backgroundImage = "";
      avatarPreview.innerHTML = `<span class="avatarHint">Add photo</span>`;
    }
    refreshSaveState();
  });

  // ===== Account type behavior =====
  const syncAccountType = () => {
    const v = normalize(accountType?.value);

    if (v === "other") accountTypeOtherWrap.classList.remove("hidden");
    else {
      accountTypeOtherWrap.classList.add("hidden");
      accountTypeOther.value = "";
    }

    if (v === "seafarer" || v === "shore") rankWrap.classList.remove("hidden");
    else {
      rankWrap.classList.add("hidden");
      rankValue.value = "";
      rankSearch.value = "";
      rankOther.value = "";
      rankOtherWrap.classList.add("hidden");
    }

    refreshSaveState();
  };

  accountType.addEventListener("change", syncAccountType);
  accountTypeOther.addEventListener("input", refreshSaveState);

  // ===== Load countries =====
  try {
    const res = await fetch("/data/countries.json", { cache: "no-store" });
    countries = await res.json();
  } catch (e) {
    console.warn("countries.json load failed", e);
  }

  // ===== Combo builder =====
  function escapeHtml(s) {
    return String(s)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function setupCombo({ searchEl, valueEl, listEl, items, itemToLabel, onPick }) {
    const render = (query = "") => {
      const q = normalize(query);
      const filtered = !q
        ? items.slice(0, 40)
        : items.filter((it) => normalize(itemToLabel(it)).includes(q)).slice(0, 40);

      listEl.innerHTML = filtered
        .map((it, idx) => {
          const label = itemToLabel(it);
          return `<button type="button" class="comboItem" data-label="${escapeHtml(label)}">${escapeHtml(label)}</button>`;
        })
        .join("");

      listEl.style.display = filtered.length ? "block" : "none";
    };

    const close = () => (listEl.style.display = "none");

    searchEl.addEventListener("focus", () => render(searchEl.value));
    searchEl.addEventListener("input", () => {
      valueEl.value = ""; // reset hidden until chosen/confirmed
      render(searchEl.value);
      refreshSaveState();
    });

    listEl.addEventListener("click", (e) => {
      const btnItem = e.target.closest(".comboItem");
      if (!btnItem) return;

      const label = btnItem.getAttribute("data-label") || "";
      setComboValue({ searchEl, valueEl, listEl, label });
      if (onPick) onPick(label);
      refreshSaveState();
    });

    // ✅ Important: On blur, accept typed value if it matches something
    searchEl.addEventListener("blur", () => {
      const typed = (searchEl.value || "").trim();
      if (!typed) {
        valueEl.value = "";
        close();
        refreshSaveState();
        return;
      }

      // If already selected, keep it
      if ((valueEl.value || "").trim()) {
        close();
        refreshSaveState();
        return;
      }

      // Try to match
      const exact = items.find((it) => normalize(itemToLabel(it)) === normalize(typed));
      if (exact) {
        const label = itemToLabel(exact);
        setComboValue({ searchEl, valueEl, listEl, label });
        if (onPick) onPick(label);
      } else {
        // fallback: accept typed text as value (for your case India/+91)
        valueEl.value = typed;
      }

      close();
      refreshSaveState();
    });

    document.addEventListener("click", (e) => {
      if (!e.target.closest(`[data-combo]`)) close();
    });
  }

  // Nationality combo
  setupCombo({
    searchEl: countrySearch,
    valueEl: countryValue,
    listEl: countryList,
    items: countries,
    itemToLabel: (c) => c.name,
  });

  // Dial combo
  setupCombo({
    searchEl: dialSearch,
    valueEl: dialValue,
    listEl: dialList,
    items: countries.filter((c) => c.dial_code),
    itemToLabel: (c) => `${c.dial_code} — ${c.name}`,
    onPick: (label) => {
      // store ONLY +code
      const code = label.split("—")[0].trim();
      dialValue.value = code;
      dialSearch.value = code;
    },
  });

  // ===== Ranks =====
  const ranks = [
    "Master / Captain",
    "Chief Officer / C/O",
    "Second Officer / 2/O",
    "Third Officer / 3/O",
    "Deck Cadet",
    "Chief Engineer",
    "Second Engineer",
    "Third Engineer",
    "Fourth Engineer",
    "Engine Cadet",
    "Bosun",
    "AB (Able Seaman)",
    "OS (Ordinary Seaman)",
    "Pumpman",
    "Fitter",
    "Cook",
    "Steward",
    "ETO (Electro-Technical Officer)",
    "Electrician",
    "Other",
  ];

  setupCombo({
    searchEl: rankSearch,
    valueEl: rankValue,
    listEl: rankList,
    items: ranks,
    itemToLabel: (r) => r,
    onPick: (label) => {
      if (normalize(label) === "other") rankOtherWrap.classList.remove("hidden");
      else {
        rankOtherWrap.classList.add("hidden");
        rankOther.value = "";
      }
    },
  });

  // When user types "Other" manually
  rankSearch.addEventListener("blur", () => {
    if (normalize(rankSearch.value) === "other") rankOtherWrap.classList.remove("hidden");
    refreshSaveState();
  });

  // inputs refresh
  fullName.addEventListener("input", refreshSaveState);
  phoneInput.addEventListener("input", refreshSaveState);
  rankOther.addEventListener("input", refreshSaveState);

  // Init
  syncAccountType();
  refreshSaveState();

  // ===== SUBMIT =====
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    clearError();
    setLoading(true);

    try {
      if (!photoFile) throw new Error("Profile photo is required.");

      const at = (accountType.value || "").trim().toLowerCase();
      if (!at) throw new Error("Account type is required.");
      if (at === "other" && !(accountTypeOther.value || "").trim())
        throw new Error("Please specify your account type.");

      // final resolved values (prefer hidden else visible)
      const finalCountry = (countryValue.value || countrySearch.value || "").trim();
      if (!finalCountry) throw new Error("Nationality is required.");

      let finalDial = (dialValue.value || dialSearch.value || "").trim();
      if (!finalDial) throw new Error("Country code is required.");
      // if user typed "+91 — India" keep only +91
      if (finalDial.includes("—")) finalDial = finalDial.split("—")[0].trim();

      const finalPhone = (phoneInput.value || "").trim();
      if (!finalPhone) throw new Error("Mobile number is required.");

      // rank if required
      const needsRank = at === "seafarer" || at === "shore";
      let finalRank = null;
      if (needsRank) {
        finalRank = (rankValue.value || rankSearch.value || "").trim();
        if (!finalRank) throw new Error("Rank is required.");
        if (finalRank.toLowerCase() === "other") {
          finalRank = (rankOther.value || "").trim();
          if (!finalRank) throw new Error("Please specify your rank.");
        }
      }

      const finalAccountType = at === "other" ? accountTypeOther.value.trim() : accountType.value;

      // Upload avatar
      const ext = (photoFile.name.split(".").pop() || "jpg").toLowerCase();
      const filePath = `${currentUser.id}/${Date.now()}.${ext}`;

      const { error: upErr } = await supabase.storage
        .from("avatars")
        .upload(filePath, photoFile, { upsert: true });

      if (upErr) throw new Error(`Avatar upload failed: ${upErr.message}`);

      const { data: pub } = supabase.storage.from("avatars").getPublicUrl(filePath);
      const avatarUrl = pub?.publicUrl || null;

      const payload = {
        account_type: finalAccountType,
        full_name: (fullName.value || "").trim() || null,
        rank: finalRank,
        nationality: finalCountry,
        phone_country_code: finalDial,
        phone_number: finalPhone,
        avatar_url: avatarUrl,
        setup_complete: true,
      };

      const { error: updErr } = await supabase.from("profiles").update(payload).eq("id", currentUser.id);
      if (updErr) throw new Error(`Profile save failed: ${updErr.message}`);

      window.location.href = "/dashboard.html";
    } catch (ex) {
      console.error(ex);
      showError(ex.message || "Could not save. Please try again.");
      setLoading(false);
    }
  });
});