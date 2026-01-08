import { supabase } from "/js/supabase.js";

/* -------------------------
   Helpers
-------------------------- */
const $ = (id) => document.getElementById(id);

function show(el) { el && el.classList.remove("hidden"); }
function hide(el) { el && el.classList.add("hidden"); }

function setText(id, text) {
  const el = $(id);
  if (el) el.textContent = text ?? "";
}

function escapeHtml(s) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function toISODate(d) {
  if (!d) return null;
  return String(d);
}

function formatDate(d) {
  if (!d) return "—";
  try {
    const dt = new Date(d);
    if (Number.isNaN(dt.getTime())) return String(d);
    return dt.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "2-digit" });
  } catch {
    return String(d);
  }
}

function parseIMO(val) {
  const raw = String(val ?? "").trim();
  if (!raw) return { ok: false, err: "IMO number is required (7 digits)." };
  if (!/^\d{7}$/.test(raw)) return { ok: false, err: "IMO must be exactly 7 digits." };
  const num = parseInt(raw, 10);
  if (!(num >= 1000000 && num <= 9999999)) return { ok: false, err: "IMO must be 7 digits (1000000–9999999)." };
  return { ok: true, imo: num };
}

function getAccountTypeLabel(type) {
  const t = String(type || "").toLowerCase();
  if (t === "seafarer") return "Seafarer";
  if (t === "employer") return "Employer";
  if (t === "shore") return "Shore Staff";
  if (t === "other") return "Other";
  return type || "—";
}

function fillDatalist(datalistId, values) {
  const dl = $(datalistId);
  if (!dl) return;
  dl.innerHTML = values
    .filter(Boolean)
    .map(v => `<option value="${escapeHtml(v)}"></option>`)
    .join("");
}

/* -------------------------
   Dropdown seeds (static)
-------------------------- */
const VESSEL_TYPES = [
  "Container Ship", "Bulk Carrier", "General Cargo", "Ro-Ro", "Car Carrier (PCTC)", "Reefer",
  "Crude Oil Tanker", "Product Tanker", "Chemical Tanker", "LPG Carrier", "LNG Carrier",
  "FPSO", "FSO", "Shuttle Tanker",
  "Offshore Supply Vessel (OSV)", "Platform Supply Vessel (PSV)", "Anchor Handling Tug Supply (AHTS)",
  "Crew Boat / Fast Support Vessel", "Utility Vessel", "Multi-Purpose Support Vessel (MPSV)",
  "Cable Layer", "Pipe Layer", "Construction Vessel", "Survey Vessel", "Seismic Vessel",
  "Diving Support Vessel (DSV)", "ROV Support Vessel",
  "Jack-up Rig", "Semi-submersible Rig", "Drillship",
  "Tug", "Barge", "Dredger", "Research Vessel", "Passenger / Ferry", "Cruise Vessel",
  "Naval / Coast Guard", "Yacht", "Training Ship", "Other"
];

const RANKS = [
  // Deck (merchant)
  "Master / Captain", "Chief Officer / C/O", "Second Officer / 2/O", "Third Officer / 3/O", "Cadet / Deck Cadet",
  "Chief Mate", "Trainee Officer", "Bosun", "Able Seaman (AB)", "Ordinary Seaman (OS)", "Deck Fitter",
  // Engine (merchant)
  "Chief Engineer", "Second Engineer", "Third Engineer", "Fourth Engineer", "Engine Cadet",
  "Electrical Officer / ETO", "Motorman / Oiler", "Wiper", "Engine Fitter",
  // Catering
  "Chief Cook", "Cook", "Steward", "Messman",
  // Tanker / special
  "Cargo Officer", "Safety Officer", "Environmental Officer",
  // Offshore / DP
  "DPO (Dynamic Positioning Operator)", "Senior DPO (SDPO)", "Trainee DPO", "DP Maintainer",
  // Drilling / rig (common)
  "OIM (Offshore Installation Manager)", "Toolpusher", "Senior Toolpusher", "Driller", "Assistant Driller",
  "Roughneck", "Roustabout", "Derrickman", "Crane Operator", "Barge Engineer",
  "Subsea Engineer", "Mud Engineer", "HSE Officer",
  // Shore (optional future)
  "Marine Superintendent", "Technical Superintendent", "Port Captain", "Crewing Manager",
  "Other"
];

/* -------------------------
   State
-------------------------- */
let currentUser = null;
let currentProfile = null;

