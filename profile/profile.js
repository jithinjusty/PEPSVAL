import { supabase } from "/js/supabase.js";

/* -----------------------------
  Tiny helpers (safe)
------------------------------ */
const $ = (id) => document.getElementById(id);

function show(el) { if (el) el.classList.remove("hidden"); }
function hide(el) { if (el) el.classList.add("hidden"); }

function setText(id, txt) {
  const el = $(id);
  if (el) el.textContent = txt ?? "";
}

function escapeHtml(s) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
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

function getAccountTypeLabel(type) {
  const t = String(type || "").toLowerCase();
  if (t === "seafarer") return "Seafarer";
  if (t === "employer") return "Employer";
  if (t === "shore") return "Shore Staff";
  if (t === "other") return "Other";
  return type || "—";
}

function fillDatalist(datalistId, items) {
  const dl = $(datalistId);
  if (!dl) return;
  const uniq = Array.from(new Set((items || []).map(x => String(x || "").trim()).filter(Boolean)));
  dl.innerHTML = uniq.map(v => `<option value="${escapeHtml(v)}"></option>`).join("");
}

function parseIMO(val) {
  const raw = String(val ?? "").trim();
  if (!raw) return { ok: false, err: "IMO number is required (7 digits)." };
  if (!/^\d{7}$/.test(raw)) return { ok: false, err: "IMO must be exactly 7 digits." };
  const num = parseInt(raw, 10);
  if (!(num >= 1000000 && num <= 9999999)) return { ok: false, err: "IMO must be 7 digits (1000000–9999999)." };
  return { ok: true, imo: num };
}

/* -----------------------------
  Dropdown seeds (static)
------------------------------ */
const VESSEL_TYPES = [
  "Container Ship","Bulk Carrier","General Cargo","Ro-Ro","Car Carrier (PCTC)","Reefer",
  "Crude Oil Tanker","Product Tanker","Chemical Tanker","LPG Carrier","LNG Carrier",
  "FPSO","FSO","FSRU","Shuttle Tanker",
  "Offshore Supply Vessel (OSV)","Platform Supply Vessel (PSV)","AHTS",
  "Crew Boat / Fast Support Vessel","Utility Vessel","MPSV",
  "Cable Layer","Pipe Layer","Construction Vessel","Survey Vessel","Seismic Vessel",
  "Diving Support Vessel (DSV)","ROV Support Vessel",
  "Jack-up Rig","Semi-submersible Rig","Drillship",
  "Tug","Barge","Dredger","Research Vessel","Passenger / Ferry","Cruise Vessel",
  "Naval / Coast Guard","Yacht","Training Ship","Other"
];

const RANKS = [
  // Deck
  "Master / Captain","Chief Officer / Chief Mate","Second Officer / 2/O","Third Officer / 3/O","Deck Cadet",
  "Bosun","Able Seaman (AB)","Ordinary Seaman (OS)","Deck Fitter","Pumpman",
  // Engine
  "Chief Engineer","Second Engineer","Third Engineer","Fourth Engineer","Engine Cadet",
  "Electro-Technical Officer (ETO)","Electrician","Motorman / Oiler","Wiper","Engine Fitter",
  // Catering
  "Chief Cook","Cook","Steward","Messman",
  // Offshore / DP / Rig
  "DPO (Dynamic Positioning Operator)","Senior DPO (SDPO)","Trainee DPO","DP Maintainer",
  "OIM (Offshore Installation Manager)","Toolpusher","Driller","Assistant Driller","Derrickman",
  "Roughneck","Roustabout","Crane Operator","ROV Pilot / Technician","Subsea Engineer","Mud Engineer","HSE Officer",
  // Shore
  "Marine Superintendent","Technical Superintendent","Port Captain","Crewing Officer / Manager",
  "Other"
];

/* -----------------------------
  State
------------------------------ */
let currentUser = null;
let currentProfile = null;

/* -----------------------------
  Tabs (safe)
------------------------------ */
function initTabs() {
  const tabButtons = Array.from(document.querySelectorAll(".tab"));
  if (!tabButtons.length) return;

  const panes = {
    about: $("tab_about"),
    posts: $("tab_posts"),
    documents: $("tab_documents"),
    sea: $("tab_sea"),
    jobs: $("tab_jobs"),
    media: $("tab_media"),
  };

  function activate(key) {
    tabButtons.forEach(b => b.classList.toggle("active", b.dataset.tab === key));
    Object.entries(panes).forEach(([k, el]) => {
      if (!el) return;
      (k === key) ? show(el) : hide(el);
    });

    if (key === "sea") {
      // refresh dropdown list + data whenever Sea tab opened
      loadCompaniesIntoDropdown().catch(()=>{});
      loadSeaService().catch(()=>{});
    }
  }

  tabButtons.forEach(b => b.addEventListener("click", () => activate(b.dataset.tab)));
  activate("about");
}

/* -----------------------------
  Auth + Profile load
------------------------------ */
async function requireUserOrRedirect() {
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
  if (badge) { badge.textContent = getAccountTypeLabel(profile?.account_type); show(badge); }

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

  tabDocs && (isSeafarer ? show(tabDocs) : hide(tabDocs));
  tabSea && (isSeafarer ? show(tabSea) : hide(tabSea));
  tabJobs && (isEmployer ? show(tabJobs) : hide(tabJobs));
}

