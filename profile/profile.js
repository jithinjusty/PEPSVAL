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
  services: document.getElementById("c_services"),
  achievements: document.getElementById("c_achievements"),
  vision: document.getElementById("c_vision"),
  mission: document.getElementById("c_mission"),
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

  // Add Request Verification button if not verified
  if (!profile?.is_verified) {
    const vBtn = document.createElement("button");
    vBtn.className = "tab";
    vBtn.style.color = "var(--brand)";
    vBtn.textContent = "Get Verified";
    vBtn.onclick = () => alert("Verification request submitted! We will review your documents soon.");
    elTabs.appendChild(vBtn);
  }

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
  elProfileName.innerHTML = name;

  if (profile?.is_verified) {
    elProfileName.innerHTML += ` <span class="v-badge" title="Verified Member">✅</span>`;
  }

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
    .select("id, full_name, rank, nationality, bio, email, avatar_url, account_type, dob, phone, company_name, role, vision, mission, services, achievements, company_emails")
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
  if (c.services) c.services.value = safeText(profile?.services, "");
  if (c.achievements) c.achievements.value = safeText(profile?.achievements, "");
  if (c.vision) c.vision.value = safeText(profile?.vision, "");
  if (c.mission) c.mission.value = safeText(profile?.mission, "");
  paintCompanyEmails(profile?.company_emails || []);

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

  const updates = {
    updated_at: new Date().toISOString()
  };

  // Use the existing account KIND for logic
  const logicalKind = accountKind;

  if (logicalKind === "seafarer") {
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
    updates.services = safeText(c.services.value, null);
    updates.achievements = safeText(c.achievements.value, null);
    updates.vision = safeText(c.vision.value, null);
    updates.mission = safeText(c.mission.value, null);
    updates.company_emails = readCompanyEmails();

    updates.account_type = "employer"; // DB uses 'employer' or 'company' depending on strictness, staying consistent with initial code (employer)

    if (updates.company_name) addCompanyToDb(updates.company_name);
  }

  if (logicalKind === "professional") {
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
  accountKind = getAccountKind(profile?.account_type);
  paintHeader();
  buildTabs();
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
        <article class="pv-post animate-slide-up" style="margin-bottom:20px;">
          <div style="display:flex;justify-content:space-between;gap:12px;align-items:center;margin-bottom:12px;">
            <div style="font-weight:800; color:var(--text-main);">${escapeHtml(profile?.full_name || profile?.company_name || "Me")}</div>
            <div style="display:flex;gap:8px;align-items:center;">
              <select data-action="postVis" data-id="${id}" class="pv-input" style="padding:4px 12px; width:auto; font-size:12px;">
                <option value="public" ${vis === "public" ? "selected" : ""}>Public</option>
                <option value="hide" ${vis === "hide" ? "selected" : ""}>Hide</option>
                <option value="private" ${vis === "private" ? "selected" : ""}>Private</option>
              </select>
              <button class="pv-btn pv-btn-ghost" style="padding:4px 10px; color:var(--danger); border-color:var(--stroke);" type="button" data-action="deletePost" data-id="${id}" title="Delete">✕</button>
            </div>
          </div>
          <div style="font-size:11px; color:var(--text-muted); margin-bottom:12px;">${escapeHtml(formatDate(r.created_at || r.inserted_at || ""))}</div>
          ${text ? `<div style="font-size:15px; line-height:1.6; color:var(--text-main); white-space:pre-wrap;">${escapeHtml(text)}</div>` : ``}
          ${mediaHtml ? `<div style="margin-top:12px;">${mediaHtml}</div>` : ``}
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
      <button class="pv-btn pv-btn-primary" type="button" data-action="addDoc">+ Add Document</button>
      <span class="badge">${list.length} Total</span>
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
    const sOn = safeText(r.signed_on || r.sign_on, "");
    const sOff = safeText(r.signed_off || r.sign_off, "");
    // Hide dummy dates
    const displayOn = sOn === "1970-01-01" ? "" : sOn;
    const displayOff = sOff === "1970-01-01" ? "" : sOff;

    // We compute duration using the best available dates
    const d = daysBetween(displayOn, displayOff);
    const ship = safeText(r.ship_name || r.vessel_name, "");
    const imo = safeText(r.imo || r.vessel_imo, "");
    // Hide dummy "0" if we saved it just to satisfy DB
    const displayImo = imo === "0" || imo === 0 ? "" : imo;

    return `
              <tr data-id="${r.id || 'new'}" data-idx="${idx}">
                <td><input class="input" name="ship_name" value="${escapeHtml(ship)}" placeholder="Ship" /></td>
                <td><input class="input" name="imo" value="${escapeHtml(displayImo)}" placeholder="IMO (Number)" oninput="this.value=this.value.replace(/[^0-9]/g,'')" /></td>
                <td><input class="input" name="rank" value="${escapeHtml(safeText(r.rank, ""))}" placeholder="Rank" list="rankList" /></td>
                <td><input class="input" name="signed_on" type="date" value="${escapeHtml(displayOn)}" /></td>
                <td><input class="input" name="signed_off" type="date" value="${escapeHtml(displayOff)}" /></td>
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

        // Handle strict date constraints (some legacy DBs are Not Null)
        const safeDate = (dt) => (dt && dt !== "") ? dt : "1970-01-01";

        const payload = {
          user_id: me.id,
          ship_name: r.ship_name,
          vessel_name: r.ship_name,
          imo: r.imo,
          vessel_imo: safeImo,
          rank: r.rank,

          // Modern columns (can be null)
          signed_on: r.signed_on || null,
          signed_off: r.signed_off || null,

          // Legacy columns (strict Not Null)
          sign_on: safeDate(r.signed_on),
          sign_off: safeDate(r.signed_off)
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
// ---------- JOBS (Supabase) ----------
function renderJobs(rows) {
  const list = Array.isArray(rows) ? rows : [];
  jobsWrap.innerHTML = `
    <div class="tableActions">
      <button class="miniBtn" type="button" data-action="addJob">+ Create New Job Post</button>
      <span class="badPill">${list.length} active posts</span>
    </div>

    ${list.map((j, idx) => {
    const tags = Array.isArray(j.tags) ? j.tags : (j.tags ? j.tags.split(",") : []);
    const isUrgent = tags.some(t => t.trim().toUpperCase() === "URGENT");

    return `
      <div class="jobCard" data-id="${j.id}" data-idx="${idx}">
        <div class="jobHeader">
          <div class="jobTitleGroup">
            <div class="jobTitleText">${escapeHtml(j.title)}</div>
            <div class="jobSubText">
              <span>${escapeHtml(j.rank || "Any Rank")}</span>
              ${j.vessel_type ? `• <span>${escapeHtml(j.vessel_type)}</span>` : ""}
            </div>
          </div>
          <div class="jobBadge ${isUrgent ? 'urgent' : ''}">${isUrgent ? 'Urgent' : 'Active'}</div>
        </div>

        <div class="jobGrid">
          <div class="jobItem"><div class="jobLabel">Salary</div><div class="jobValue">${escapeHtml(j.salary || "Not specified")}</div></div>
          <div class="jobItem"><div class="jobLabel">Duration</div><div class="jobValue">${escapeHtml(j.contract_duration || "Not specified")}</div></div>
          <div class="jobItem"><div class="jobLabel">Location</div><div class="jobValue">${escapeHtml(j.location || "Anywhere")}</div></div>
          <div class="jobItem"><div class="jobLabel">Joining</div><div class="jobValue">${j.joining_date ? escapeHtml(j.joining_date) : "TBA"}</div></div>
        </div>

        ${j.description ? `
        <div class="jobDescWrap">
          <div class="k">Brief Description</div>
          <div style="display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;opacity:.8;">${escapeHtml(j.description)}</div>
        </div>
        ` : ""}

        <div class="jobActions">
          <button class="btnGhost" type="button" data-action="editJob">Edit Post</button>
          <button class="iconBtn" type="button" data-action="removeJob" title="Delete">✕</button>
        </div>
      </div>
      `;
  }).join("")}
    
    ${list.length === 0 ? `<div class="muted" style="padding:20px;text-align:center;border:1px dashed var(--line);border-radius:20px;">No jobs posted yet. Click "+ Create New Job Post" to start.</div>` : ""}
  `;
}

// Global cached jobs for easy access during edit
let currentJobs = [];

async function loadJobsSafe() {
  if (!jobsWrap) return;
  jobsWrap.innerHTML = "<div class='muted' style='padding:20px;'>Loading jobs...</div>";
  const { data, error } = await supabase.from("jobs").select("*").eq("poster_id", me.id).order("created_at", { ascending: false });
  if (error) {
    console.error(error);
    jobsWrap.innerHTML = "Error loading jobs.";
    return;
  }
  currentJobs = data || [];
  renderJobs(currentJobs);
}

// Modal Elements
const jobModal = document.getElementById("jobModal");
const jobForm = document.getElementById("jobForm");

function openJobModal(job = null) {
  if (!jobModal || !jobForm) return;

  // Reset form
  jobForm.reset();
  document.getElementById("j_id").value = job?.id || "";
  document.getElementById("j_title").value = job?.title || "";
  document.getElementById("j_rank").value = job?.rank || "";
  document.getElementById("j_vessel_name").value = job?.vessel_name || "";
  document.getElementById("j_vessel_type").value = job?.vessel_type || "";
  document.getElementById("j_contract_type").value = job?.contract_type || "Temporary";
  document.getElementById("j_salary").value = job?.salary || "";
  document.getElementById("j_duration").value = job?.contract_duration || "";
  document.getElementById("j_location").value = job?.location || "";
  document.getElementById("j_joining_date").value = job?.joining_date || "";
  document.getElementById("j_description").value = job?.description || "";
  document.getElementById("j_requirements").value = job?.requirements || "";
  document.getElementById("j_benefits").value = job?.benefits || "";
  document.getElementById("j_tags").value = Array.isArray(job?.tags) ? job.tags.join(", ") : (job?.tags || "");

  document.getElementById("jobModalTitle").textContent = job ? "Edit Job Post" : "Create New Job Post";
  document.getElementById("saveJobBtn").textContent = job ? "Update Job Post" : "Publish Job Post";

  jobModal.classList.remove("hidden");
}

function closeJobModal() {
  jobModal.classList.add("hidden");
}

document.getElementById("closeJobModal")?.addEventListener("click", closeJobModal);
document.getElementById("cancelJobBtn")?.addEventListener("click", closeJobModal);

jobForm?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const btn = document.getElementById("saveJobBtn");
  btn.disabled = true;
  btn.textContent = "Saving...";

  const jobId = document.getElementById("j_id").value;
  const payload = {
    poster_id: me.id,
    title: document.getElementById("j_title").value,
    rank: document.getElementById("j_rank").value,
    vessel_name: document.getElementById("j_vessel_name").value,
    vessel_type: document.getElementById("j_vessel_type").value,
    contract_type: document.getElementById("j_contract_type").value,
    salary: document.getElementById("j_salary").value,
    contract_duration: document.getElementById("j_duration").value,
    location: document.getElementById("j_location").value,
    joining_date: document.getElementById("j_joining_date").value || null,
    description: document.getElementById("j_description").value,
    requirements: document.getElementById("j_requirements").value,
    benefits: document.getElementById("j_benefits").value,
    tags: document.getElementById("j_tags").value.split(",").map(s => s.trim()).filter(Boolean),
  };

  try {
    if (jobId) {
      const { error } = await supabase.from("jobs").update(payload).eq("id", jobId).eq("poster_id", me.id);
      if (error) throw error;
    } else {
      const { error } = await supabase.from("jobs").insert([payload]);
      if (error) throw error;
    }
    closeJobModal();
    loadJobsSafe();
  } catch (err) {
    alert("Error saving job: " + err.message);
  } finally {
    btn.disabled = false;
    btn.textContent = jobId ? "Update Job Post" : "Publish Job Post";
  }
});

jobsWrap?.addEventListener("click", async (e) => {
  const btn = e.target.closest("button[data-action]");
  if (!btn) return;

  const action = btn.dataset.action;
  const card = btn.closest("[data-id]");
  const jobId = card?.dataset.id;
  const jobIdx = card?.dataset.idx;

  if (action === "addJob") {
    openJobModal();
  }

  if (action === "editJob") {
    const job = currentJobs[jobIdx];
    if (job) openJobModal(job);
  }

  if (action === "removeJob") {
    if (!jobId) return;
    if (!confirm("Delete this job post permanently?")) return;
    try {
      const { error } = await supabase.from("jobs").delete().eq("id", jobId).eq("poster_id", me.id);
      if (error) throw error;
      loadJobsSafe();
    } catch (err) {
      alert("Error deleting job: " + err.message);
    }
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

// ---------- Avatar Upload with Filters ----------
const avatarModal = document.getElementById("avatarModal");
const avatarInput = document.getElementById("avatarInput");
const selectImageBtn = document.getElementById("selectImageBtn");
const avatarSelectView = document.getElementById("avatarSelectView");
const avatarEditView = document.getElementById("avatarEditView");
const avatarCanvas = document.getElementById("avatarCanvas");
const closeAvatarModal = document.getElementById("closeAvatarModal");
const uploadAvatarBtn = document.getElementById("uploadAvatarBtn");
const cancelAvatarBtn = document.getElementById("cancelAvatarBtn");

const zoomSlider = document.getElementById("zoom");
const brightnessSlider = document.getElementById("brightness");
const contrastSlider = document.getElementById("contrast");
const saturationSlider = document.getElementById("saturation");
const blurSlider = document.getElementById("blur");

let originalImage = null;
let ctx = null;
let zoom = 1.0;
let offsetX = 0;
let offsetY = 0;
let isDragging = false;
let dragStartX = 0;
let dragStartY = 0;

const filterPresets = {
  normal: { brightness: 100, contrast: 100, saturation: 100, blur: 0 },
  grayscale: { brightness: 100, contrast: 110, saturation: 0, blur: 0 },
  sepia: { brightness: 110, contrast: 90, saturation: 80, blur: 0, sepia: true },
  vintage: { brightness: 105, contrast: 120, saturation: 70, blur: 1 },
  cool: { brightness: 95, contrast: 105, saturation: 110, blur: 0, cool: true },
  warm: { brightness: 105, contrast: 100, saturation: 115, blur: 0, warm: true }
};

function openAvatarModal() {
  avatarModal.classList.remove("hidden");
  avatarSelectView.classList.remove("hidden");
  avatarEditView.classList.add("hidden");
}

function closeAvatarModalFn() {
  avatarModal.classList.add("hidden");
  originalImage = null;
  if (avatarInput) avatarInput.value = "";
}

avatarEditBtn?.addEventListener("click", openAvatarModal);
closeAvatarModal?.addEventListener("click", closeAvatarModalFn);
cancelAvatarBtn?.addEventListener("click", closeAvatarModalFn);

// Click overlay to close
avatarModal?.querySelector(".modalOverlay")?.addEventListener("click", closeAvatarModalFn);

selectImageBtn?.addEventListener("click", () => {
  avatarInput?.click();
});

avatarInput?.addEventListener("change", (e) => {
  const file = e.target.files[0];
  if (!file) return;

  // Check file size (max 5MB)
  if (file.size > 5 * 1024 * 1024) {
    alert("Image too large. Please select an image under 5MB.");
    return;
  }

  const reader = new FileReader();
  reader.onload = (event) => {
    const img = new Image();
    img.onload = () => {
      originalImage = img;

      // Set canvas size (square, max 500px)
      const size = Math.min(img.width, img.height, 500);
      avatarCanvas.width = size;
      avatarCanvas.height = size;
      ctx = avatarCanvas.getContext("2d");

      // Show edit view
      avatarSelectView.classList.add("hidden");
      avatarEditView.classList.remove("hidden");

      // Reset sliders and position
      zoomSlider.value = 100;
      brightnessSlider.value = 100;
      contrastSlider.value = 100;
      saturationSlider.value = 100;
      blurSlider.value = 0;
      zoom = 1.0;
      offsetX = 0;
      offsetY = 0;

      // Render initial image
      applyFilters();
    };
    img.src = event.target.result;
  };
  reader.readAsDataURL(file);
});

function applyFilters() {
  if (!originalImage || !ctx) return;

  const size = avatarCanvas.width;

  // Clear canvas
  ctx.clearRect(0, 0, size, size);

  // Calculate zoomed size
  const scaledSize = size * zoom;

  // Calculate source crop (center of original image)
  const sourceSize = Math.min(originalImage.width, originalImage.height);
  const sx = (originalImage.width - sourceSize) / 2;
  const sy = (originalImage.height - sourceSize) / 2;

  // Calculate destination with zoom and offset
  const dx = (size - scaledSize) / 2 + offsetX;
  const dy = (size - scaledSize) / 2 + offsetY;

  // Apply CSS filters
  const brightness = brightnessSlider.value;
  const contrast = contrastSlider.value;
  const saturation = saturationSlider.value;
  const blur = blurSlider.value;

  ctx.filter = `brightness(${brightness}%) contrast(${contrast}%) saturate(${saturation}%) blur(${blur}px)`;

  // Draw image with zoom and pan
  ctx.drawImage(originalImage, sx, sy, sourceSize, sourceSize, dx, dy, scaledSize, scaledSize);
  ctx.filter = "none";
}

// Live filter and zoom updates
zoomSlider?.addEventListener("input", () => {
  zoom = zoomSlider.value / 100;
  applyFilters();
});
brightnessSlider?.addEventListener("input", applyFilters);
contrastSlider?.addEventListener("input", applyFilters);
saturationSlider?.addEventListener("input", applyFilters);
blurSlider?.addEventListener("input", applyFilters);

// Pan with mouse drag
avatarCanvas?.addEventListener("mousedown", (e) => {
  isDragging = true;
  dragStartX = e.offsetX;
  dragStartY = e.offsetY;
  avatarCanvas.style.cursor = "grabbing";
});

avatarCanvas?.addEventListener("mousemove", (e) => {
  if (!isDragging) return;

  const dx = e.offsetX - dragStartX;
  const dy = e.offsetY - dragStartY;

  offsetX += dx;
  offsetY += dy;

  dragStartX = e.offsetX;
  dragStartY = e.offsetY;

  applyFilters();
});

avatarCanvas?.addEventListener("mouseup", () => {
  isDragging = false;
  avatarCanvas.style.cursor = "grab";
});

avatarCanvas?.addEventListener("mouseleave", () => {
  isDragging = false;
  avatarCanvas.style.cursor = "grab";
});

// Touch support for mobile
avatarCanvas?.addEventListener("touchstart", (e) => {
  e.preventDefault();
  const touch = e.touches[0];
  const rect = avatarCanvas.getBoundingClientRect();
  isDragging = true;
  dragStartX = touch.clientX - rect.left;
  dragStartY = touch.clientY - rect.top;
});

avatarCanvas?.addEventListener("touchmove", (e) => {
  if (!isDragging) return;
  e.preventDefault();

  const touch = e.touches[0];
  const rect = avatarCanvas.getBoundingClientRect();
  const x = touch.clientX - rect.left;
  const y = touch.clientY - rect.top;

  const dx = x - dragStartX;
  const dy = y - dragStartY;

  offsetX += dx;
  offsetY += dy;

  dragStartX = x;
  dragStartY = y;

  applyFilters();
});

avatarCanvas?.addEventListener("touchend", () => {
  isDragging = false;
});

// Preset filters
document.querySelectorAll(".filterBtn").forEach(btn => {
  btn.addEventListener("click", () => {
    const filter = btn.dataset.filter;
    const preset = filterPresets[filter];

    if (preset) {
      brightnessSlider.value = preset.brightness;
      contrastSlider.value = preset.contrast;
      saturationSlider.value = preset.saturation;
      blurSlider.value = preset.blur || 0;
      applyFilters();
    }

    // Update active state
    document.querySelectorAll(".filterBtn").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
  });
});

uploadAvatarBtn?.addEventListener("click", async () => {
  if (!me || !avatarCanvas) return;

  uploadAvatarBtn.disabled = true;
  uploadAvatarBtn.textContent = "Uploading...";

  try {
    // Convert canvas to blob
    const blob = await new Promise(resolve => avatarCanvas.toBlob(resolve, "image/jpeg", 0.9));

    // Generate unique filename
    const fileName = `${me.id}/${Date.now()}.jpg`;

    // Upload to Supabase Storage
    const { data, error } = await supabase.storage
      .from("avatars")
      .upload(fileName, blob, {
        cacheControl: "3600",
        upsert: true
      });

    if (error) throw error;

    // Get public URL
    const { data: urlData } = supabase.storage
      .from("avatars")
      .getPublicUrl(fileName);

    const avatarUrl = urlData.publicUrl;

    // Update profile
    const { error: updateError } = await supabase
      .from("profiles")
      .update({ avatar_url: avatarUrl })
      .eq("id", me.id);

    if (updateError) throw updateError;

    // Update UI
    setAvatar(avatarUrl, profile?.full_name || profile?.company_name || "User");

    alert("Profile photo updated!");
    closeAvatarModalFn();

  } catch (err) {
    console.error("Upload failed:", err);
    alert("Upload failed: " + err.message);
  } finally {
    uploadAvatarBtn.disabled = false;
    uploadAvatarBtn.textContent = "Upload & Save";
  }
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

// ---------- logout ----------
const sidebarLogoutBtn = document.getElementById("sidebarLogout");
sidebarLogoutBtn?.addEventListener("click", async () => {
  try {
    sidebarLogoutBtn.disabled = true;
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    window.location.href = "/auth/login.html";
  } catch (err) {
    alert("Logout failed: " + err.message);
    sidebarLogoutBtn.disabled = false;
  }
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