/* -------------------------
   Tabs
-------------------------- */
function initTabs() {
  const tabButtons = Array.from(document.querySelectorAll(".tab"));
  const panes = {
    about: $("tab_about"),
    posts: $("tab_posts"),
    documents: $("tab_documents"),
    sea: $("tab_sea"),
    jobs: $("tab_jobs"),
    media: $("tab_media"),
  };

  function activate(key) {
    tabButtons.forEach((b) => b.classList.toggle("active", b.dataset.tab === key));
    Object.entries(panes).forEach(([k, el]) => {
      if (!el) return;
      if (k === key) show(el);
      else hide(el);
    });

    if (key === "documents") loadDocuments().catch(() => {});
    if (key === "sea") {
      loadCompaniesIntoDropdown().catch(() => {});
      loadSeaService().catch(() => {});
    }
  }

  tabButtons.forEach((b) => b.addEventListener("click", () => activate(b.dataset.tab)));
  activate("about");
}

/* -------------------------
   Auth + Profile
-------------------------- */
async function requireUser() {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data?.user) {
    window.location.href = "/auth/login.html";
    return null;
  }
  return data.user;
}

async function loadMyProfile(userId) {
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .maybeSingle();

  if (error) throw error;
  return data || null;
}

function applyProfileToUI(profile) {
  const name =
    (profile?.full_name || "").trim() ||
    [profile?.first_name, profile?.last_name].filter(Boolean).join(" ").trim() ||
    "Profile";

  setText("profileName", name);

  const badge = $("accountBadge");
  if (badge) {
    badge.textContent = getAccountTypeLabel(profile?.account_type);
    show(badge);
  }

  const avatarImg = $("avatarImg");
  if (avatarImg && profile?.avatar_url) avatarImg.src = profile.avatar_url;

  setText("miniNationality", profile?.nationality || profile?.nationality_name || "—");
  setText("miniType", getAccountTypeLabel(profile?.account_type));
  setText("miniSince", profile?.created_at ? formatDate(profile.created_at) : "—");

  setText("aboutText", "Your profile is your identity on Pepsval. Keep it updated to increase visibility and trust.");
  setText("aboutName", name);
  setText("aboutDob", profile?.dob ? formatDate(profile.dob) : "—");
  setText("aboutPhone", profile?.phone ? "Saved" : "Hidden");
  setText("aboutType", getAccountTypeLabel(profile?.account_type));

  const isSeafarer = String(profile?.account_type || "").toLowerCase() === "seafarer";
  const isEmployer = String(profile?.account_type || "").toLowerCase() === "employer";

  const tabDocs = $("tabDocuments");
  const tabSea = $("tabSea");
  const tabJobs = $("tabJobs");

  if (tabDocs) isSeafarer ? show(tabDocs) : hide(tabDocs);
  if (tabSea) isSeafarer ? show(tabSea) : hide(tabSea);
  if (tabJobs) isEmployer ? show(tabJobs) : hide(tabJobs);
}

/* -------------------------
   Documents (optional)
-------------------------- */
async function loadDocuments() {
  const status = $("docStatus");
  const rows = $("docRows");
  const errBox = $("docError");
  if (!rows) return;

  if (status) status.textContent = "Loading documents…";
  if (errBox) hide(errBox);

  try {
    const { data, error } = await supabase
      .from("documents")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) throw error;

    rows.innerHTML = "";
    if (!data || data.length === 0) {
      if (status) status.textContent = "No documents added yet.";
      return;
    }

    for (const d of data) {
      const type = escapeHtml(d.doc_type || d.type || "—");
      const issuedBy = escapeHtml(d.issued_by || "—");
      const issue = formatDate(d.issue_date);
      const exp = formatDate(d.expiry_date);
      const st = escapeHtml(d.status || "Self-declared");

      const row = document.createElement("div");
      row.className = "tr";
      row.innerHTML = `
        <div class="td">${type}</div>
        <div class="td">${issuedBy}</div>
        <div class="td">${issue}</div>
        <div class="td">${exp}</div>
        <div class="td">${st}</div>
        <div class="td" style="text-align:right;"><button class="rowBtn" data-doc-del="${d.id}">Delete</button></div>
      `;
      rows.appendChild(row);
    }

    if (status) status.textContent = "Loaded.";
    wireDocumentRowActions();
  } catch {
    if (status) status.textContent = "Could not load documents (table may not exist yet).";
    if (errBox) { errBox.textContent = "Cannot load documents. You can still use other tabs."; show(errBox); }
  }
}

function wireDocumentRowActions() {
  const rows = $("docRows");
  if (!rows) return;

  rows.querySelectorAll("[data-doc-del]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const id = btn.getAttribute("data-doc-del");
      if (!id) return;
      btn.disabled = true;
      try {
        const { error } = await supabase.from("documents").delete().eq("id", id);
        if (error) throw error;
        await loadDocuments();
      } catch {
        alert("Delete failed.");
      } finally {
        btn.disabled = false;
      }
    });
  });
}

