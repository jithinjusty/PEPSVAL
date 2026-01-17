import { supabase, getCurrentUser } from "/js/supabase.js";

/* ---------------- DOM ---------------- */
const card = document.getElementById("profileCard");

const editBtn = document.getElementById("editProfileBtn");
const saveBtn = document.getElementById("saveProfileBtn");

const avatarBtn = document.getElementById("avatarBtn");
const avatarFile = document.getElementById("avatarFile");
const avatarImg = document.getElementById("avatarImg");
const avatarFallback = document.getElementById("avatarFallback");
const typeBadge = document.getElementById("typeBadge");

const elProfileName = document.getElementById("profileName");
const elMiniRank = document.getElementById("miniRank");
const elMiniNationality = document.getElementById("miniNationality");

const miniLabel1 = document.getElementById("miniLabel1");
const miniLabel2 = document.getElementById("miniLabel2");

const k_fullName = document.getElementById("k_fullName");
const k_rank = document.getElementById("k_rank");
const k_nationality = document.getElementById("k_nationality");
const k_lastVessel = document.getElementById("k_lastVessel");
const k_availability = document.getElementById("k_availability");
const overviewTitle = document.getElementById("overviewTitle");
const overviewHint = document.getElementById("overviewHint");

const tabBtn_jobs = document.getElementById("tabBtn_jobs");
const tabBtn_experience = document.getElementById("tabBtn_experience");

const tab_jobs = document.getElementById("tab_jobs");
const tab_experience = document.getElementById("tab_experience");

const postsWrap = document.getElementById("postsWrap");
const documentsWrap = document.getElementById("documentsWrap");
const jobsWrap = document.getElementById("jobsWrap");
const experienceWrap = document.getElementById("experienceWrap");
const mediaWrap = document.getElementById("mediaWrap"); // Kept just in case, but unused in new layout

const fields = {
  full_name: document.getElementById("fullName"),
  rank: document.getElementById("rank"),
  nationality: document.getElementById("nationality"),
  lastVessel: document.getElementById("lastVessel"),
  availability: document.getElementById("availability"),
  availability: document.getElementById("availability"),
  bio: document.getElementById("bio"),
  email: document.getElementById("email"),
  box_lastVessel: document.getElementById("box_lastVessel"),
};

const toastEl = document.getElementById("toast");

/* ---------------- State ---------------- */
let currentUser = null;
let currentUserId = null;
let currentAccountKind = "seafarer"; // seafarer | company | professional | other

/* ---------------- Helpers ---------------- */
function toast(msg) {
  if (!toastEl) return alert(msg);
  toastEl.textContent = msg;
  toastEl.style.opacity = "1";
  toastEl.style.transform = "translateX(-50%) translateY(0)";
  setTimeout(() => {
    toastEl.style.opacity = "0";
    toastEl.style.transform = "translateX(-50%) translateY(8px)";
  }, 2200);
}

function safeText(v, fallback = "—") {
  const t = (v ?? "").toString().trim();
  return t.length ? t : fallback;
}

function normalizeEditableValue(v) {
  const t = (v ?? "").toString().trim();
  if (!t || t === "—") return null;
  return t;
}

function initialsFromName(name) {
  const parts = (name || "").trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "P";
  const first = parts[0][0] || "";
  const last = (parts.length > 1 ? parts[parts.length - 1][0] : "") || "";
  return (first + last).toUpperCase() || "P";
}

function setEditable(state) {
  const editableEls = [
    fields.full_name,
    fields.rank,
    fields.nationality,
    fields.lastVessel,
    fields.availability,
    fields.bio,
  ];
  editableEls.forEach(el => { if (el) el.contentEditable = state; });

  card?.classList.toggle("is-editing", state);
  editBtn?.classList.toggle("hidden", state);
  saveBtn?.classList.toggle("hidden", !state);
}

function looksLikeUrl(v) {
  const s = (v || "").trim().toLowerCase();
  return s.startsWith("http://") || s.startsWith("https://") || s.startsWith("data:");
}

function publicAvatarUrlFromPath(path) {
  if (!path) return "";
  const { data } = supabase.storage.from("avatars").getPublicUrl(path);
  return data?.publicUrl || "";
}

