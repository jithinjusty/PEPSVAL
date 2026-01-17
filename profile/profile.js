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

  editableEls.forEach(el => {
    if (!el) return;
    el.contentEditable = state;
  });

  card?.classList.toggle("is-editing", state);
  editBtn?.classList.toggle("hidden", state);
  saveBtn?.classList.toggle("hidden", !state);
}

function setAvatar(url, nameForInitials) {
  const urlTrim = (url || "").trim();
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

function setAccountTypeBadge(account_type, account_type_label) {
  const label = (account_type_label || account_type || "").trim();
  if (!label) {
    typeBadge.classList.add("hidden");
    typeBadge.textContent = "";
    return;
  }
  typeBadge.classList.remove("hidden");
  typeBadge.textContent = label;
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
    tabs.forEach(t => t.classList.toggle("active", t.dataset.tab === key));
    Object.entries(panes).forEach(([k, el]) => {
      if (!el) return;
      el.classList.toggle("hidden", k !== key);
    });

    // Lazy load
    if (key === "posts") loadMyPosts().catch(console.error);
    if (key === "documents") loadGenericTab(documentsWrap, ["documents", "user_documents", "profile_documents"]).catch(console.error);
    if (key === "sea") loadGenericTab(seaWrap, ["sea_service", "sea_services", "sea_time", "sea_entries"]).catch(console.error);
    if (key === "media") loadGenericTab(mediaWrap, ["media", "user_media", "profile_media"]).catch(console.error);
  }

  tabs.forEach(t => {
    t.addEventListener("click", () => activate(t.dataset.tab));
  });

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
  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name, rank, nationality, bio, email, avatar_url, account_type, account_type_label, company, job_title")
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

  fields.full_name.textContent = safeText(p?.full_name);
  fields.rank.textContent = safeText(p?.rank);
  fields.nationality.textContent = safeText(p?.nationality);

  fields.lastVessel.textContent = safeText(p?.company);
  fields.availability.textContent = safeText(p?.job_title);

  fields.bio.textContent = safeText(p?.bio);
  fields.email.textContent = safeText(p?.email || currentUser.email);

  elProfileName.textContent = safeText(p?.full_name, "Profile");
  elMiniRank.textContent = safeText(p?.rank);
  elMiniNationality.textContent = safeText(p?.nationality);

  setAvatar(p?.avatar_url, p?.full_name || currentUser.email || "P");
  setAccountTypeBadge(p?.account_type, p?.account_type_label);
}

/* ---------------- Save basics ---------------- */
editBtn.onclick = () => setEditable(true);

saveBtn.onclick = async () => {
  if (!currentUserId) return;

  const updates = {
    full_name: normalizeEditableValue(fields.full_name.textContent),
    rank: normalizeEditableValue(fields.rank.textContent),
    nationality: normalizeEditableValue(fields.nationality.textContent),

    company: normalizeEditableValue(fields.lastVessel.textContent),
    job_title: normalizeEditableValue(fields.availability.textContent),

    bio: normalizeEditableValue(fields.bio.textContent),
    updated_at: new Date().toISOString(),
  };

  Object.keys(updates).forEach(k => {
    if (updates[k] === null) delete updates[k];
  });

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

/* ---------------- Posts tab (uses your existing posts table) ---------------- */
function detectKeys(row) {
  const keys = row ? Object.keys(row) : [];
  const pick = (cands) => cands.find(k => keys.includes(k)) || null;
  return {
    idKey: pick(["id", "post_id"]),
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

/* ---------------- Generic tabs (Documents / Sea / Media) ---------------- */
async function trySelectTable(table) {
  const t = await supabase.from(table).select("*").limit(1);
  if (t.error) return { ok: false, error: t.error };
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

  // Pull more, then filter locally (because user_id column name can vary)
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

/* ---------------- Avatar editor (crop + filters) ---------------- */
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
function computeBaseScale() {
  if (!imgObj || !cropCanvas) return;
  const cw = cropCanvas.width;
  const ch = cropCanvas.height;
  const scaleToCover = Math.max(cw / imgObj.width, ch / imgObj.height);
  baseScale = scaleToCover;
}

function draw() {
  if (!cropCanvas) return;
  const ctx = cropCanvas.getContext("2d");
  if (!ctx) return;

  const cw = cropCanvas.width;
  const ch = cropCanvas.height;

  ctx.clearRect(0, 0, cw, ch);

  // Background
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, cw, ch);

  if (!imgObj) {
    ctx.fillStyle = "rgba(0,0,0,.55)";
    ctx.font = "700 14px system-ui, -apple-system, Segoe UI, Roboto, Arial";
    ctx.textAlign = "center";
    ctx.fillText("Choose a photo", cw / 2, ch / 2);
    return;
  }

  const zoom = parseFloat(zoomRange?.value || "1");
  const bri = parseFloat(briRange?.value || "1");
  const con = parseFloat(conRange?.value || "1");
  const sat = parseFloat(satRange?.value || "1");

  ctx.save();
  ctx.filter = `brightness(${bri}) contrast(${con}) saturate(${sat})`;

  const scale = baseScale * zoom;
  const w = imgObj.width * scale;
  const h = imgObj.height * scale;

  // Center + offsets
  const x = (cw - w) / 2 + offsetX;
  const y = (ch - h) / 2 + offsetY;

  ctx.drawImage(imgObj, x, y, w, h);
  ctx.restore();

  // Subtle frame
  ctx.strokeStyle = "rgba(0,0,0,.10)";
  ctx.lineWidth = 2;
  ctx.strokeRect(1, 1, cw - 2, ch - 2);
}

function canvasToDataUrl(maxSize = 360, quality = 0.86) {
  // export resized square
  const out = document.createElement("canvas");
  out.width = maxSize;
  out.height = maxSize;
  const octx = out.getContext("2d");

  // draw current cropCanvas into out (already square)
  octx.drawImage(cropCanvas, 0, 0, maxSize, maxSize);

  return out.toDataURL("image/jpeg", quality);
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
  [zoomRange, briRange, conRange, satRange].forEach(el => {
    el?.addEventListener("input", draw);
  });
  resetEditBtn?.addEventListener("click", resetEditor);

  saveAvatarBtn?.addEventListener("click", async () => {
    if (!currentUserId) return;
    if (!imgObj) return;

    const dataUrl = canvasToDataUrl(360, 0.86);

    const { error } = await supabase
      .from("profiles")
      .update({ avatar_url: dataUrl, updated_at: new Date().toISOString() })
      .eq("id", currentUserId);

    if (error) {
      console.error(error);
      alert("Could not save photo: " + (error.message || "Unknown error"));
      return;
    }

    setAvatar(dataUrl, fields.full_name.textContent || currentUser.email || "P");
    toast("Photo updated");
    closeModal();
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
    // allow picking same file again
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