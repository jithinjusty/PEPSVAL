import { supabase } from "../js/supabase.js";

document.addEventListener("DOMContentLoaded", async () => {
  // ===== Elements (MATCH YOUR HTML IDs) =====
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

  // Enable/disable save based on required fields
  const refreshSaveState = () => {
    const at = (accountType?.value || "").trim();
    const atOtherOk =
      at.toLowerCase() !== "other" || (accountTypeOther?.value || "").trim().length > 0;

    const hasPhoto = !!photoFile;
    const hasPhone = (phoneInput?.value || "").trim().length > 0;
    const hasDial = (dialValue?.value || "").trim().length > 0;

    // rank required only for Seafarer + Shore (you can adjust if needed)
    const needsRank = at === "seafarer" || at === "shore";
    const rankOk = !needsRank || (rankValue?.value || "").trim().length > 0;
    const rankOtherOk =
      (rankValue?.value || "").toLowerCase() !== "other" || (rankOther?.value || "").trim().length > 0;

    const hasCountry = (countryValue?.value || "").trim().length > 0;

    const ok = hasPhoto && hasPhone && hasDial && at && atOtherOk && rankOk && rankOtherOk && hasCountry;
    btn.disabled = !ok;
  };

  // ===== Require login =====
  const { data: sessionData, error: sessErr } = await supabase.auth.getSession();
  if (sessErr || !sessionData?.session?.user) {
    window.location.href = "/auth/login.html";
    return;
  }
  currentUser = sessionData.session.user;

  // ===== Account type behavior =====
  const syncAccountType = () => {
    const v = (accountType?.value || "").trim().toLowerCase();

    // show/hide "Other"
    if (v === "other") accountTypeOtherWrap.classList.remove("hidden");
    else {
      accountTypeOtherWrap.classList.add("hidden");
      accountTypeOther.value = "";
    }

    // show rank only for seafarer/shore
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

  // ===== Photo handling =====
  photoInput.addEventListener("change", () => {
    photoFile = photoInput.files?.[0] || null;

    // preview
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

  // ===== Load Countries JSON + Build searchable combos =====
  let countries = [];
  try {
    const res = await fetch("/data/countries.json", { cache: "no-store" });
    countries = await res.json();
  } catch (e) {
    console.warn("countries.json load failed", e);
  }

  // --- Combo builder (simple, fast, no libraries) ---
  function setupCombo({ searchEl, valueEl, listEl, items, itemToLabel }) {
    const render = (query = "") => {
      const q = query.trim().toLowerCase();
      const filtered = !q
        ? items.slice(0, 40)
        : items.filter((it) => itemToLabel(it).toLowerCase().includes(q)).slice(0, 40);

      listEl.innerHTML = filtered
        .map((it, idx) => {
          const label = itemToLabel(it);
          return `<button type="button" class="comboItem" data-idx="${idx}" data-label="${escapeHtml(label)}">${escapeHtml(label)}</button>`;
        })
        .join("");

      listEl.style.display = filtered.length ? "block" : "none";
    };

    const close = () => (listEl.style.display = "none");

    searchEl.addEventListener("focus", () => render(searchEl.value));
    searchEl.addEventListener("input", () => render(searchEl.value));

    listEl.addEventListener("click", (e) => {
      const btn = e.target.closest(".comboItem");
      if (!btn) return;

      const label = btn.getAttribute("data-label");
      searchEl.value = label;
      valueEl.value = label;
      close();
      refreshSaveState();
    });

    document.addEventListener("click", (e) => {
      if (!e.target.closest(`[data-combo]`)) close();
    });

    return { render, close };
  }

  // Nationality combo
  setupCombo({
    searchEl: countrySearch,
    valueEl: countryValue,
    listEl: countryList,
    items: countries,
    itemToLabel: (c) => c.name,
  });

  // Dial code combo (+91 India)
  setupCombo({
    searchEl: dialSearch,
    valueEl: dialValue,
    listEl: dialList,
    items: countries.filter((c) => c.dial_code),
    itemToLabel: (c) => `${c.dial_code} — ${c.name}`,
  });

  // When dial selected, store ONLY dial code in hidden value
  dialList.addEventListener("click", (e) => {
    const btnItem = e.target.closest(".comboItem");
    if (!btnItem) return;
    const label = btnItem.getAttribute("data-label") || "";
    const code = label.split("—")[0].trim(); // "+91"
    dialValue.value = code;
    dialSearch.value = code;
    refreshSaveState();
  });

  // ===== Ranks list (FULL list later; for now includes key ranks + Other) =====
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
  });

  // Show "Other rank" box when selected Other
  rankList.addEventListener("click", () => {
    const v = (rankValue.value || "").trim().toLowerCase();
    if (v === "other") rankOtherWrap.classList.remove("hidden");
    else {
      rankOtherWrap.classList.add("hidden");
      rankOther.value = "";
    }
    refreshSaveState();
  });

  rankOther.addEventListener("input", refreshSaveState);
  fullName.addEventListener("input", refreshSaveState);
  phoneInput.addEventListener("input", refreshSaveState);
  countrySearch.addEventListener("input", () => {
    // only lock in when user clicks an item; but allow manual
    if (countrySearch.value.trim().length === 0) countryValue.value = "";
    refreshSaveState();
  });
  dialSearch.addEventListener("input", () => {
    if (dialSearch.value.trim().length === 0) dialValue.value = "";
    refreshSaveState();
  });

  // initial state
  syncAccountType();
  refreshSaveState();

  // ===== SUBMIT =====
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    clearError();
    setLoading(true);

    try {
      // Final validation
      if (!photoFile) throw new Error("Profile photo is required.");
      if (!dialValue.value) throw new Error("Country code is required.");
      if (!phoneInput.value.trim()) throw new Error("Mobile number is required.");
      if (!countryValue.value) throw new Error("Nationality is required.");
      if (!accountType.value) throw new Error("Account type is required.");

      const at = accountType.value.toLowerCase();
      const finalAccountType =
        at === "other" ? (accountTypeOther.value || "").trim() : accountType.value;

      const needsRank = at === "seafarer" || at === "shore";
      let finalRank = null;

      if (needsRank) {
        if (!rankValue.value) throw new Error("Rank is required.");
        finalRank =
          rankValue.value.toLowerCase() === "other" ? (rankOther.value || "").trim() : rankValue.value;
        if (!finalRank) throw new Error("Please specify your rank.");
      }

      // 1) Upload avatar
      const ext = (photoFile.name.split(".").pop() || "jpg").toLowerCase();
      const filePath = `${currentUser.id}/${Date.now()}.${ext}`;

      const { error: upErr } = await supabase.storage
        .from("avatars")
        .upload(filePath, photoFile, { upsert: true });

      if (upErr) throw new Error(`Avatar upload failed: ${upErr.message}`);

      const { data: pub } = supabase.storage.from("avatars").getPublicUrl(filePath);
      const avatarUrl = pub?.publicUrl || null;

      // 2) Update profile
      const payload = {
        account_type: finalAccountType,
        full_name: (fullName.value || "").trim() || null,
        rank: finalRank,
        nationality: countryValue.value,
        phone_country_code: dialValue.value,
        phone_number: phoneInput.value.trim(),
        avatar_url: avatarUrl,
        setup_complete: true,
      };

      const { error: updErr } = await supabase
        .from("profiles")
        .update(payload)
        .eq("id", currentUser.id);

      if (updErr) throw new Error(`Profile save failed: ${updErr.message}`);

      // 3) Go dashboard
      window.location.href = "/dashboard.html";
    } catch (ex) {
      console.error(ex);
      showError(ex.message || "Could not save. Please try again.");
      setLoading(false);
    }
  });

  function escapeHtml(s) {
    return String(s)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }
});