function setAvatar(avatarUrlOrPath, nameForInitials) {
  const raw = (avatarUrlOrPath || "").toString().trim();
  const finalUrl = raw ? (looksLikeUrl(raw) ? raw : publicAvatarUrlFromPath(raw)) : "";

  if (finalUrl) {
    avatarImg.src = finalUrl;
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

function setAccountTypeBadge(account_type, account_type_label) {
  const label = (account_type_label || account_type || "").toString().trim();
  if (!label) {
    typeBadge.classList.add("hidden");
    typeBadge.textContent = "";
    return;
  }
  typeBadge.classList.remove("hidden");
  typeBadge.textContent = label;
}

function pickFirst(obj, keys, fallback = "") {
  for (const k of keys) {
    if (obj && obj[k] != null && String(obj[k]).trim() !== "") return obj[k];
  }
  return fallback;
}

function detectAccountKind(p) {
  const label = (p?.account_type_label || p?.account_type || "").toString().toLowerCase();

  if (label.includes("seafarer")) return "seafarer";
  if (label.includes("company") || label.includes("institute") || label.includes("employer")) return "company";
  if (label.includes("professional") || label.includes("shore")) return "professional";
  return "other";
}

function show(el) { el && el.classList.remove("hidden"); }
function hide(el) { el && el.classList.add("hidden"); }

function renderCompanyExperience(wrap, p) {
  if (!wrap) return;
  // Extended Company Details
  const companyName = pickFirst(p, ["company_name", "company"], "—");
  const dept = pickFirst(p, ["rank", "department"], "—");
  const type = pickFirst(p, ["role", "business_type"], "—");
  const country = pickFirst(p, ["nationality", "country"], "—");

  const mission = pickFirst(p, ["mission", "vision"], "—");
  const employees = pickFirst(p, ["employees", "team_size"], "—");
  const location = pickFirst(p, ["address", "location"], country); // Fallback to country
  const services = pickFirst(p, ["services", "products"], "—");
  const contact = pickFirst(p, ["contact", "phone", "email_contact"], "—");

  wrap.innerHTML = `
    <div class="aboutGrid">
      <div class="box">
        <div class="k">Company Name</div>
        <div class="v">${safeText(companyName)}</div>
      </div>
      <div class="box">
        <div class="k">Department / Contact</div>
        <div class="v">${safeText(dept)}</div>
      </div>
      <div class="box">
        <div class="k">Business Type</div>
        <div class="v">${safeText(type)}</div>
      </div>
      <div class="box">
        <div class="k">Location</div>
        <div class="v">${safeText(location)}</div>
      </div>
      
      <div class="box span2">
        <div class="k">Mission & Vision</div>
        <div class="v">${safeText(mission)}</div>
      </div>
      
      <div class="box">
        <div class="k">Employees</div>
        <div class="v">${safeText(employees)}</div>
      </div>
       <div class="box">
        <div class="k">Contact Info</div>
        <div class="v">${safeText(contact)}</div>
      </div>
      
      <div class="box span2">
        <div class="k">Services</div>
        <div class="v">${safeText(services)}</div>
      </div>
    </div>
  `;
}

function applyLayout(kind) {
  currentAccountKind = kind;

  // Common: Hide Last Vessel in About Tab (Redundant)
  if (fields.box_lastVessel) fields.box_lastVessel.classList.add("hidden");

  // Reset all tabs first
  [tabBtn_experience, tabBtn_jobs, document.getElementById("tabBtn_documents")].forEach(hide);

  // Seafarer: About, Documents, Posts, Sea Service
  if (kind === "seafarer") {
    if (overviewTitle) overviewTitle.textContent = "Overview";
    if (overviewHint) overviewHint.textContent = "Your profile is your identity on Pepsval. Verified details increase trust and visibility.";

    show(document.getElementById("tabBtn_documents")); // Show Documents
    show(tabBtn_experience);
    tabBtn_experience.textContent = "Sea Service";

    // Labels
    if (miniLabel1) miniLabel1.textContent = "Rank";
    if (miniLabel2) miniLabel2.textContent = "Nationality";
    if (k_fullName) k_fullName.textContent = "Full Name";
    if (k_rank) k_rank.textContent = "Rank";
    if (k_nationality) k_nationality.textContent = "Nationality";
    if (k_availability) k_availability.textContent = "Availability / Job Title";
    return;
  }

  // Company: About, Posts, Jobs, Details
  if (kind === "company") {
    if (overviewTitle) overviewTitle.textContent = "Company Profile";
    if (overviewHint) overviewHint.textContent = "Keep your company profile accurate. Verified details improve trust with seafarers.";

    show(tabBtn_jobs);
    show(tabBtn_experience);
    tabBtn_experience.textContent = "Company Details";

    // Labels
    if (miniLabel1) miniLabel1.textContent = "Category";
    if (miniLabel2) miniLabel2.textContent = "Country";
    if (k_fullName) k_fullName.textContent = "Company / Institute Name";
    if (k_rank) k_rank.textContent = "Department / Contact"; // In About
    if (k_nationality) k_nationality.textContent = "Country";
    if (k_availability) k_availability.textContent = "Business Type / Role"; // In About
    return;
  }

  // Professional: About, Posts, Experience
  if (kind === "professional") {
    if (overviewTitle) overviewTitle.textContent = "Professional Profile";
    if (overviewHint) overviewHint.textContent = "A strong professional profile helps companies and seafarers trust your experience.";

    show(tabBtn_experience);
    tabBtn_experience.textContent = "Experience";

    // Labels
    if (miniLabel1) miniLabel1.textContent = "Role";
    if (miniLabel2) miniLabel2.textContent = "Country";
    if (k_fullName) k_fullName.textContent = "Full Name";
    if (k_rank) k_rank.textContent = "Specialty / Position";
    if (k_nationality) k_nationality.textContent = "Country";
    if (k_availability) k_availability.textContent = "Role / Job Title";
    return;
  }

  // Other layout fallback
  if (overviewTitle) overviewTitle.textContent = "Profile";
}

/* ---------------- Tabs ---------------- */
/* ---------------- Tabs ---------------- */
let globalProfileData = null; // Store profile data to reuse in generic tabs

function initTabs() {
  const tabs = Array.from(document.querySelectorAll(".tab"));
  const panes = {
    about: document.getElementById("tab_about"),
    posts: document.getElementById("tab_posts"),
    documents: document.getElementById("tab_documents"),
    jobs: document.getElementById("tab_jobs"),
    experience: document.getElementById("tab_experience"),
    // media: document.getElementById("tab_media"), // Removed
  };

  function activate(key) {
    tabs.forEach(t => t.classList.toggle("active", t.dataset.tab === key));
    Object.entries(panes).forEach(([k, el]) => {
      if (!el) return;
      el.classList.toggle("hidden", k !== key);
    });

    if (key === "posts") loadMyPosts().catch(console.error);
    if (key === "documents") loadGenericTab(documentsWrap, ["documents", "user_documents", "profile_documents"]).catch(console.error);
    if (key === "jobs") loadGenericTab(jobsWrap, ["jobs", "company_jobs"]).catch(console.error); // Placeholder logic for Jobs

    if (key === "experience") {
      if (currentAccountKind === "company") {
        renderCompanyExperience(experienceWrap, globalProfileData || {});
      } else {
        // Seafarer or Professional
        loadGenericTab(experienceWrap, ["sea_service", "sea_services", "sea_time", "sea_entries", "experience", "work_history"]).catch(console.error);
      }
    }
  }

  tabs.forEach(t => t.addEventListener("click", () => activate(t.dataset.tab)));
  activate("about");
}

/* ---------------- Profile data ---------------- */
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
    };
    const { error: insErr } = await supabase.from("profiles").insert(insertPayload);
    if (insErr) throw insErr;
  }
}