/* -----------------------------
  Companies dropdown (dynamic)
------------------------------ */
async function loadCompaniesIntoDropdown() {
  // Companies table may be large; load plenty for suggestions
  const { data, error } = await supabase
    .from("companies")
    .select("name")
    .order("name", { ascending: true })
    .limit(5000);

  if (error) return;
  fillDatalist("companyOptions", (data || []).map(x => x.name).filter(Boolean));
}

async function saveCompanyIfNew(name) {
  const n = String(name || "").trim();
  if (!n) return;

  // Insert. If duplicate, ignore.
  const { error } = await supabase.from("companies").insert({ name: n });
  if (!error) return;

  // Ignore unique conflicts
  if (String(error.code) === "23505") return;
}

/* -----------------------------
  Sea Service (your schema)
  Columns:
  vessel_name, imo_number, company_name, rank, vessel_type, sign_on_date, sign_off_date
------------------------------ */
async function loadSeaService() {
  const rows = $("seaRows");
  const status = $("seaStatus");
  const errBox = $("seaError");

  if (!rows) return;

  status && (status.textContent = "Loading sea service…");
  errBox && hide(errBox);

  try {
    const { data, error } = await supabase
      .from("sea_service")
      .select("*")
      .order("sign_on_date", { ascending: false });

    if (error) throw error;

    rows.innerHTML = "";
    if (!data || data.length === 0) {
      status && (status.textContent = "No sea service entries yet.");
      return;
    }

    for (const s of data) {
      const vessel = escapeHtml(s.vessel_name || "—");
      const imo = s.imo_number ? `IMO ${s.imo_number}` : "IMO —";
      const type = escapeHtml(s.vessel_type || "—");
      const rank = escapeHtml(s.rank || "—");
      const company = escapeHtml(s.company_name || "—");
      const period = `${formatDate(s.sign_on_date)} → ${formatDate(s.sign_off_date)}`;

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
        <div class="td">Self-declared</div>
        <div class="td" style="text-align:right;"><button class="rowBtn" data-del="${s.id}">Delete</button></div>
      `;
      rows.appendChild(row);
    }

    status && (status.textContent = "Loaded.");
    wireSeaDeletes();
  } catch (e) {
    status && (status.textContent = "Could not load sea service.");
    if (errBox) {
      errBox.textContent = "Cannot load sea service: " + (e?.message || "Unknown error");
      show(errBox);
    }
  }
}

function wireSeaDeletes() {
  const rows = $("seaRows");
  if (!rows) return;

  rows.querySelectorAll("[data-del]").forEach(btn => {
    btn.addEventListener("click", async () => {
      const id = btn.getAttribute("data-del");
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
}

function initSeaForm() {
  // Populate static dropdowns (works only if your home.html has these datalists)
  fillDatalist("vesselTypeOptions", VESSEL_TYPES);
  fillDatalist("rankOptions", RANKS);

  const form = $("seaForm");
  if (!form) return;

  const errBox = $("seaError");
  const saveBtn = $("seaSaveBtn");
  const clearBtn = $("seaClearBtn");

  // Support BOTH id styles (in case your home.html differs)
  const signOnEl = $("signOnDate") || $("signOn");
  const signOffEl = $("signOffDate") || $("signOff");

  clearBtn?.addEventListener("click", () => {
    ["vesselName","imoNumber","vesselType","seaRank","seaCompany"].forEach(id => {
      const el = $(id); if (el) el.value = "";
    });
    if (signOnEl) signOnEl.value = "";
    if (signOffEl) signOffEl.value = "";
    errBox && hide(errBox);
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    errBox && hide(errBox);

    const vesselName = $("vesselName")?.value?.trim();
    const imoVal = $("imoNumber")?.value?.trim();
    const vesselType = $("vesselType")?.value?.trim() || null;
    const rank = $("seaRank")?.value?.trim() || null;
    const company = $("seaCompany")?.value?.trim() || null;

    const signOnDate = signOnEl?.value || "";
    const signOffDate = signOffEl?.value || null;

    if (!vesselName) {
      if (errBox) { errBox.textContent = "Vessel name is required."; show(errBox); }
      return;
    }

    const imoParsed = parseIMO(imoVal);
    if (!imoParsed.ok) {
      if (errBox) { errBox.textContent = imoParsed.err; show(errBox); }
      return;
    }

    if (!signOnDate) {
      if (errBox) { errBox.textContent = "Sign on date is required."; show(errBox); }
      return;
    }

    try {
      saveBtn && (saveBtn.disabled = true);

      // Auto-save company into companies table (ignore duplicates)
      if (company) await saveCompanyIfNew(company);

      const payload = {
        user_id: currentUser.id,
        vessel_name: vesselName,
        imo_number: imoParsed.imo,
        company_name: company,
        rank: rank,
        vessel_type: vesselType,
        sign_on_date: signOnDate,   // ✅ your column
        sign_off_date: signOffDate  // ✅ your column
      };

      const { error } = await supabase.from("sea_service").insert(payload);
      if (error) throw error;

      // Refresh company dropdown suggestions
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

/* -----------------------------
  Boot
------------------------------ */
async function init() {
  initTabs();
  initSeaForm();

  // Load companies list early (for dropdown)
  loadCompaniesIntoDropdown().catch(()=>{});

  currentUser = await requireUserOrRedirect();
  if (!currentUser) return;

  try {
    currentProfile = await loadMyProfile(currentUser.id);
    if (!currentProfile) {
      window.location.href = "/setup/profile-setup.html";
      return;
    }
    applyProfileToUI(currentProfile);
  } catch (e) {
    setText("profileName", "Profile");
  }
}

init();