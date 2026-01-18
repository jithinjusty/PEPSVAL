import { supabase, getCurrentUser } from "../js/supabase.js";

/*
  PEPSVAL Profile (single page, all account types)
  - Seafarer: About | Documents | Sea Service | Posts
  - Company (Employer): About | Posts | Jobs
  - Maritime Professional (Shore): About | Posts | Experience
  - Other: About | Posts

  Important: this file is defensive.
  If some DB tables/columns are missing, the page will NOT crash.
*/

// ---------- DOM ----------
const elTabs = document.getElementById("tabs");

const avatarImg = document.getElementById("avatarImg");
const avatarFallback = document.getElementById("avatarFallback");
const avatarEditBtn = document.getElementById("avatarEditBtn");
const typeBadge = document.getElementById("typeBadge");

const elProfileName = document.getElementById("profileName");
const elMiniRank = document.getElementById("miniRank");
const elMiniNationality = document.getElementById("miniNationality");

const editBtn = document.getElementById("editProfileBtn");
const saveBtn = document.getElementById("saveProfileBtn");

const panes = {
  about: document.getElementById("tab_about"),
  posts: document.getElementById("tab_posts"),
  documents: document.getElementById("tab_documents"),
  sea: document.getElementById("tab_sea"),
  jobs: document.getElementById("tab_jobs"),
  experience: document.getElementById("tab_experience"),
};

const aboutSections = {
  seafarer: document.querySelector('[data-about="seafarer"]'),
  company: document.querySelector('[data-about="company"]'),
  professional: document.querySelector('[data-about="professional"]'),
};

const postCounts = document.getElementById("postCounts");
const postsWrap = document.getElementById("postsWrap");
const documentsWrap = document.getElementById("documentsWrap");
const seaWrap = document.getElementById("seaWrap");
const jobsWrap = document.getElementById("jobsWrap");
const expWrap = document.getElementById("expWrap");

const docsVisibleToggle = document.getElementById("docsVisibleToggle");
const docsVisLabel = document.getElementById("docsVisLabel");

// About fields
const f = {
  full_name: document.getElementById("f_full_name"),
  dob: document.getElementById("f_dob"),
  email: document.getElementById("f_email"),
  phone: document.getElementById("f_phone"),
  rank: document.getElementById("f_rank"),
  company_working: document.getElementById("f_company_working"),
  bio: document.getElementById("f_bio"),
};

const c = {
  company_name: document.getElementById("c_company_name"),
  phone: document.getElementById("c_phone"),
  emailsWrap: document.getElementById("c_emails"),
  addEmailBtn: document.getElementById("c_add_email"),
  about: document.getElementById("c_about"),
  vision: document.getElementById("c_vision"),
};

const p = {
  full_name: document.getElementById("p_full_name"),
  dob: document.getElementById("p_dob"),
  email: document.getElementById("p_email"),
  phone: document.getElementById("p_phone"),
  current_company: document.getElementById("p_current_company"),
  position: document.getElementById("p_position"),
  bio: document.getElementById("p_bio"),
};

const rankList = document.getElementById("rankList");
const companyList = document.getElementById("companyList");

// ---------- State ----------
let me = null;
let profile = null;
let accountKind = "other"; // seafarer | company | professional | other
let editing = false;

const LOCAL_COMPANY_KEY = "pepsval_company_dropdown_local_v1";

// These “extras” are stored locally to avoid crashes if your DB doesn’t have columns yet
const localExtraKey = (kind) => `pepsval_profile_extra_${kind}_v1`;

// ---------- helpers ----------
function safeText(v, fallback = "") {
  const t = (v ?? "").toString().trim();
  return t.length ? t : fallback;
}