async function fetchProfile(userId) {
  // select("*") prevents missing-column crashes when schema changes
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .maybeSingle();

  if (error) throw error;
  return data;
}

async function loadProfile() {
  currentUser = await getCurrentUser();
  if (!currentUser) {
    window.location.href = "/auth/login.html";
    return;
  }
  currentUserId = currentUser.id;

  await ensureProfileRow(currentUser);

  const p = await fetchProfile(currentUserId);

  // Decide layout first
  const kind = detectAccountKind(p);
  applyLayout(kind);

  const fullName = pickFirst(p, ["full_name", "name"], "");
  const email = pickFirst(p, ["email"], currentUser.email || "");
  const nationality = pickFirst(p, ["nationality", "country"], "");

  // Setup page uses: company_name + role + rank(for seafarer)
  // Older profile used: company + job_title
  const company = pickFirst(p, ["company_name", "company", "last_company", "last_vessel"], "");
  const role = pickFirst(p, ["role", "job_title", "availability"], "");
  const rank = pickFirst(p, ["rank"], "");

  const bio = pickFirst(p, ["bio", "about"], "");
  const avatar = pickFirst(p, ["avatar_url", "avatar"], "");

  fields.full_name.textContent = safeText(fullName);
  fields.email.textContent = safeText(email);

  // Values mapped by type (same boxes, different meaning)
  if (kind === "seafarer") {
    fields.rank.textContent = safeText(rank);
    fields.nationality.textContent = safeText(nationality);
    fields.lastVessel.textContent = safeText(company);
    fields.availability.textContent = safeText(role);

    elMiniRank.textContent = safeText(rank);
    elMiniNationality.textContent = safeText(nationality);
    // In Setup, "rank" stores Department/Contact. "role" stores Business Type. "company_name" stores Company Name.
    // "lastVessel" (k_lastVessel) stores Company/Brand.

    // For "About", we only want Identity/Bio. The rest is in "Experience" (Overview).
    // So we can technically hide these or leave them. Common logic says avoid duplication.
    // Let's clear the text for duplicates so they look empty or repurpose.
    // Actually, let's just show them but maybe with different labels?
    // No, user said "Experience just on the bottom of the about" (meaning duplicates).
    // So let's HIDE redundant fields in About for Company.

    fields.rank.parentElement.classList.add("hidden");        // Department
    fields.lastVessel.parentElement.classList.add("hidden");  // Brand (similar to Company Name)
    fields.availability.parentElement.classList.add("hidden"); // Role
    // Nationality is headquarters, good to keep in About.

    fields.rank.textContent = safeText(rank);
    fields.nationality.textContent = safeText(nationality);
    fields.lastVessel.textContent = safeText(company);
    fields.availability.textContent = safeText(role);

    elMiniRank.textContent = safeText(role, "—");       // Category
    elMiniNationality.textContent = safeText(nationality);
  } else {
    // professional / other
    fields.rank.textContent = safeText(rank);            // Specialty / Position
    fields.nationality.textContent = safeText(nationality);
    fields.lastVessel.textContent = safeText(company);   // Organization
    fields.availability.textContent = safeText(role);    // Role / Job Title

    elMiniRank.textContent = safeText(role, "—");
    elMiniNationality.textContent = safeText(nationality);
  }

  fields.bio.textContent = safeText(bio);

  elProfileName.textContent = safeText(fullName, "Profile");
  setAvatar(avatar, fullName || currentUser.email || "P");
  setAccountTypeBadge(p?.account_type, p?.account_type_label);

  globalProfileData = p; // Backup for static tabs
}

