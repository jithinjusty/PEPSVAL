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

const tabBtn_sea = document.getElementById("tabBtn_sea");
const tab_sea = document.getElementById("tab_sea");

const postsWrap = document.getElementById("postsWrap");
const documentsWrap = document.getElementById("documentsWrap");
const seaWrap = document.getElementById("seaWrap");
const mediaWrap = document.getElementById("mediaWrap");

const fields = {
  full_name: document.getElementById("fullName"),
  rank: document.getElementById("rank"),
  nationality: document.getElementById("nationality"),
  lastVessel: document.getElementById("lastVessel"),
  availability: document.getElementById("availability"),
  bio: document.getElementById("bio"),
  email: document.getElementById("email"),
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

function show(el){ el && el.classList.remove("hidden"); }
function hide(el){ el && el.classList.add("hidden"); }

function applyLayout(kind) {
  currentAccountKind = kind;

  // Default: show everything
  show(tabBtn_sea);
  show(tab_sea);

  // Seafarer layout
  if (kind === "seafarer") {
    if (overviewTitle) overviewTitle.textContent = "Overview";
    if (overviewHint) overviewHint.textContent = "Your profile is your identity on Pepsval. Verified details increase trust and visibility.";

    if (miniLabel1) miniLabel1.textContent = "Rank";
    if (miniLabel2) miniLabel2.textContent = "Nationality";

    if (k_fullName) k_fullName.textContent = "Full Name";
    if (k_rank) k_rank.textContent = "Rank";
    if (k_nationality) k_nationality.textContent = "Nationality";
    if (k_lastVessel) k_lastVessel.textContent = "Last Vessel / Company";
    if (k_availability) k_availability.textContent = "Availability / Job Title";

    return;
  }

  // Company / Professional: hide Sea Service tab + pane
  hide(tabBtn_sea);
  hide(tab_sea);

  if (kind === "company") {
    if (overviewTitle) overviewTitle.textContent = "Company Profile";
    if (overviewHint) overviewHint.textContent = "Keep your company profile accurate. Verified details improve trust with seafarers.";

    if (miniLabel1) miniLabel1.textContent = "Category";
    if (miniLabel2) miniLabel2.textContent = "Country";

    if (k_fullName) k_fullName.textContent = "Company / Institute Name";
    if (k_rank) k_rank.textContent = "Department / Contact";
    if (k_nationality) k_nationality.textContent = "Country";
    if (k_lastVessel) k_lastVessel.textContent = "Company / Brand";
    if (k_availability) k_availability.textContent = "Business Type / Role";
    return;
  }

  if (kind === "professional") {
    if (overviewTitle) overviewTitle.textContent = "Professional Profile";
    if (overviewHint) overviewHint.textContent = "A strong professional profile helps companies and seafarers trust your experience.";

    if (miniLabel1) miniLabel1.textContent = "Role";
    if (miniLabel2) miniLabel2.textContent = "Country";

    if (k_fullName) k_fullName.textContent = "Full Name";
    if (k_rank) k_rank.textContent = "Specialty / Position";
    if (k_nationality) k_nationality.textContent = "Country";
    if (k_lastVessel) k_lastVessel.textContent = "Company / Organization";
    if (k_availability) k_availability.textContent = "Role / Job Title";
    return;
  }

  // Other
  if (overviewTitle) overviewTitle.textContent = "Profile";
  if (miniLabel1) miniLabel1.textContent = "Role";
  if (miniLabel2) miniLabel2.textContent = "Country";
  hide(tabBtn_sea);
  hide(tab_sea);
}

/* ---------------- Tabs ---------------- */
function initTabs() {
  const tabs = Array.from(document.querySelectorAll(".tab"));
  const panes = {
    about: document.getElementById("tab_about"),
    posts: document.getElementById("tab_posts"),
    documents: document.getElementById("tab_documents"),
    sea: document.getElementById("tab_sea"),
    media: document.getElementById("tab_media"),
  };

  function activate(key) {
    // Prevent activating hidden sea tab
    if (key === "sea" && currentAccountKind !== "seafarer") key = "about";

    tabs.forEach(t => t.classList.toggle("active", t.dataset.tab === key));
    Object.entries(panes).forEach(([k, el]) => {
      if (!el) return;
      el.classList.toggle("hidden", k !== key);
    });

    if (key === "posts") loadMyPosts().catch(console.error);
    if (key === "documents") loadGenericTab(documentsWrap, ["documents", "user_documents", "profile_documents"]).catch(console.error);
    if (key === "sea") loadGenericTab(seaWrap, ["sea_service", "sea_services", "sea_time", "sea_entries"]).catch(console.error);
    if (key === "media") loadGenericTab(mediaWrap, ["media", "user_media", "profile_media"]).catch(console.error);
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
  } else if (kind === "company") {
    fields.rank.textContent = safeText(rank);            // Department / Contact
    fields.nationality.textContent = safeText(nationality);
    fields.lastVessel.textContent = safeText(company);  // Company / Brand
    fields.availability.textContent = safeText(role);   // Business Type / Role

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
  const t = pick(["title","name","doc_name","document_name","vessel","vessel_name","company","file_name","filename","media_name"]);
  return t ? safeText(row[t], "Item") : "Item";
}

function bestBody(row) {
  const k = Object.keys(row || {});
  const pick = (arr) => arr.find(x => k.includes(x));
  const b = pick(["body","description","details","note","remarks","text","content"]);
  return b ? safeText(row[b], "") : "";
}

function bestUrl(row) {
  const k = Object.keys(row || {});
  const pick = (arr) => arr.find(x => k.includes(x));
  const u = pick(["url","file_url","media_url","link","document_url"]);
  return u ? (row[u] || "").toString().trim() : "";
}

function bestDate(row) {
  const k = Object.keys(row || {});
  const pick = (arr) => arr.find(x => k.includes(x));
  const d = pick(["created_at","date","from_date","start_date","timestamp","issued_on"]);
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
const modal = document.getElementById("imgModal");
const cropCanvas = document.getElementById("cropCanvas");
const zoomRange = document.getElementById("zoomRange");
const briRange = document.getElementById("briRange");
const conRange = document.getElementById("conRange");
const satRange = document.getElementById("satRange");
const resetEditBtn = document.getElementById("resetEdit");
const saveAvatarBtn = document.getElementById("saveAvatar");

let imgObj = null;
let dragging = false;
let lastX = 0, lastY = 0;
let offsetX = 0, offsetY = 0;
let baseScale = 1;

function openModal() {
  modal?.classList.remove("hidden");
  modal?.setAttribute("aria-hidden", "false");
}
function closeModal() {
  modal?.classList.add("hidden");
  modal?.setAttribute("aria-hidden", "true");
}
function computeBaseScale() {
  if (!imgObj || !cropCanvas) return;
  const cw = cropCanvas.width;
  const ch = cropCanvas.height;
  baseScale = Math.max(cw / imgObj.width, ch / imgObj.height);
}
function resetEditor() {
  if (!zoomRange || !briRange || !conRange || !satRange) return;
  zoomRange.value = "1";
  briRange.value = "1";
  conRange.value = "1";
  satRange.value = "1";
  offsetX = 0;
  offsetY = 0;
  computeBaseScale();
  draw();
}

function draw() {
  if (!cropCanvas) return;
  const ctx = cropCanvas.getContext("2d");
  if (!ctx) return;

  const cw = cropCanvas.width;
  const ch = cropCanvas.height;

  ctx.clearRect(0, 0, cw, ch);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, cw, ch);

  if (!imgObj) return;

  const zoom = parseFloat(zoomRange?.value || "1");
  const bri = parseFloat(briRange?.value || "1");
  const con = parseFloat(conRange?.value || "1");
  const sat = parseFloat(satRange?.value || "1");

  ctx.save();
  ctx.filter = `brightness(${bri}) contrast(${con}) saturate(${sat})`;

  const scale = baseScale * zoom;
  const w = imgObj.width * scale;
  const h = imgObj.height * scale;

  const x = (cw - w) / 2 + offsetX;
  const y = (ch - h) / 2 + offsetY;

  ctx.drawImage(imgObj, x, y, w, h);
  ctx.restore();
}

function dataUrlToBlob(dataUrl) {
  const [meta, b64] = dataUrl.split(",");
  const mime = (meta.match(/data:(.*?);base64/) || [])[1] || "image/webp";
  const bin = atob(b64);
  const len = bin.length;
  const arr = new Uint8Array(len);
  for (let i = 0; i < len; i++) arr[i] = bin.charCodeAt(i);
  return new Blob([arr], { type: mime });
}

function canvasToDataUrlWebp(size = 360, quality = 0.9) {
  const out = document.createElement("canvas");
  out.width = size;
  out.height = size;
  const octx = out.getContext("2d");
  octx.drawImage(cropCanvas, 0, 0, size, size);

  try {
    const webp = out.toDataURL("image/webp", quality);
    if (webp.startsWith("data:image/webp")) return webp;
  } catch (_) {}
  return out.toDataURL("image/jpeg", 0.86);
}

async function uploadAvatarBlob(userId, blob) {
  const path = `${userId}/avatar.webp`;
  const { error } = await supabase
    .storage
    .from("avatars")
    .upload(path, blob, { upsert: true, contentType: blob.type || "image/webp" });
  if (error) throw error;
  return path;
}

function wireModalClose() {
  if (!modal) return;
  modal.addEventListener("click", (e) => {
    const t = e.target;
    if (t && t.getAttribute && t.getAttribute("data-close") === "1") closeModal();
  });
  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !modal.classList.contains("hidden")) closeModal();
  });
}