function initDocumentForm() {
  const form = $("docForm");
  if (!form) return;

  const saveBtn = $("docSaveBtn");
  const clearBtn = $("docClearBtn");
  const errBox = $("docError");

  clearBtn?.addEventListener("click", () => {
    ["docType", "docNumber", "docIssuedBy", "docIssueDate", "docExpiryDate"].forEach((id) => {
      const el = $(id);
      if (el) el.value = "";
    });
    if (errBox) hide(errBox);
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (errBox) hide(errBox);

    const docType = $("docType")?.value?.trim();
    if (!docType) {
      if (errBox) { errBox.textContent = "Document type is required."; show(errBox); }
      return;
    }

    const payload = {
      user_id: currentUser?.id,
      doc_type: docType,
      doc_number: $("docNumber")?.value?.trim() || null,
      issued_by: $("docIssuedBy")?.value?.trim() || null,
      issue_date: toISODate($("docIssueDate")?.value) || null,
      expiry_date: toISODate($("docExpiryDate")?.value) || null,
      status: "Self-declared",
    };

    try {
      saveBtn && (saveBtn.disabled = true);
      const { error } = await supabase.from("documents").insert(payload);
      if (error) throw error;
      clearBtn?.click();
      await loadDocuments();
    } catch {
      if (errBox) { errBox.textContent = "Save failed (documents table may not be created yet)."; show(errBox); }
    } finally {
      saveBtn && (saveBtn.disabled = false);
    }
  });
}

/* -------------------------
   Companies dropdown (dynamic)
-------------------------- */
async function loadCompaniesIntoDropdown() {
  // We load a big list for dropdown suggestions
  const { data, error } = await supabase
    .from("companies")
    .select("name")
    .order("name", { ascending: true })
    .limit(5000);

  if (error) return; // do not break UI

  const list = (data || []).map(x => x.name).filter(Boolean);
  fillDatalist("companyOptions", list);
}

async function saveCompanyIfNew(name) {
  const n = String(name || "").trim();
  if (!n) return;

  // Insert. If duplicate (unique name), ignore error.
  const { error } = await supabase.from("companies").insert({ name: n });
  if (error) {
    // Unique violation code is 23505. We ignore it.
    if (String(error.code) === "23505") return;
    // Any other error: ignore but don’t crash sea service save.
  }
}

/* -------------------------
   Peer confirmations map
-------------------------- */
async function loadPeerConfirmationsMap() {
  const map = new Map();
  const { data, error } = await supabase
    .from("peer_confirmations")
    .select("*")
    .order("requested_at", { ascending: false });

  if (error) throw error;

  for (const r of (data || [])) {
    const key = String(r.sea_service_id);
    if (!map.has(key)) map.set(key, r);
  }
  return map;
}

/* -------------------------
   Sea Service
-------------------------- */
async function loadSeaService() {
  const status = $("seaStatus");
  const rows = $("seaRows");
  const errBox = $("seaError");
  if (!rows) return;

  if (status) status.textContent = "Loading sea service…";
  if (errBox) hide(errBox);

  try {
    const { data: sea, error: seaErr } = await supabase
      .from("sea_service")
      .select("*")
      .order("created_at", { ascending: false });

    if (seaErr) throw seaErr;

    let peerMap = new Map();
    try { peerMap = await loadPeerConfirmationsMap(); } catch { /* ignore */ }

    rows.innerHTML = "";
    if (!sea || sea.length === 0) {
      if (status) status.textContent = "No sea service entries yet.";
      return;
    }

    for (const s of sea) {
      const vessel = escapeHtml(s.vessel_name || "—");
      const type = escapeHtml(s.vessel_type || "—");
      const rank = escapeHtml(s.rank || "—");
      const company = escapeHtml(s.company_name || "—");
      const period = `${formatDate(s.sign_on)} → ${formatDate(s.sign_off)}`;
      const verified = s.verified ? "Locked (verified)" : "Self-declared";
      const imo = s.imo_number ? `IMO ${s.imo_number}` : "IMO —";

      const peer = peerMap.get(String(s.id));
      const peerStatus = peer ? `Peer: ${peer.status}` : "Peer: not requested";

      const locked = !!s.verified;

      const btnDelete = locked
        ? `<span class="rowPill">${escapeHtml(verified)}</span>`
        : `<button class="rowBtn" data-sea-del="${s.id}">Delete</button>`;

      const btnPeer = `<button class="rowBtn" data-peer-request="${s.id}">Request peer confirmation</button>`;

      const row = document.createElement("div");
      row.className = "tr";
      row.innerHTML = `
        <div class="td">
          <div style="font-weight:900;">${vessel}</div>
          <div class="muted" style="font-weight:800;font-size:12px;margin-top:2px;">${imo}</div>
        </div>
        <div class="td">${type}</div>
        <div class="td">${rank}</div>
        <div class="td">${company}</div>
        <div class="td">${period}</div>
        <div class="td">
          <div>${escapeHtml(verified)}</div>
          <div class="muted" style="font-weight:800;font-size:12px;margin-top:3px;">${escapeHtml(peerStatus)}</div>
        </div>
        <div class="td" style="text-align:right;display:flex;gap:8px;justify-content:flex-end;flex-wrap:wrap;">
          ${btnPeer}
          ${btnDelete}
        </div>
      `;
      rows.appendChild(row);
    }

    if (status) status.textContent = "Loaded.";
    wireSeaRowActions();
  } catch {
    if (status) status.textContent = "Could not load sea service.";
    if (errBox) { errBox.textContent = "Cannot load sea service right now."; show(errBox); }
  }
}