/* ---------------- Save basics ---------------- */
editBtn.onclick = () => setEditable(true);

saveBtn.onclick = async () => {
  if (!currentUserId) return;

  const updates = {
    full_name: normalizeEditableValue(fields.full_name.textContent),
    nationality: normalizeEditableValue(fields.nationality.textContent),
    bio: normalizeEditableValue(fields.bio.textContent),
    updated_at: new Date().toISOString(),
  };

  // Save meaning depends on type, but we still store in consistent columns:
  // - rank
  // - company_name
  // - role
  const vRank = normalizeEditableValue(fields.rank.textContent);
  const vCompany = normalizeEditableValue(fields.lastVessel.textContent);
  const vRole = normalizeEditableValue(fields.availability.textContent);

  if (vRank) updates.rank = vRank;
  if (vCompany) updates.company_name = vCompany;
  if (vRole) updates.role = vRole;

  // Backward compatibility (older code may use these)
  if (vCompany) updates.company = vCompany;
  if (vRole) updates.job_title = vRole;

  Object.keys(updates).forEach(k => { if (updates[k] === null) delete updates[k]; });

  const { error } = await supabase.from("profiles").update(updates).eq("id", currentUserId);
  if (error) {
    toast("Save failed");
    console.error("Profile save error:", error);
    alert("Save failed: " + (error.message || "Unknown error"));
    return;
  }

  setEditable(false);
  toast("Saved");
  await loadProfile();
};

/* ---------------- Posts tab (unchanged logic) ---------------- */
function detectKeys(row) {
  const keys = row ? Object.keys(row) : [];
  const pick = (cands) => cands.find(k => keys.includes(k)) || null;
  return {
    userKey: pick(["user_id", "author_id", "profile_id", "uid", "user"]),
    contentKey: pick(["content", "text", "body", "caption", "post_text", "message"]),
    mediaKey: pick(["media_url", "image_url", "image", "photo_url", "video_url", "media"]),
    createdKey: pick(["created_at", "created", "timestamp"]),
  };
}

function fmtDate(s) {
  const d = s ? new Date(s) : null;
  if (!d || Number.isNaN(d.getTime())) return "";
  return d.toLocaleString();
}

function isVideo(url) {
  const u = (url || "").toLowerCase();
  return u.endsWith(".mp4") || u.endsWith(".webm") || u.endsWith(".mov") || u.includes("video");
}

function esc(s) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

async function loadMyPosts() {
  if (!postsWrap) return;
  postsWrap.textContent = "Loading…";

  let res = await supabase.from("posts").select("*").order("created_at", { ascending: false }).limit(200);
  if (res.error) res = await supabase.from("posts").select("*").order("id", { ascending: false }).limit(200);
  if (res.error) {
    postsWrap.innerHTML = `<div class="muted">Could not load posts: ${esc(res.error.message)}</div>`;
    return;
  }

  const rows = res.data || [];
  if (!rows.length) {
    postsWrap.innerHTML = `<div class="muted">No posts yet.</div>`;
    return;
  }

  const keys = detectKeys(rows[0]);
  const uKey = keys.userKey;
  const cKey = keys.contentKey;
  const mKey = keys.mediaKey;
  const tKey = keys.createdKey;

  const mine = uKey ? rows.filter(r => r?.[uKey] === currentUserId) : [];
  if (!mine.length) {
    postsWrap.innerHTML = `<div class="muted">No posts yet.</div>`;
    return;
  }

  postsWrap.innerHTML = `<div class="list" id="postList"></div>`;
  const list = document.getElementById("postList");

  list.innerHTML = mine.map(r => {
    const body = esc(r?.[cKey] ?? "");
    const mediaUrl = (r?.[mKey] ?? "").toString().trim();
    const when = fmtDate(r?.[tKey]);

    const mediaHtml = mediaUrl
      ? (isVideo(mediaUrl)
        ? `<div class="media"><video src="${esc(mediaUrl)}" controls playsinline></video></div>`
        : `<div class="media"><img src="${esc(mediaUrl)}" alt="Post media" loading="lazy" /></div>`)
      : "";

    return `
      <div class="itemCard">
        <div class="itemTop">
          <div>
            <div class="itemTitle">Post</div>
            <div class="itemMeta">${esc(when)}</div>
          </div>
        </div>
        ${body ? `<div class="itemBody">${body}</div>` : ""}
        ${mediaHtml}
      </div>
    `;
  }).join("");
}