function wireCanvasDrag() {
  if (!cropCanvas) return;

  const onDown = (e) => {
    dragging = true;
    const p = e.touches ? e.touches[0] : e;
    lastX = p.clientX;
    lastY = p.clientY;
  };
  const onMove = (e) => {
    if (!dragging) return;
    const p = e.touches ? e.touches[0] : e;
    const dx = p.clientX - lastX;
    const dy = p.clientY - lastY;
    lastX = p.clientX;
    lastY = p.clientY;
    offsetX += dx;
    offsetY += dy;
    draw();
  };
  const onUp = () => { dragging = false; };

  cropCanvas.addEventListener("mousedown", onDown);
  window.addEventListener("mousemove", onMove);
  window.addEventListener("mouseup", onUp);

  cropCanvas.addEventListener("touchstart", onDown, { passive: true });
  window.addEventListener("touchmove", onMove, { passive: true });
  window.addEventListener("touchend", onUp, { passive: true });
}

function wireEditorControls() {
  [zoomRange, briRange, conRange, satRange].forEach(el => el?.addEventListener("input", draw));
  resetEditBtn?.addEventListener("click", resetEditor);

  saveAvatarBtn?.addEventListener("click", async () => {
    if (!currentUserId || !imgObj) return;

    try {
      saveAvatarBtn.disabled = true;
      saveAvatarBtn.textContent = "Saving…";

      const dataUrl = canvasToDataUrlWebp(360, 0.9);
      const blob = dataUrlToBlob(dataUrl);

      const path = await uploadAvatarBlob(currentUserId, blob);

      const { error } = await supabase
        .from("profiles")
        .update({ avatar_url: path, updated_at: new Date().toISOString() })
        .eq("id", currentUserId);

      if (error) throw error;

      setAvatar(path, fields.full_name.textContent || currentUser.email || "P");
      toast("Photo updated");
      closeModal();
    } catch (e) {
      console.error(e);
      alert("Could not save photo: " + (e.message || "Unknown error"));
    } finally {
      saveAvatarBtn.disabled = false;
      saveAvatarBtn.textContent = "Save photo";
    }
  });
}

function fileToImage(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    const img = new Image();
    reader.onload = () => {
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = reader.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

avatarBtn?.addEventListener("click", () => avatarFile?.click());
avatarFile?.addEventListener("change", async () => {
  const file = avatarFile.files && avatarFile.files[0];
  if (!file) return;
  if (!file.type.startsWith("image/")) {
    alert("Please choose an image file.");
    return;
  }

  try {
    imgObj = await fileToImage(file);
    computeBaseScale();
    resetEditor();
    openModal();
  } catch (e) {
    console.error(e);
    alert("Could not load image.");
  } finally {
    avatarFile.value = "";
  }
});

/* ---------------- Init ---------------- */
(async () => {
  try {
    initTabs();
    wireModalClose();
    wireCanvasDrag();
    wireEditorControls();

    setEditable(false);
    await loadProfile();
  } catch (e) {
    console.error("Profile init error:", e);
    alert("Profile failed: " + (e.message || "Unknown error"));
  }
})();