function wireSeaRowActions() {
  const rows = $("seaRows");
  if (!rows) return;

  rows.querySelectorAll("[data-sea-del]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const id = btn.getAttribute("data-sea-del");
      if (!id) return;
      if (!confirm("Delete this sea service entry?")) return;

      btn.disabled = true;
      try {
        const { error } = await supabase.from("sea_service").delete().eq("id", id);
        if (error) throw error;
        await loadSeaService();
      } catch {
        alert("Delete failed.");
      } finally {
        btn.disabled = false;
      }
    });
  });

  rows.querySelectorAll("[data-peer-request]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const seaId = btn.getAttribute("data-peer-request");
      if (!seaId) return;

      const email = prompt("Enter your peer’s email (they will be asked to confirm you served together):");
      if (!email) return;

      const clean = email.trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean)) {
        alert("Please enter a valid email.");
        return;
      }

      btn.disabled = true;
      try {
        const payload = {
          sea_service_id: Number(seaId),
          requester_user_id: currentUser.id,
          peer_email: clean,
          status: "requested",
        };

        const { error } = await supabase.from("peer_confirmations").insert(payload);
        if (error) throw error;

        alert("Peer confirmation request sent (status: requested).");
        await loadSeaService();
      } catch {
        alert("Request failed.");
      } finally {
        btn.disabled = false;
      }
    });
  });
}

function initSeaServiceForm() {
  const form = $("seaForm");
  if (!form) return;

  // Fill static dropdown lists once
  fillDatalist("vesselTypeOptions", VESSEL_TYPES);
  fillDatalist("rankOptions", RANKS);

  const saveBtn = $("seaSaveBtn");
  const clearBtn = $("seaClearBtn");
  const errBox = $("seaError");

  clearBtn?.addEventListener("click", () => {
    ["vesselName", "imoNumber", "vesselType", "seaRank", "seaCompany", "signOn", "signOff"].forEach((id) => {
      const el = $(id);
      if (el) el.value = "";
    });
    if (errBox) hide(errBox);
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (errBox) hide(errBox);

    const vesselName = $("vesselName")?.value?.trim();
    const imoVal = $("imoNumber")?.value?.trim();

    if (!vesselName) {
      if (errBox) { errBox.textContent = "Vessel name is required."; show(errBox); }
      return;
    }

    const imoParsed = parseIMO(imoVal);
    if (!imoParsed.ok) {
      if (errBox) { errBox.textContent = imoParsed.err; show(errBox); }
      return;
    }

    const vesselType = $("vesselType")?.value?.trim() || null;
    const rank = $("seaRank")?.value?.trim() || null;
    const company = $("seaCompany")?.value?.trim() || null;

    try {
      saveBtn && (saveBtn.disabled = true);

      // ✅ Save company into dropdown DB (ignore duplicates)
      if (company) await saveCompanyIfNew(company);

      // ✅ Insert sea service
      const payload = {
        user_id: currentUser.id,
        vessel_name: vesselName,
        imo_number: imoParsed.imo,      // integer
        vessel_type: vesselType,
        rank: rank,
        company_name: company,
        sign_on: toISODate($("signOn")?.value) || null,
        sign_off: toISODate($("signOff")?.value) || null,
        verified: false,
      };

      const { error } = await supabase.from("sea_service").insert(payload);
      if (error) throw error;

      // refresh dropdown (company list grows)
      await loadCompaniesIntoDropdown();

      clearBtn?.click();
      await loadSeaService();
    } catch (e2) {
      if (errBox) {
        errBox.textContent = "Save failed: " + (e2?.message || "Unknown error");
        show(errBox);
      }
    } finally {
      saveBtn && (saveBtn.disabled = false);
    }
  });
}

/* -------------------------
   Boot
-------------------------- */
async function init() {
  initTabs();
  initDocumentForm();
  initSeaServiceForm();

  currentUser = await requireUser();
  if (!currentUser) return;

  try {
    currentProfile = await loadMyProfile(currentUser.id);
    if (!currentProfile) {
      window.location.href = "/setup/profile-setup.html";
      return;
    }
    applyProfileToUI(currentProfile);
  } catch {
    setText("profileName", "Profile");
  }
}

init();