/* ---------------- Generic tabs (unchanged) ---------------- */
async function trySelectTable(table) {
  const t = await supabase.from(table).select("*").limit(1);
  if (t.error) return { ok: false };
  return { ok: true };
}

async function findWorkingTable(candidates) {
  for (const t of candidates) {
    const res = await trySelectTable(t);
    if (res.ok) return t;
  }
  return null;
}

function pickUserKeyFromRow(row) {
  if (!row) return null;
  const keys = Object.keys(row);
  const cands = ["user_id", "author_id", "profile_id", "uid", "user", "id_user"];
  return cands.find(k => keys.includes(k)) || null;
}

function bestTitle(row) {
  const k = Object.keys(row || {});
  const pick = (arr) => arr.find(x => k.includes(x));
  const t = pick(["title", "name", "doc_name", "document_name", "vessel", "vessel_name", "company", "file_name", "filename", "media_name"]);
  return t ? safeText(row[t], "Item") : "Item";
}

function bestBody(row) {
  const k = Object.keys(row || {});
  const pick = (arr) => arr.find(x => k.includes(x));
  const b = pick(["body", "description", "details", "note", "remarks", "text", "content"]);
  return b ? safeText(row[b], "") : "";
}

function bestUrl(row) {
  const k = Object.keys(row || {});
  const pick = (arr) => arr.find(x => k.includes(x));
  const u = pick(["url", "file_url", "media_url", "link", "document_url"]);
  return u ? (row[u] || "").toString().trim() : "";
}

function bestDate(row) {
  const k = Object.keys(row || {});
  const pick = (arr) => arr.find(x => k.includes(x));
  const d = pick(["created_at", "date", "from_date", "start_date", "timestamp", "issued_on"]);
  return d ? fmtDate(row[d]) : "";
}

async function loadGenericTab(targetEl, tableCandidates) {
  if (!targetEl) return;
  targetEl.textContent = "Loading…";

  const table = await findWorkingTable(tableCandidates);
  if (!table) {
    targetEl.innerHTML = `<div class="muted">This section is not enabled in the database yet.</div>`;
    return;
  }

  let res = await supabase.from(table).select("*").order("created_at", { ascending: false }).limit(200);
  if (res.error) res = await supabase.from(table).select("*").limit(200);

  if (res.error) {
    targetEl.innerHTML = `<div class="muted">Could not load: ${esc(res.error.message)}</div>`;
    return;
  }

  const rows = res.data || [];
  if (!rows.length) {
    targetEl.innerHTML = `<div class="muted">No items yet.</div>`;
    return;
  }

  const uKey = pickUserKeyFromRow(rows[0]);
  const mine = uKey ? rows.filter(r => r?.[uKey] === currentUserId) : rows;

  if (!mine.length) {
    targetEl.innerHTML = `<div class="muted">No items yet.</div>`;
    return;
  }

  targetEl.innerHTML = `<div class="list"></div>`;
  const list = targetEl.querySelector(".list");

  list.innerHTML = mine.map(r => {
    const title = esc(bestTitle(r));
    const body = esc(bestBody(r));
    const url = bestUrl(r);
    const when = esc(bestDate(r));

    const linkHtml = url
      ? `<div class="itemMeta"><a href="${esc(url)}" target="_blank" rel="noopener">Open</a></div>`
      : "";

    return `
      <div class="itemCard">
        <div class="itemTop">
          <div>
            <div class="itemTitle">${title}</div>
            <div class="itemMeta">${when}</div>
            ${linkHtml}
          </div>
        </div>
        ${body ? `<div class="itemBody">${body}</div>` : ""}
      </div>
    `;
  }).join("");
}

/* ---------------- Avatar editor (keep your existing modal system) ---------------- */

/* ---------------- Avatar Logic ---------------- */
let cropModal = null;
let cropCanvas = null;
let cropCtx = null;
let cropImg = null;
let imgW = 0, imgH = 0;

let zoom = 1;
let baseScale = 1; // Scale to fit "cover" at zoom 1
let aspect = 1;
let offsetX = 0, offsetY = 0;
let dragging = false;
let lastX = 0, lastY = 0;

async function uploadAvatarBlob(userId, blob) {
  const path = `${userId}/${Date.now()}_avatar.webp`;
  const { data, error } = await supabase.storage
    .from("avatars")
    .upload(path, blob, { contentType: "image/webp", upsert: true });

  if (error) throw error;
  return path;
}