function escapeHtml(s) {
  return (s ?? "")
    .toString()
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function initialsFromName(name) {
  const parts = (name || "").trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "P";
  const first = parts[0][0] || "";
  const last = (parts.length > 1 ? parts[parts.length - 1][0] : "") || "";
  return (first + last).toUpperCase() || "P";
}

function setAvatar(url, nameForInitials) {
  const urlTrim = safeText(url, "");
  if (urlTrim) {
    avatarImg.src = urlTrim;
    avatarImg.classList.remove("hidden");
    avatarFallback.classList.add("hidden");
    avatarFallback.textContent = "";
  } else {
    avatarImg.removeAttribute("src");
    avatarImg.classList.add("hidden");
    avatarFallback.classList.remove("hidden");
    avatarFallback.textContent = initialsFromName(nameForInitials);
  }
}

function setAccountTypeBadge(account_type) {
  const map = {
    seafarer: "Seafarer",
    employer: "Company",
    shore: "Maritime Professional",
    other: "Profile",
  };
  const label = map[(account_type || "").toLowerCase()] || "";
  if (!label) {
    typeBadge.classList.add("hidden");
    typeBadge.textContent = "";
    return;
  }
  typeBadge.classList.remove("hidden");
  typeBadge.textContent = label;
}

function getAccountKind(account_type) {
  const t = (account_type || "").toString().toLowerCase().trim();
  if (t === "seafarer") return "seafarer";
  if (t === "employer" || t === "company") return "company"; // tolerate 'company' DB value
  if (t === "shore" || t === "professional") return "professional";
  // Default to seafarer if empty or unknown (most common user)
  if (!t) return "seafarer";
  return "other";
}

function showPane(name) {
  Object.entries(panes).forEach(([k, el]) => {
    if (!el) return;
    el.classList.toggle("hidden", k !== name);
  });

  // tabs active state
  Array.from(elTabs.querySelectorAll(".tab")).forEach(btn => {
    btn.classList.toggle("active", btn.dataset.tab === name);
  });

  // on demand loads
  if (name === "posts") loadPostsSafe();
  if (name === "documents") loadDocumentsSafe();
  if (name === "sea") loadSeaSafe();
  if (name === "jobs") loadJobsSafe();
  if (name === "experience") loadExperienceSafe();
}

function buildTabs() {
  const tabs = [];

  // About always
  tabs.push({ key: "about", label: "About" });

  console.log("Building tabs for accountKind:", accountKind);

  if (accountKind === "seafarer") {
    tabs.push({ key: "documents", label: "Documents" });
    tabs.push({ key: "sea", label: "Sea Service" });
    tabs.push({ key: "posts", label: "Posts" });
  } else if (accountKind === "company") {
    tabs.push({ key: "posts", label: "Posts" });
    tabs.push({ key: "jobs", label: "Jobs" });
  } else if (accountKind === "professional") {
    tabs.push({ key: "posts", label: "Posts" });
    tabs.push({ key: "experience", label: "Experience" });
  } else {
    // default / other
    tabs.push({ key: "posts", label: "Posts" });
  }

  elTabs.innerHTML = tabs.map((t, i) =>
    `<button class="tab ${i === 0 ? "active" : ""}" data-tab="${t.key}" type="button">${t.label}</button>`
  ).join("");

  elTabs.addEventListener("click", (e) => {
    const btn = e.target.closest(".tab");
    if (!btn) return;
    showPane(btn.dataset.tab);
  }, { passive: true });

  // hide unused panes safely
  const used = new Set(tabs.map(t => t.key));
  Object.entries(panes).forEach(([k, el]) => {
    if (!el) return;
    if (!used.has(k)) el.classList.add("hidden");
  });
}

function setEditing(state) {
  editing = !!state;

  // Toggle edit/save buttons for About section only
  editBtn.classList.toggle("hidden", editing);
  saveBtn.classList.toggle("hidden", !editing);

  // Enable/disable inputs based on account kind (About section only)
  const enable = (el, ok) => {
    if (!el) return;
    el.disabled = !ok;
  };

  // Seafarer
  enable(f.full_name, editing);
  enable(f.dob, editing);
  enable(f.phone, editing);
  enable(f.rank, editing);
  enable(f.company_working, editing);
  enable(f.bio, editing);
  // f.email is always disabled

  // Company
  enable(c.company_name, editing);
  enable(c.phone, editing);
  enable(c.about, editing);
  enable(c.vision, editing);
  if (c.addEmailBtn) c.addEmailBtn.disabled = !editing;
  if (c.emailsWrap) {
    Array.from(c.emailsWrap.querySelectorAll("input,button")).forEach(x => x.disabled = !editing);
  }

  // Professional
  enable(p.full_name, editing);
  enable(p.dob, editing);
  enable(p.phone, editing);
  enable(p.current_company, editing);
  enable(p.position, editing);
  enable(p.bio, editing);
  // p.email always disabled

  // Note: Docs, Sea, Jobs, Exp are now ALWAYS editable (independent of this toggle)
}

function paintHeader() {
  const name = profile?.full_name || profile?.company_name || me?.email?.split("@")[0] || "Profile";
  elProfileName.textContent = name;

  // mini row tries to show rank + nationality for seafarer, else role/company hints
  if (accountKind === "seafarer") {
    elMiniRank.textContent = safeText(profile?.rank, "—");
    elMiniNationality.textContent = safeText(profile?.nationality, "—");
  } else if (accountKind === "company") {
    elMiniRank.textContent = safeText(profile?.company_name, "—");
    elMiniNationality.textContent = safeText(profile?.nationality, "—");
  } else if (accountKind === "professional") {
    elMiniRank.textContent = safeText(profile?.role, "—");
    elMiniNationality.textContent = safeText(profile?.nationality, "—");
  } else {
    elMiniRank.textContent = safeText(profile?.rank || profile?.role, "—");
    elMiniNationality.textContent = safeText(profile?.nationality, "—");
  }

  setAvatar(profile?.avatar_url, name);
  setAccountTypeBadge(profile?.account_type);
}

function showAboutSection(kind) {
  Object.entries(aboutSections).forEach(([k, el]) => {
    if (!el) return;
    el.classList.toggle("hidden", k !== kind);
  });
}

// ---------- company dropdown (shared, safe) ----------
// ---------- company dropdown (shared, supabase) ----------
async function loadSeedCompanies() {
  try {
    // 1. Load from DB
    const { data, error } = await supabase
      .from("companies")
      .select("name")
      .order("name", { ascending: true })
      .limit(1000);

    if (error) throw error;
    if (data) return data.map(x => x.name).filter(Boolean);
    return [];
  } catch {
    // 2. Fallback to seed json if DB fails (offline or no table yet)
    try {
      const res = await fetch("/data/companies_seed.json", { cache: "no-store" });
      if (!res.ok) return [];
      const j = await res.json();
      if (Array.isArray(j)) return j.map(x => (typeof x === "string" ? x : x?.name)).filter(Boolean);
      return [];
    } catch { return []; }
  }
}

async function addCompanyToDb(name) {
  const n = safeText(name, "");
  if (!n) return;
  // Fire and forget insert (if valid)
  // We use insert ignore logic via "onConflict" if mapped or just let it fail if unique constraint
  // Supabase "upsert" with ignoreDuplicates: true
  try {
    await supabase.from("companies").upsert({ name: n }, { onConflict: "name", ignoreDuplicates: true });
  } catch (e) { console.error("Company add failed", e); }
}

async function paintCompanyDatalist() {
  const all = await loadSeedCompanies();

  // unique (case-insensitive)
  const seen = new Set();
  const uniq = [];
  for (const item of all) {
    const key = item.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    uniq.push(item);
  }

  if (companyList) {
    companyList.innerHTML = uniq.slice(0, 2000).map(x => `<option value="${escapeHtml(x)}"></option>`).join("");
  }
}

// ---------- ranks ----------
const RANKS_ALL = [
  // Main fleet (deck)
  "Master",
  "Chief Officer",
  "Second Officer",
  "Third Officer",
  "Cadet / Trainee",
  // Engine / ETO (for completeness)
  "Chief Engineer",
  "Second Engineer",
  "Third Engineer",
  "Fourth Engineer",
  "Electrical Officer (ETO)",
  // Offshore / DP
  "DPO",
  "Senior DPO",
  "Offshore Installation Manager (OIM)",
  // Cruise / Hotel
  "Staff Captain",
  "Safety Officer",
  "Hotel Director",
  // Other
  "Other",
  "Cook",
  "Bosun",
  "AB",
  "OS",
  "Fitter",
  "Oiler",
  "Wiper",
  "Steward"
];

function paintRankDatalist() {
  if (!rankList) return;
  rankList.innerHTML = RANKS_ALL.map(r => `<option value="${escapeHtml(r)}"></option>`).join("");
}

// ---------- local extras (company emails/about/vision, etc.) ----------
function readLocalExtra(kind) {
  try {
    return JSON.parse(localStorage.getItem(localExtraKey(kind)) || "{}");
  } catch {
    return {};
  }
}

function writeLocalExtra(kind, obj) {
  try {
    localStorage.setItem(localExtraKey(kind), JSON.stringify(obj || {}));
  } catch { }
}

// ---------- Supabase profile ----------
async function ensureProfileRow(user) {
  const { data: existing, error: selErr } = await supabase
    .from("profiles")
    .select("id")
    .eq("id", user.id)
    .maybeSingle();

  if (selErr) throw selErr;

  if (!existing) {
    const insertPayload = {
      id: user.id,
      email: user.email || null,
      full_name:
        (user.user_metadata && user.user_metadata.full_name) ||
        user.email?.split("@")[0] ||
        null,
      account_type: "seafarer" // Default for new users
    };

    const { error: insErr } = await supabase.from("profiles").insert(insertPayload);
    if (insErr) throw insErr;
  }
}

async function fetchProfile(userId) {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name, rank, nationality, bio, email, avatar_url, account_type, dob, phone, company_name, role")
    .eq("id", userId)
    .maybeSingle();

  if (error) throw error;
  return data;
}

function paintAbout() {
  // switch which about section to show
  if (accountKind === "seafarer") showAboutSection("seafarer");
  if (accountKind === "company") showAboutSection("company");
  if (accountKind === "professional") showAboutSection("professional");
  if (accountKind === "professional") showAboutSection("professional");
  // Default fallback -> show Seafarer inputs. This matches getAccountKind() default.
  // Ideally this line is rarely hit now that we default aggressively.
  if (accountKind === "other" || accountKind === "seafarer") showAboutSection("seafarer");

  // Seafarer fields
  if (f.full_name) f.full_name.value = safeText(profile?.full_name, "");
  if (f.dob) f.dob.value = safeText(profile?.dob, "");
  if (f.email) f.email.value = safeText(profile?.email || me?.email, "");
  if (f.phone) f.phone.value = safeText(profile?.phone, "");
  if (f.rank) f.rank.value = safeText(profile?.rank, "");
  if (f.company_working) f.company_working.value = safeText(profile?.company_name, "");
  if (f.bio) f.bio.value = safeText(profile?.bio, "");

  // Company fields (minimal in DB + extras in local)
  if (c.company_name) c.company_name.value = safeText(profile?.company_name, "");
  if (c.phone) c.phone.value = safeText(profile?.phone, "");
  const companyExtra = readLocalExtra("company");
  if (c.about) c.about.value = safeText(companyExtra?.about, "");
  if (c.vision) c.vision.value = safeText(companyExtra?.vision, "");
  paintCompanyEmails(companyExtra?.emails || []);

  // Professional fields
  if (p.full_name) p.full_name.value = safeText(profile?.full_name, "");
  if (p.dob) p.dob.value = safeText(profile?.dob, "");
  if (p.email) p.email.value = safeText(profile?.email || me?.email, "");
  if (p.phone) p.phone.value = safeText(profile?.phone, "");
  if (p.current_company) p.current_company.value = safeText(profile?.company_name, "");
  if (p.position) p.position.value = safeText(profile?.role, "");
  if (p.bio) p.bio.value = safeText(profile?.bio, "");
}

// ---------- actions ----------
async function loadProfile() {
  me = await getCurrentUser();
  if (!me) return;

  await ensureProfileRow(me);
  profile = await fetchProfile(me.id);

  accountKind = getAccountKind(profile?.account_type);
  console.log("Loaded Profile:", profile);
  console.log("Determined Account Kind:", accountKind);

  paintHeader();
  buildTabs();
  paintAbout();
  setEditing(false);

  showPane("about");
}

async function saveProfile() {
  if (!me) return;

  const updates = { updated_at: new Date().toISOString() };

  if (accountKind === "seafarer") {
    updates.full_name = safeText(f.full_name.value, null);
    updates.dob = safeText(f.dob.value, null);
    updates.phone = safeText(f.phone.value, null);
    updates.rank = safeText(f.rank.value, null);
    updates.company_name = safeText(f.company_working.value, null);
    updates.bio = safeText(f.bio.value, null);

    // Ensure we claim the role if not set
    updates.account_type = "seafarer";

    if (updates.company_name) addCompanyToDb(updates.company_name);
  }

  if (accountKind === "company") {
    updates.company_name = safeText(c.company_name.value, null);
    updates.phone = safeText(c.phone.value, null);
    writeLocalExtra("company", {
      emails: readCompanyEmails(),
      about: safeText(c.about.value, ""),
      vision: safeText(c.vision.value, ""),
    });

    updates.account_type = "employer"; // DB uses 'employer' or 'company' depending on strictness, staying consistent with initial code (employer)

    if (updates.company_name) addCompanyToDb(updates.company_name);
  }

  if (accountKind === "professional") {
    updates.full_name = safeText(p.full_name.value, null);
    updates.dob = safeText(p.dob.value, null);
    updates.phone = safeText(p.phone.value, null);
    updates.company_name = safeText(p.current_company.value, null);
    updates.role = safeText(p.position.value, null);
    updates.bio = safeText(p.bio.value, null);

    updates.account_type = "shore"; // DB uses 'shore'

    if (updates.company_name) addCompanyToDb(updates.company_name);
  }

  Object.keys(updates).forEach(k => {
    if (updates[k] === null || updates[k] === "") delete updates[k];
  });

  const { error } = await supabase.from("profiles").update(updates).eq("id", me.id);
  if (error) throw error;

  profile = await fetchProfile(me.id);
  paintHeader();
  paintAbout();
  setEditing(false);
}

// ---------- company emails UI (multi) ----------
function paintCompanyEmails(list) {
  if (!c.emailsWrap) return;
  const rows = Array.isArray(list) ? list : [];
  c.emailsWrap.innerHTML = rows.map((r, idx) => {
    const email = safeText(r?.email, "");
    const purpose = safeText(r?.purpose, "");
    return `
      <div class="multiRow" data-idx="${idx}">
        <input class="input" placeholder="email" value="${escapeHtml(email)}" ${editing ? "" : "disabled"} />
        <input class="input" placeholder="purpose (Career / Support…)" value="${escapeHtml(purpose)}" ${editing ? "" : "disabled"} />
        <button class="iconBtn" type="button" data-action="removeEmail" ${editing ? "" : "disabled"}>✕</button>
      </div>`;
  }).join("");
}

function readCompanyEmails() {
  if (!c.emailsWrap) return [];
  const rows = Array.from(c.emailsWrap.querySelectorAll(".multiRow"));
  return rows.map(row => {
    const inputs = row.querySelectorAll("input");
    return {
      email: safeText(inputs[0]?.value, ""),
      purpose: safeText(inputs[1]?.value, ""),
    };
  }).filter(x => x.email);
}

function addCompanyEmailRow(prefill = { email: "", purpose: "" }) {
  const current = readCompanyEmails();
  current.push(prefill);
  paintCompanyEmails(current);
}

// ---------- POSTS (Instagram-style count + list, safe) ----------
function formatDate(dt) {
  try { return new Date(dt).toLocaleString(); } catch { return ""; }
}

function postVisibilityKey(postId) {
  return `pepsval_post_vis_${me?.id || "me"}_${postId}`;
}

function getLocalPostVisibility(postId) {
  try { return localStorage.getItem(postVisibilityKey(postId)) || "public"; } catch { return "public"; }
}

function setLocalPostVisibility(postId, v) {
  try { localStorage.setItem(postVisibilityKey(postId), v); } catch { }
}

async function loadPostsSafe() {
  if (!me) return;
  if (!postsWrap) return;

  postsWrap.textContent = "Loading…";
  postCounts.textContent = "0 posts";

  try {
    // posts table exists in your project already
    let res = await supabase
      .from("posts")
      .select("*")
      .eq("user_id", me.id)
      .order("created_at", { ascending: false })
      .limit(100);

    if (res.error) {
      // fallback if created_at not there
      res = await supabase
        .from("posts")
        .select("*")
        .eq("user_id", me.id)
        .order("id", { ascending: false })
        .limit(100);
    }

    if (res.error) throw res.error;
    const rows = res.data || [];
    postCounts.textContent = `${rows.length} posts`;

    if (!rows.length) {
      postsWrap.innerHTML = `<div class="muted">No posts yet.</div>`;
      return;
    }

    // We’ll show owner controls: visibility + delete.
    postsWrap.innerHTML = rows.map(r => {
      const id = r.id;
      const text = safeText(r.content || r.body || "", "");
      const media = r.media_url || r.media || "";
      const vis = getLocalPostVisibility(id);

      const mediaHtml = media
        ? (String(media).match(/\.(mp4|mov|webm)(\?|$)/i)
          ? `<video src="${escapeHtml(media)}" controls style="width:100%;border-radius:14px;border:1px solid rgba(0,0,0,.06);"></video>`
          : `<img src="${escapeHtml(media)}" alt="" style="width:100%;border-radius:14px;border:1px solid rgba(0,0,0,.06);" />`)
        : "";

      return `
        <article class="pv-post" style="border:1px solid rgba(0,0,0,.06);border-radius:16px;padding:12px;margin:10px 0;background:#fff;">
          <div style="display:flex;justify-content:space-between;gap:10px;align-items:flex-start;">
            <div style="font-weight:900;">${escapeHtml(profile?.full_name || profile?.company_name || "Me")}</div>
            <div style="display:flex;gap:8px;align-items:center;">
              <select data-action="postVis" data-id="${id}" style="border:1px solid rgba(0,0,0,.10);border-radius:999px;padding:6px 10px;font-weight:900;">
                <option value="public" ${vis === "public" ? "selected" : ""}>Public</option>
                <option value="hide" ${vis === "hide" ? "selected" : ""}>Hide</option>
                <option value="private" ${vis === "private" ? "selected" : ""}>Private</option>
              </select>
              <button class="iconBtn" type="button" data-action="deletePost" data-id="${id}" title="Delete post">✕</button>
            </div>
          </div>
          <div class="muted" style="margin-top:4px;">${escapeHtml(formatDate(r.created_at || r.inserted_at || ""))}</div>
          ${text ? `<div style="margin-top:10px;font-weight:700;white-space:pre-wrap;">${escapeHtml(text)}</div>` : ``}
          ${mediaHtml ? `<div style="margin-top:10px;">${mediaHtml}</div>` : ``}
          <div class="muted" style="margin-top:10px;">Likes & comments: open from feed (same interactions).</div>
        </article>
      `;
    }).join("");

  } catch (e) {
    console.error("Posts load failed:", e);
    postsWrap.innerHTML = `<div class="muted">Posts failed to load. (${escapeHtml(e.message || "Unknown error")})</div>`;
  }
}

postsWrap?.addEventListener("change", async (e) => {
  const sel = e.target.closest('select[data-action="postVis"]');
  if (!sel) return;
  const postId = sel.dataset.id;
  setLocalPostVisibility(postId, sel.value);
});

postsWrap?.addEventListener("click", async (e) => {
  const del = e.target.closest('button[data-action="deletePost"]');
  if (!del) return;
  const postId = del.dataset.id;

  if (!confirm("Delete this post?")) return;

  try {
    const { error } = await supabase.from("posts").delete().eq("id", postId).eq("user_id", me.id);
    if (error) throw error;
    await loadPostsSafe();
  } catch (err) {
    alert("Delete failed: " + (err.message || "Unknown error"));
  }
});

// ---------- DOCUMENTS (Supabase) ----------
const DOCS_VIS_KEY = () => `pepsval_docs_vis_${me?.id || "me"}_v1`;

function readDocsVisibility() {
  try { return localStorage.getItem(DOCS_VIS_KEY()) || "public"; } catch { return "public"; }
}
function writeDocsVisibility(v) {
  try { localStorage.setItem(DOCS_VIS_KEY(), v); } catch { }
}

function daysToHuman(days) {
  const d = Math.max(0, Math.floor(days || 0));
  const years = Math.floor(d / 365);
  const rem1 = d % 365;
  const months = Math.floor(rem1 / 30);
  const rem2 = rem1 % 30;

  const parts = [];
  if (years > 0) parts.push(`${years} ${years === 1 ? "year" : "years"}`);
  if (months > 0) parts.push(`${months} ${months === 1 ? "month" : "months"}`);
  if (rem2 > 0 || parts.length === 0) parts.push(`${rem2} ${rem2 === 1 ? "day" : "days"}`);

  return parts.join(" ");
}

function computeExpiry(expiryDate) {
  if (!expiryDate) return { raw: "", label: "—" };
  const now = new Date();
  const exp = new Date(expiryDate);
  const diff = Math.ceil((exp.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  return { raw: diff, label: diff >= 0 ? daysToHuman(diff) : `Expired` };
}

function renderDocs(rows) {
  const list = Array.isArray(rows) ? rows : [];
  const table = `
    <div class="tableActions">
      <button class="miniBtn" type="button" data-action="addDoc">+ Add document</button>
      <span class="badPill">${list.length} documents</span>
    </div>

    <div class="tableWrap">
      <table class="pvTable">
        <thead>
          <tr>
            <th>Document</th>
            <th>Issued by</th>
            <th>Issue date</th>
            <th>Expiry date</th>
            <th>Time to expire</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          ${list.map((r, idx) => {
    const ex = computeExpiry(r.expiry_date);
    return `
              <tr data-id="${r.id || 'new'}" data-idx="${idx}">
                <td><input class="input" name="name" value="${escapeHtml(safeText(r.name, ""))}" placeholder="e.g. GOC"></td>
                <td><input class="input" name="issued_by" value="${escapeHtml(safeText(r.issued_by, ""))}" placeholder="Issuer"></td>
                <td><input class="input" name="issue_date" type="date" value="${escapeHtml(safeText(r.issue_date, ""))}"></td>
                <td><input class="input" name="expiry_date" type="date" value="${escapeHtml(safeText(r.expiry_date, ""))}"></td>
                <td><span class="badPill">${escapeHtml(ex.label)}</span></td>
                <td><button class="iconBtn" type="button" data-action="removeDoc" title="Remove">✕</button></td>
              </tr>
            `;
  }).join("")}
        </tbody>
      </table>
    </div>
    
    <div style="margin-top:12px;text-align:right;"><button class="btnPrimary" type="button" data-action="saveDocs">Save Documents</button></div>
  `;
  documentsWrap.innerHTML = table;
}

async function loadDocumentsSafe() {
  if (!documentsWrap) return;

  // visibility UI
  const vis = readDocsVisibility();
  docsVisibleToggle.checked = vis !== "private";
  docsVisLabel.textContent = vis === "private" ? "Private" : "Public";

  documentsWrap.innerHTML = "Loading...";

  const { data, error } = await supabase.from("documents").select("*").eq("user_id", me.id).order("id");
  if (error) {
    console.error(error);
    documentsWrap.innerHTML = "Error loading documents.";
    return;
  }
  renderDocs(data || []);
}

documentsWrap?.addEventListener("click", async (e) => {
  const btn = e.target.closest("button[data-action]");
  if (!btn) return;

  const action = btn.dataset.action;
  if (action === "addDoc") {
    const current = scrapeDocsFromDOM();
    current.push({ id: null, name: "", issued_by: "", issue_date: "", expiry_date: "" });
    renderDocs(current);
  }

  if (action === "removeDoc") {
    const tr = btn.closest("tr");
    if (!tr) return;
    const id = tr.dataset.id;

    if (id && id !== "new" && id !== "null") {
      if (!confirm("Delete this document?")) return;
      await supabase.from("documents").delete().eq("id", id).eq("user_id", me.id);
    }
    // simple refresh if we deleted real ID, or just re-render if it was blank row
    if (id && id !== "new" && id !== "null") loadDocumentsSafe();
    else {
      const idx = Number(tr.dataset.idx);
      const current = scrapeDocsFromDOM();
      current.splice(idx, 1);
      renderDocs(current);
    }
  }

  if (action === "saveDocs") {
    console.log("Saving docs...");
    const btn = e.target.closest("button"); // The delegate target might be button inside
    if (btn) {
      btn.disabled = true;
      btn.textContent = "Saving...";
    }

    try {
      const rows = scrapeDocsFromDOM();
      console.log("Scraped docs:", rows);

      for (const r of rows) {
        const payload = {
          user_id: me.id,
          name: r.name,
          issued_by: r.issued_by,
          issue_date: r.issue_date || null,
          expiry_date: r.expiry_date || null
        };
        if (r.id && r.id !== "new" && r.id !== "null") payload.id = r.id;

        const { error } = await supabase.from("documents").upsert(payload);
        if (error) throw error;
      }
      alert("Documents saved!");
      await loadDocumentsSafe();
    } catch (err) {
      console.error(err);
      alert("Save failed: " + err.message);
      if (btn) {
        btn.disabled = false;
        btn.textContent = "Save Documents";
      }
    }
  }
});

function scrapeDocsFromDOM() {
  return Array.from(documentsWrap.querySelectorAll("tbody tr")).map(tr => {
    const inputs = tr.querySelectorAll("input");
    return {
      id: tr.dataset.id === "new" ? null : tr.dataset.id,
      name: safeText(inputs[0]?.value, ""),
      issued_by: safeText(inputs[1]?.value, ""),
      issue_date: safeText(inputs[2]?.value, ""),
      expiry_date: safeText(inputs[3]?.value, ""),
    };
  });
}

docsVisibleToggle?.addEventListener("change", () => {
  const v = docsVisibleToggle.checked ? "public" : "private";
  writeDocsVisibility(v);
  docsVisLabel.textContent = v === "private" ? "Private" : "Public";
});

// ---------- SEA SERVICE (Supabase) ----------
function daysBetween(d1, d2) {
  if (!d1 || !d2) return 0;
  const a = new Date(d1);
  const b = new Date(d2);
  const diff = Math.floor((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24));
  return Math.max(0, diff + 1);
}

function monthsFromDays(days) {
  const m = days / 30.4375;
  return Math.round(m * 10) / 10;
}

function renderSea(rows) {
  const list = Array.isArray(rows) ? rows : [];
  const totalDays = list.reduce((s, r) => s + daysBetween(r.signed_on, r.signed_off), 0);

  // experience per rank
  const byRank = new Map();
  list.forEach(r => {
    const rank = safeText(r.rank, "—");
    const d = daysBetween(r.signed_on, r.signed_off);
    byRank.set(rank, (byRank.get(rank) || 0) + d);
  });

  const rankChips = Array.from(byRank.entries())
    .filter(([k]) => k && k !== "—")
    .sort((a, b) => b[1] - a[1])
    .slice(0, 50)
    .map(([rank, days]) => `<div class="summaryChip">${escapeHtml(rank)}: ${monthsFromDays(days)} mo</div>`)
    .join("");

  seaWrap.innerHTML = `
    <div class="tableActions">
      <button class="miniBtn" type="button" data-action="addSea">+ Add contract</button>
      <span class="badPill">${list.length} contracts</span>
    </div>

    <div class="tableWrap">
      <table class="pvTable">
        <thead>
          <tr>
            <th>Ship name</th>
            <th>IMO</th>
            <th>Sailed as rank</th>
            <th>Signed on</th>
            <th>Signed off</th>
            <th>Days</th>
            <th>Peers verified</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          ${list.map((r, idx) => {
    const d = daysBetween(r.signed_on, r.signed_off);
    const ship = safeText(r.ship_name || r.vessel_name, "");
    const imo = safeText(r.imo || r.vessel_imo, "");
    // Hide dummy "0" if we saved it just to satisfy DB
    const displayImo = imo === "0" || imo === 0 ? "" : imo;

    return `
              <tr data-id="${r.id || 'new'}" data-idx="${idx}">
                <td><input class="input" name="ship_name" value="${escapeHtml(ship)}" placeholder="Ship" /></td>
                <td><input class="input" name="imo" value="${escapeHtml(displayImo)}" placeholder="IMO" /></td>
                <td><input class="input" name="rank" value="${escapeHtml(safeText(r.rank, ""))}" placeholder="Rank" list="rankList" /></td>
                <td><input class="input" name="signed_on" type="date" value="${escapeHtml(safeText(r.signed_on, ""))}" /></td>
                <td><input class="input" name="signed_off" type="date" value="${escapeHtml(safeText(r.signed_off, ""))}" /></td>
                <td><span class="badPill">${d}</span></td>
                <td><span class="badPill">${Number(r.peers_verified || 0)}</span></td>
                <td><button class="iconBtn" type="button" data-action="removeSea" title="Remove">✕</button></td>
              </tr>
            `;
  }).join("")}
        </tbody>
      </table>
    </div>

    <div class="summaryRow">
      <div class="summaryChip">Total sea service: ${monthsFromDays(totalDays)} months (${totalDays} days)</div>
    </div>
    <div class="summaryRow">${rankChips || `<div class="muted">No rank breakdown yet.</div>`}</div>
    
    <div style="margin-top:12px;text-align:right;"><button class="btnPrimary" type="button" data-action="saveSea">Save Sea Service</button></div>
  `;
}

async function loadSeaSafe() {
  if (!seaWrap) return;
  seaWrap.innerHTML = "Loading...";

  const { data, error } = await supabase.from("sea_service").select("*").eq("user_id", me.id).order("id");
  if (error) {
    console.error(error);
    seaWrap.innerHTML = "Error loading sea service.";
    return;
  }
  renderSea(data || []);
}

seaWrap?.addEventListener("click", async (e) => {
  const btn = e.target.closest("button[data-action]");
  if (!btn) return;

  const action = btn.dataset.action;

  if (action === "addSea") {
    const current = scrapeSeaFromDOM();
    current.push({ id: null, ship_name: "", imo: "", rank: "", signed_on: "", signed_off: "", peers_verified: 0 });
    renderSea(current);
  }

  if (action === "removeSea") {
    const tr = btn.closest("tr");
    if (!tr) return;
    const id = tr.dataset.id;

    if (id && id !== "new" && id !== "null") {
      if (!confirm("Delete this contract?")) return;
      await supabase.from("sea_service").delete().eq("id", id).eq("user_id", me.id);
    }

    if (id && id !== "new" && id !== "null") loadSeaSafe();
    else {
      const idx = Number(tr.dataset.idx);
      const current = scrapeSeaFromDOM();
      current.splice(idx, 1);
      renderSea(current);
    }
  }

  if (action === "saveSea") {
    console.log("Saving sea service...");
    const btn = e.target.closest("button");
    if (btn) {
      btn.disabled = true;
      btn.textContent = "Saving...";
    }

    try {
      const rows = scrapeSeaFromDOM();
      console.log("Scraped sea:", rows);

      for (const r of rows) {
        // Handle strict numeric constraints on legacy columns
        const safeImo = r.imo && r.imo.trim() !== "" ? r.imo : 0;

        const payload = {
          user_id: me.id,
          ship_name: r.ship_name,
          vessel_name: r.ship_name, // Legacy fallback
          imo: r.imo,
          vessel_imo: safeImo, // Legacy fallback (0 if empty to valid Not Null)
          rank: r.rank,
          signed_on: r.signed_on || null,
          signed_off: r.signed_off || null,
        };
        if (r.id && r.id !== "new" && r.id !== "null") payload.id = r.id;

        const { error } = await supabase.from("sea_service").upsert(payload);
        if (error) throw error;
      }
      alert("Sea Service saved!");
      await loadSeaSafe();
    } catch (err) {
      console.error(err);
      alert("Save failed: " + err.message);
      if (btn) {
        btn.disabled = false;
        btn.textContent = "Save Sea Service";
      }
    }
  }
});

function scrapeSeaFromDOM() {
  return Array.from(seaWrap.querySelectorAll("tbody tr")).map(tr => {
    const inputs = tr.querySelectorAll("input");
    return {
      id: tr.dataset.id === "new" ? null : tr.dataset.id,
      ship_name: safeText(inputs[0]?.value, ""),
      imo: safeText(inputs[1]?.value, ""),
      rank: safeText(inputs[2]?.value, ""),
      signed_on: safeText(inputs[3]?.value, ""),
      signed_off: safeText(inputs[4]?.value, ""),
      peers_verified: 0
    };
  });
}

// ---------- JOBS (Supabase) ----------
function renderJobs(rows) {
  const list = Array.isArray(rows) ? rows : [];
  jobsWrap.innerHTML = `
    <div class="tableActions">
      <button class="miniBtn" type="button" data-action="addJob">+ New job</button>
      <span class="badPill">${list.length} jobs</span>
    </div>

    ${list.map((j, idx) => `
      <div style="border:1px solid rgba(0,0,0,.06);border-radius:16px;padding:12px;margin:10px 0;background:#fff;" data-id="${j.id || 'new'}" data-idx="${idx}">
        <div style="display:flex;justify-content:space-between;gap:10px;">
          <div style="font-weight:900;font-size:15px;">${escapeHtml(safeText(j.title, "Job title"))}</div>
          <button class="iconBtn" type="button" data-action="removeJob" title="Remove">✕</button>
        </div>
        <div class="aboutGrid" style="margin-top:10px;">
           <div class="box span2"><div class="k">Job Title</div><input class="v input" name="title" value="${escapeHtml(safeText(j.title, ""))}" placeholder="Title"></div>
          <div class="box"><div class="k">Rank</div><input class="v input" name="rank" value="${escapeHtml(safeText(j.rank, ""))}" placeholder="Rank" list="rankList"></div>
          <div class="box"><div class="k">Vessel type</div><input class="v input" name="vessel_type" value="${escapeHtml(safeText(j.vessel_type, ""))}" placeholder="Bulk / Tanker..."></div>
          <div class="box"><div class="k">Salary</div><input class="v input" name="salary" value="${escapeHtml(safeText(j.salary, ""))}" placeholder="e.g. USD 4500"></div>
          <div class="box"><div class="k">Contract</div><input class="v input" name="contract_duration" value="${escapeHtml(safeText(j.contract_duration, ""))}" placeholder="e.g. 6 months"></div>
          
          <div class="box"><div class="k">Location / Port</div><input class="v input" name="location" value="${escapeHtml(safeText(j.location, ""))}" placeholder="Joining port or region"></div>
          <div class="box"><div class="k">Joining Date</div><input class="v input" name="joining_date" type="date" value="${escapeHtml(safeText(j.joining_date, ""))}"></div>
          
          <div class="box span2"><div class="k">Description</div><textarea class="v input textarea" name="description" rows="3" placeholder="Job description...">${escapeHtml(safeText(j.description, ""))}</textarea></div>
          <div class="box span2"><div class="k">Requirements</div><textarea class="v input textarea" name="requirements" rows="2" placeholder="Certifications, Visa, Experience...">${escapeHtml(safeText(j.requirements, ""))}</textarea></div>
          <div class="box span2"><div class="k">Benefits</div><textarea class="v input textarea" name="benefits" rows="2" placeholder="Wifi, Gym, Flight included...">${escapeHtml(safeText(j.benefits, ""))}</textarea></div>
        </div>
      </div>
    `).join("")}
    
    <div style="margin-top:12px;text-align:right;"><button class="btnPrimary" type="button" data-action="saveJobs">Save Jobs</button></div>
  `;
}

async function loadJobsSafe() {
  if (!jobsWrap) return;
  jobsWrap.innerHTML = "Loading...";
  const { data, error } = await supabase.from("jobs").select("*").eq("poster_id", me.id).order("id");
  if (error) {
    console.error(error);
    jobsWrap.innerHTML = "Error loading jobs.";
    return;
  }
  renderJobs(data || []);
}

jobsWrap?.addEventListener("click", async (e) => {
  const btn = e.target.closest("button[data-action]");
  if (!btn) return;

  const action = btn.dataset.action;

  if (action === "addJob") {
    const current = scrapeJobsFromDOM();
    current.unshift({
      id: null,
      title: "New Job",
      rank: "",
      vessel_type: "",
      salary: "",
      contract_duration: "",
      location: "",
      joining_date: "",
      description: "",
      requirements: "",
      benefits: ""
    });
    renderJobs(current);
  }

  if (action === "removeJob") {
    const card = btn.closest("[data-id]");
    if (!card) return;
    const id = card.dataset.id;

    if (id && id !== "new" && id !== "null") {
      if (!confirm("Delete this job?")) return;
      await supabase.from("jobs").delete().eq("id", id).eq("poster_id", me.id);
    }

    if (id && id !== "new" && id !== "null") loadJobsSafe();
    else {
      const idx = Number(card.dataset.idx);
      const current = scrapeJobsFromDOM();
      current.splice(idx, 1);
      renderJobs(current);
    }
  }

  if (action === "saveJobs") {
    btn.disabled = true;
    btn.textContent = "Saving...";
    const rows = scrapeJobsFromDOM();

    for (const r of rows) {
      const payload = {
        poster_id: me.id,
        title: r.title,
        rank: r.rank,
        vessel_type: r.vessel_type,
        salary: r.salary,
        contract_duration: r.contract_duration,
        location: r.location,
        joining_date: r.joining_date || null,
        description: r.description,
        requirements: r.requirements,
        benefits: r.benefits
      };
      if (r.id && r.id !== "new" && r.id !== "null") payload.id = r.id;

      await supabase.from("jobs").upsert(payload);
    }
    await loadJobsSafe();
  }
});

function scrapeJobsFromDOM() {
  const cards = Array.from(jobsWrap.querySelectorAll("[data-id]"));
  return cards.map(card => {
    // We scrape direct inputs by name
    const getVal = (name) => safeText(card.querySelector(`[name="${name}"]`)?.value, "");
    return {
      id: card.dataset.id === "new" ? null : card.dataset.id,
      title: getVal("title") || "Job",
      rank: getVal("rank"),
      vessel_type: getVal("vessel_type"),
      salary: getVal("salary"),
      contract_duration: getVal("contract_duration"),
      location: getVal("location"),
      joining_date: getVal("joining_date"),
      description: getVal("description"),
      requirements: getVal("requirements"),
      benefits: getVal("benefits"),
    };
  });
}

// ---------- EXPERIENCE (Supabase) ----------
function renderExperience(rows) {
  const list = Array.isArray(rows) ? rows : [];
  expWrap.innerHTML = `
    <div class="tableActions">
      <button class="miniBtn" type="button" data-action="addExp">+ Add experience</button>
      <span class="badPill">${list.length} items</span>
    </div>

    ${list.map((x, idx) => `
      <div style="border:1px solid rgba(0,0,0,.06);border-radius:16px;padding:12px;margin:10px 0;background:#fff;" data-id="${x.id || 'new'}" data-idx="${idx}">
        <div style="display:flex;justify-content:space-between;gap:10px;">
          <div style="font-weight:900;">${escapeHtml(safeText(x.company, "Company"))}</div>
          <button class="iconBtn" type="button" data-action="removeExp">✕</button>
        </div>
        <div class="aboutGrid" style="margin-top:10px;">
          <div class="box"><div class="k">Company</div><input class="v input" name="company" value="${escapeHtml(safeText(x.company, ""))}" placeholder="Company" list="companyList"></div>
          <div class="box"><div class="k">Role</div><input class="v input" name="role" value="${escapeHtml(safeText(x.role, ""))}" placeholder="Role"></div>
          <div class="box"><div class="k">From</div><input class="v input" name="start_date" type="date" value="${escapeHtml(safeText(x.start_date, ""))}"></div>
          <div class="box"><div class="k">To</div><input class="v input" name="end_date" type="date" value="${escapeHtml(safeText(x.end_date, ""))}"></div>
          <div class="box span2"><div class="k">Description</div><textarea class="v input textarea" name="description" rows="3" placeholder="What did you do there?">${escapeHtml(safeText(x.description, ""))}</textarea></div>
        </div>
      </div>
    `).join("")}
    
    <div class="summaryRow">
      <div class="muted">Add achievements / extra-curriculars inside descriptions for now.</div>
    </div>
    
    <div style="margin-top:12px;text-align:right;"><button class="btnPrimary" type="button" data-action="saveExp">Save Experience</button></div>
  `;
}

async function loadExperienceSafe() {
  if (!expWrap) return;
  expWrap.innerHTML = "Loading...";
  const { data, error } = await supabase.from("experience").select("*").eq("user_id", me.id).order("id");
  if (error) {
    console.error(error);
    expWrap.innerHTML = "Error loading experience.";
    return;
  }
  renderExperience(data || []);
}

expWrap?.addEventListener("click", async (e) => {
  const btn = e.target.closest("button[data-action]");
  if (!btn) return;

  const action = btn.dataset.action;

  if (action === "addExp") {
    const current = scrapeExpFromDOM();
    current.unshift({ id: null, company: "", role: "", start_date: "", end_date: "", description: "" });
    renderExperience(current);
  }

  if (action === "removeExp") {
    const card = btn.closest("[data-id]");
    if (!card) return;
    const id = card.dataset.id;

    if (id && id !== "new" && id !== "null") {
      if (!confirm("Delete this experience?")) return;
      await supabase.from("experience").delete().eq("id", id).eq("user_id", me.id);
    }

    if (id && id !== "new" && id !== "null") loadExperienceSafe();
    else {
      const idx = Number(card.dataset.idx);
      const current = scrapeExpFromDOM();
      current.splice(idx, 1);
      renderExperience(current);
    }
  }

  if (action === "saveExp") {
    btn.disabled = true;
    btn.textContent = "Saving...";
    const rows = scrapeExpFromDOM();

    for (const r of rows) {
      const payload = {
        user_id: me.id,
        company: r.company,
        role: r.role,
        start_date: r.start_date || null,
        end_date: r.end_date || null,
        description: r.description
      };
      if (r.id && r.id !== "new" && r.id !== "null") payload.id = r.id;

      await supabase.from("experience").upsert(payload);

      // Also update shared company list
      if (r.company) addCompanyToDb(r.company);
    }

    await loadExperienceSafe();
  }
});

function scrapeExpFromDOM() {
  const cards = Array.from(expWrap.querySelectorAll("[data-id]"));
  return cards.map(card => {
    const getVal = (name) => safeText(card.querySelector(`[name="${name}"]`)?.value, "");
    return {
      id: card.dataset.id === "new" ? null : card.dataset.id,
      company: getVal("company"),
      role: getVal("role"),
      start_date: getVal("start_date"),
      end_date: getVal("end_date"),
      description: getVal("description"),
    };
  });
}

// ---------- avatar edit button (UI only) ----------
avatarEditBtn?.addEventListener("click", () => {
  // We do NOT change upload/crop logic here.
  // This is only the icon replacement. You can connect this to your existing avatar editor if needed.
  alert("Avatar editor is handled in your existing upload/crop flow. (No changes made to that system.)");
});

// ---------- main events ----------
editBtn?.addEventListener("click", () => setEditing(true));

saveBtn?.addEventListener("click", async () => {
  try {
    saveBtn.disabled = true;
    saveBtn.textContent = "Saving…";
    await saveProfile();
  } catch (e) {
    console.error("Save failed:", e);
    alert("Save failed: " + (e.message || "Unknown error"));
  } finally {
    saveBtn.disabled = false;
    saveBtn.textContent = "Save";
  }
});

// Company email events
c.addEmailBtn?.addEventListener("click", () => addCompanyEmailRow({ email: "", purpose: "" }));

c.emailsWrap?.addEventListener("click", (e) => {
  const btn = e.target.closest('button[data-action="removeEmail"]');
  if (!btn) return;
  const row = btn.closest(".multiRow");
  const idx = Number(row?.dataset?.idx || -1);
  if (idx < 0) return;
  const current = readCompanyEmails();
  current.splice(idx, 1);
  paintCompanyEmails(current);
});

// ---------- init ----------
(async () => {
  try {
    paintRankDatalist();
    await paintCompanyDatalist();
    await loadProfile();
  } catch (e) {
    console.error("Profile load error:", e);
    alert("Profile load failed: " + (e.message || "Unknown error"));
  }
})();
