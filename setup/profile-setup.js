import { supabase } from "../js/supabase.js";

document.addEventListener("DOMContentLoaded", async () => {
  const form = document.getElementById("setupForm");
  const err = document.getElementById("errorBox");
  const btn = document.getElementById("saveBtn");

  const photoInput = document.getElementById("photo");
  const removePhotoBtn = document.getElementById("removePhoto");

  const accountType = document.getElementById("accountType");
  const accountTypeOtherWrap = document.getElementById("accountTypeOtherWrap");
  const accountTypeOther = document.getElementById("accountTypeOther");

  const fullName = document.getElementById("fullName");
  const rank = document.getElementById("rank");
  const otherRankWrap = document.getElementById("otherRankWrap");
  const otherRank = document.getElementById("otherRank");

  const nationality = document.getElementById("nationality");
  const dialCode = document.getElementById("dialCode");
  const phone = document.getElementById("phone");

  let currentUser = null;
  let photoFile = null;

  const showError = (m) => {
    if (!err) return alert(m);
    err.textContent = m;
    err.style.display = "block";
  };
  const clearError = () => {
    if (!err) return;
    err.textContent = "";
    err.style.display = "none";
  };
  const setLoading = (on) => {
    if (!btn) return;
    btn.disabled = on;
    btn.textContent = on ? "Saving…" : "Save & Continue";
  };

  // Require login
  const { data: sessionData, error: sessErr } = await supabase.auth.getSession();
  if (sessErr || !sessionData?.session?.user) {
    window.location.href = "/auth/login.html";
    return;
  }
  currentUser = sessionData.session.user;

  // Load countries.json (for nationality + dial codes)
  try {
    const res = await fetch("/data/countries.json", { cache: "no-store" });
    const countries = await res.json();

    // Build datalist for nationality
    const natList = document.getElementById("nationalityList");
    if (natList) {
      natList.innerHTML = countries
        .map((c) => `<option value="${escapeHtml(c.name)}"></option>`)
        .join("");
    }

    // Build datalist for dial codes (label: +91 India)
    const dialList = document.getElementById("dialList");
    if (dialList) {
      dialList.innerHTML = countries
        .filter((c) => c.dial_code)
        .map((c) => `<option value="${escapeHtml(c.dial_code)}">${escapeHtml(c.name)}</option>`)
        .join("");
    }
  } catch (e) {
    // Not fatal
    console.warn("countries.json load failed", e);
  }

  // Account type -> show other field
  const syncAccountType = () => {
    const v = (accountType?.value || "").trim();
    if (v.toLowerCase() === "other") {
      accountTypeOtherWrap.style.display = "block";
    } else {
      accountTypeOtherWrap.style.display = "none";
      if (accountTypeOther) accountTypeOther.value = "";
    }
  };
  accountType?.addEventListener("change", syncAccountType);
  syncAccountType();

  // Rank -> show other rank
  const syncRank = () => {
    const v = (rank?.value || "").trim().toLowerCase();
    if (v === "other") {
      otherRankWrap.style.display = "block";
    } else {
      otherRankWrap.style.display = "none";
      if (otherRank) otherRank.value = "";
    }
  };
  rank?.addEventListener("change", syncRank);
  syncRank();

  // Photo handling
  photoInput?.addEventListener("change", () => {
    photoFile = photoInput.files?.[0] || null;
  });

  removePhotoBtn?.addEventListener("click", (e) => {
    e.preventDefault();
    if (photoInput) photoInput.value = "";
    photoFile = null;
  });

  form?.addEventListener("submit", async (e) => {
    e.preventDefault();
    clearError();

    // ===== Required validations =====
    if (!photoFile) return showError("Profile photo is required.");
    const code = (dialCode?.value || "").trim();
    const number = (phone?.value || "").trim();
    if (!code) return showError("Country code is required.");
    if (!number) return showError("Mobile number is required.");

    const at = (accountType?.value || "").trim();
    if (!at) return showError("Please select account type.");

    if (at.toLowerCase() === "other" && !(accountTypeOther?.value || "").trim()) {
      return showError("Please specify your account type.");
    }

    const name = (fullName?.value || "").trim();
    if (!name) return showError("Full name is required.");

    const rk = (rank?.value || "").trim();
    if (!rk) return showError("Please select rank.");

    if (rk.toLowerCase() === "other" && !(otherRank?.value || "").trim()) {
      return showError("Please specify your rank.");
    }

    const nat = (nationality?.value || "").trim();
    if (!nat) return showError("Nationality is required.");

    setLoading(true);

    try {
      // 1) Upload avatar to Storage
      const ext = (photoFile.name.split(".").pop() || "jpg").toLowerCase();
      const filePath = `${currentUser.id}/${Date.now()}.${ext}`;

      const { error: upErr } = await supabase.storage
        .from("avatars")
        .upload(filePath, photoFile, { upsert: true });

      if (upErr) throw new Error(`Avatar upload failed: ${upErr.message}`);

      const { data: pub } = supabase.storage.from("avatars").getPublicUrl(filePath);
      const avatarUrl = pub?.publicUrl || null;

      // 2) Update profile row (trigger already created the row)
      const payload = {
        account_type: at.toLowerCase() === "other" ? (accountTypeOther.value || "").trim() : at,
        full_name: name,
        rank: rk.toLowerCase() === "other" ? (otherRank.value || "").trim() : rk,
        other_rank: rk.toLowerCase() === "other" ? (otherRank.value || "").trim() : null,
        nationality: nat,
        phone_country_code: code,
        phone_number: number,
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