function computeBaseScale() {
  if (!cropCanvas || !cropImg) return;
  // We want "zoom=1" to correspond to "Cover" (filling the frame)
  // Frame depends on aspect.
  const cw = cropCanvas.width;
  const ch = cropCanvas.height;
  const pad = 26;
  const frameMaxW = cw - pad * 2;
  const frameMaxH = ch - pad * 2;

  let frameW = frameMaxW;
  let frameH = frameW / aspect;
  if (frameH > frameMaxH) { frameH = frameMaxH; frameW = frameH * aspect; }

  // Scale to cover the frame
  const scaleW = frameW / imgW;
  const scaleH = frameH / imgH;
  baseScale = Math.max(scaleW, scaleH);
}

function ensureCropModal() {
  if (document.getElementById("pvCropBack")) return;

  const style = document.createElement("style");
  style.innerHTML = `
    .pvModalBack{
      position:fixed; inset:0; z-index:10000;
      background:rgba(0,0,0,.85);
      display:none; 
      align-items:center; justify-content:center;
      opacity:0; transition:opacity .2s;
    }
    .pvModalBack.show{display:flex; opacity:1}
    .pvModal{
      width: min(520px, 94vw);
      background: #fff;
      border-radius: 18px;
      overflow:hidden;
      box-shadow: 0 20px 50px rgba(0,0,0,.5);
      animation: pvPop .3s ease-out;
    }
    @keyframes pvPop{from{transform:scale(.95)}to{transform:scale(1)}}
    .pvHead{display:flex; justify-content:space-between; align-items:center; padding:14px 18px; border-bottom:1px solid #eee}
    .pvTitle{font-weight:900; font-size:16px; color:#111}
    .pvClose{background:none; border:0; font-size:20px; color:#666; cursor:pointer;}
    .pvBody{padding:16px;}
    .pvCanvasWrap{background:#111; border-radius:12px; overflow:hidden; display:flex; justify-content:center;}
    .pvToolbar{margin-top:16px; display:flex; flex-direction:column; gap:12px;}
    .pvGroup{display:flex; gap:8px; flex-wrap:wrap; justify-content:center;}
    .pvPill{
      border:1px solid #ddd; background:#fff; padding:6px 12px; border-radius:20px;
      font-size:13px; font-weight:600; cursor:pointer; color:#444; transition:.2s;
    }
    .pvPill:hover{background:#f4f4f4}
    .pvPill.active{background:#1F6F86; color:#fff; border-color:#1F6F86}
    .pvSliderRow{margin-top:16px; display:grid; grid-template-columns:1fr 1fr; gap:12px}
    .pvSlider{
      display:flex; align-items:center; gap:10px;
      background: rgba(0,0,0,.03);
      border: 1px solid rgba(0,0,0,.06);
      padding: 10px 12px;
      border-radius: 16px;
    }
    .pvSlider .lbl{min-width:88px; font-weight:700; color:#334; font-size:13px}
    .pvSlider input[type="range"]{width:100%}
    .pvFoot{display:flex; gap:10px; justify-content:flex-end; flex-wrap:wrap; margin-top: 14px;}
    .pvBtn{border:0; cursor:pointer; padding: 10px 14px; border-radius: 14px; font-weight:800;}
    .pvGhost{background: rgba(0,0,0,.06)}
    .pvPrimary{background: #1F6F86; color:#fff}
  `;
  document.head.appendChild(style);

  const back = document.createElement("div");
  back.className = "pvModalBack";
  back.id = "pvCropBack";

  back.innerHTML = `
    <div class="pvModal" role="dialog" aria-modal="true">
      <div class="pvHead">
        <div class="pvTitle">Adjust your photo</div>
        <button class="pvClose" type="button" id="pvCropClose">✕</button>
      </div>

      <div class="pvBody">
        <div class="pvCanvasWrap">
          <canvas id="pvCropCanvas" width="520" height="520" style="display:block;width:100%;height:auto"></canvas>
        </div>

        <div class="pvToolbar">
          <div class="pvGroup">
            <button class="pvPill active" type="button" data-aspect="1">1:1</button>
            <button class="pvPill" type="button" data-aspect="0.8">4:5</button>
            <button class="pvPill" type="button" data-aspect="1.7778">16:9</button>
          </div>

          <div class="pvGroup">
            <button class="pvPill" type="button" id="pvPresetWarm">Warm</button>
            <button class="pvPill" type="button" id="pvPresetCool">Cool</button>
            <button class="pvPill" type="button" id="pvPresetBW">B&W</button>
            <button class="pvPill" type="button" id="pvPresetVintage">Vintage</button>
            <button class="pvPill" type="button" id="pvPresetMatte">Matte</button>
            <button class="pvPill" type="button" id="pvPresetReset">Reset</button>
          </div>
        </div>

        <div class="pvSliderRow">
          <div class="pvSlider">
            <div class="lbl">Zoom</div>
            <input id="pvZoom" type="range" min="0.5" max="3" step="0.01" value="1" />
          </div>
          <div class="pvSlider">
            <div class="lbl">Brightness</div>
            <input id="pvBright" type="range" min="70" max="140" step="1" value="105" />
          </div>
          <div class="pvSlider">
            <div class="lbl">Contrast</div>
            <input id="pvContrast" type="range" min="70" max="140" step="1" value="105" />
          </div>
          <div class="pvSlider">
            <div class="lbl">Saturation</div>
            <input id="pvSat" type="range" min="0" max="160" step="1" value="110" />
          </div>
        </div>

        <div class="pvFoot">
          <button class="pvBtn pvGhost" type="button" id="pvCancel">Cancel</button>
          <button class="pvBtn pvPrimary" type="button" id="pvSavePhoto">Save Photo</button>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(back);
  cropModal = back;
  cropCanvas = document.getElementById("pvCropCanvas");
  cropCtx = cropCanvas.getContext("2d");

  document.getElementById("pvCropClose").addEventListener("click", closeCrop);
  document.getElementById("pvCancel").addEventListener("click", closeCrop);

  back.querySelectorAll("[data-aspect]").forEach((btn) => {
    btn.addEventListener("click", () => {
      back.querySelectorAll("[data-aspect]").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      aspect = Number(btn.getAttribute("data-aspect") || "1");
      computeBaseScale();
      drawCrop();
    });
  });

  const rerender = () => drawCrop();
  document.getElementById("pvZoom").addEventListener("input", (e) => {
    zoom = Number(e.target.value || 1);
    drawCrop();
  });
  document.getElementById("pvBright").addEventListener("input", rerender);
  document.getElementById("pvContrast").addEventListener("input", rerender);
  document.getElementById("pvSat").addEventListener("input", rerender);

  const bright = () => document.getElementById("pvBright");
  const cont = () => document.getElementById("pvContrast");
  const sat = () => document.getElementById("pvSat");

  document.getElementById("pvPresetWarm").addEventListener("click", () => {
    bright().value = "108"; cont().value = "108"; sat().value = "125"; drawCrop();
  });
  document.getElementById("pvPresetCool").addEventListener("click", () => {
    bright().value = "102"; cont().value = "106"; sat().value = "112"; drawCrop();
  });
  document.getElementById("pvPresetBW").addEventListener("click", () => {
    bright().value = "103"; cont().value = "112"; sat().value = "0"; drawCrop();
  });
  document.getElementById("pvPresetVintage").addEventListener("click", () => {
    bright().value = "90"; cont().value = "120"; sat().value = "80"; drawCrop();
  });
  document.getElementById("pvPresetMatte").addEventListener("click", () => {
    bright().value = "110"; cont().value = "90"; sat().value = "90"; drawCrop();
  });
  document.getElementById("pvPresetReset").addEventListener("click", () => {
    document.getElementById("pvZoom").value = "1";
    zoom = 1;
    bright().value = "105"; cont().value = "105"; sat().value = "110";
    offsetX = 0; offsetY = 0;
    drawCrop();
  });

  document.getElementById("pvSavePhoto").addEventListener("click", async () => {
    if (!currentUserId) return;
    const btn = document.getElementById("pvSavePhoto");
    const label = btn.textContent;
    btn.textContent = "Saving...";
    btn.disabled = true;

    try {
      const blob = await exportCroppedWebpBlob();
      const path = await uploadAvatarBlob(currentUserId, blob);

      const { error } = await supabase
        .from("profiles")
        .update({ avatar_url: path, updated_at: new Date().toISOString() })
        .eq("id", currentUserId);

      if (error) throw error;

      setAvatar(path, fields.full_name.textContent || currentUser.email || "P");
      toast("Photo updated");
      closeCrop();
    } catch (e) {
      console.error(e);
      toast("Could not save photo");
    } finally {
      btn.textContent = label;
      btn.disabled = false;
    }
  });

  // Pointer events for dragging
  cropCanvas.addEventListener("pointerdown", (ev) => {
    if (!cropImg) return;
    dragging = true;
    const p = pointerPos(ev);
    lastX = p.x; lastY = p.y;
    cropCanvas.setPointerCapture(ev.pointerId);
  });
  cropCanvas.addEventListener("pointermove", (ev) => {
    if (!dragging || !cropImg) return;
    const p = pointerPos(ev);
    offsetX += (p.x - lastX);
    offsetY += (p.y - lastY);
    lastX = p.x; lastY = p.y;
    drawCrop();
  });
  cropCanvas.addEventListener("pointerup", () => { dragging = false; });
  cropCanvas.addEventListener("pointercancel", () => { dragging = false; });
}

function pointerPos(ev) {
  const rect = cropCanvas.getBoundingClientRect();
  const x = (ev.clientX - rect.left) * (cropCanvas.width / rect.width);
  const y = (ev.clientY - rect.top) * (cropCanvas.height / rect.height);
  return { x, y };
}

function openCropWithFile(file) {
  ensureCropModal();
  const url = URL.createObjectURL(file);
  const img = new Image();
  img.onload = () => {
    cropImg = img;
    imgW = img.naturalWidth;
    imgH = img.naturalHeight;
    zoom = 1;
    offsetX = 0; offsetY = 0;
    dragging = false;
    document.getElementById("pvZoom").value = "1";
    cropModal.classList.add("show");
    computeBaseScale(); // Calculate fit
    drawCrop();
  };
  img.src = url;
}

function closeCrop() {
  if (cropModal) cropModal.classList.remove("show");
  if (avatarFile) avatarFile.value = "";
}

function getFilterString() {
  const b = Number(document.getElementById("pvBright")?.value || 105);
  const c = Number(document.getElementById("pvContrast")?.value || 105);
  const s = Number(document.getElementById("pvSat")?.value || 110);
  return `brightness(${b}%) contrast(${c}%) saturate(${s}%)`;
}

function drawCrop() {
  if (!cropCtx || !cropImg) return;
  const cw = cropCanvas.width;
  const ch = cropCanvas.height;
  cropCtx.clearRect(0, 0, cw, ch);

  const pad = 26;
  const frameMaxW = cw - pad * 2;
  const frameMaxH = ch - pad * 2;

  let frameW = frameMaxW;
  let frameH = frameW / aspect;
  if (frameH > frameMaxH) { frameH = frameMaxH; frameW = frameH * aspect; }

  const frameX = (cw - frameW) / 2;
  const frameY = (ch - frameH) / 2;

  // Draw image
  cropCtx.save();
  cropCtx.filter = getFilterString();

  // Apply baseScale * zoom
  const drawW = imgW * baseScale * zoom;
  const drawH = imgH * baseScale * zoom;

  const x = (cw - drawW) / 2 + offsetX;
  const y = (ch - drawH) / 2 + offsetY;
  cropCtx.drawImage(cropImg, x, y, drawW, drawH);
  cropCtx.restore();

  // Dark overlay
  cropCtx.save();
  cropCtx.fillStyle = "rgba(3,10,14,.45)";
  cropCtx.fillRect(0, 0, cw, frameY);
  cropCtx.fillRect(0, frameY + frameH, cw, ch - (frameY + frameH));
  cropCtx.fillRect(0, frameY, frameX, frameH);
  cropCtx.fillRect(frameX + frameW, frameY, cw - (frameX + frameW), frameH);
  cropCtx.restore();

  // Border
  cropCtx.save();
  cropCtx.strokeStyle = "rgba(31,111,134,.95)";
  cropCtx.lineWidth = 3;
  cropCtx.strokeRect(frameX, frameY, frameW, frameH);
  cropCtx.restore();
}

async function exportCroppedWebpBlob() {
  if (!cropImg) throw new Error("No image");

  // Must render at high res but using the same crop logic
  const outW = 720;
  const outH = Math.round(outW / aspect);
  const out = document.createElement("canvas");
  out.width = outW;
  out.height = outH;
  const ctx = out.getContext("2d");

  const cw = cropCanvas.width;
  const ch = cropCanvas.height;

  // Re-calculate frame layout from screen canvas
  const pad = 26;
  const frameMaxW = cw - pad * 2;
  const frameMaxH = ch - pad * 2;
  let frameW = frameMaxW;
  let frameH = frameW / aspect;
  if (frameH > frameMaxH) { frameH = frameMaxH; frameW = frameH * aspect; }
  const frameX = (cw - frameW) / 2;
  const frameY = (ch - frameH) / 2;

  // Current on-screen coords
  const drawW = imgW * baseScale * zoom;
  const drawH = imgH * baseScale * zoom;
  const x = (cw - drawW) / 2 + offsetX;
  const y = (ch - drawH) / 2 + offsetY;

  // Map to UV space
  const sx = (frameX - x) / drawW * imgW;
  const sy = (frameY - y) / drawH * imgH;
  const sw = frameW / drawW * imgW;
  const sh = frameH / drawH * imgH;

  ctx.save();
  ctx.filter = getFilterString();
  ctx.drawImage(cropImg, sx, sy, sw, sh, 0, 0, outW, outH);
  ctx.restore();

  return new Promise((resolve) => out.toBlob(resolve, "image/webp", 0.92));
}

function wireAvatarEvents() {
  if (avatarBtn && avatarFile) {
    avatarBtn.onclick = () => avatarFile.click();
    avatarFile.onchange = (e) => {
      if (e.target.files && e.target.files[0]) {
        openCropWithFile(e.target.files[0]);
      }
    };
  }
}

/* ---------------- Init ---------------- */
(async () => {
  try {
    initTabs();
    wireAvatarEvents();

    setEditable(false);
    await loadProfile();
  } catch (e) {
    console.error("Profile init error:", e);
    alert("Profile failed: " + (e.message || "Unknown error"));
  }
})();
