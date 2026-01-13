import { supabase, getCurrentUser } from "/js/supabase.js";

const MEDIA_BUCKET = "post_media";

/* Elements */
const elStatus = document.getElementById("feedStatus");
const elList = document.getElementById("feedList");

const elPostText = document.getElementById("postText");
const elPostBtn = document.getElementById("postBtn");
const elPostFile = document.getElementById("postFile");
const elFileBtn = document.getElementById("fileBtn");

const elFileInfo = document.getElementById("fileInfo");
const elFileName = document.getElementById("fileName");
const elClearFile = document.getElementById("clearFile");

const elProgressWrap = document.getElementById("progressWrap");
const elProgressFill = document.getElementById("progressFill");
const elProgressLabel = document.getElementById("progressLabel");
const elProgressPct = document.getElementById("progressPct");

const elSearchInput = document.getElementById("searchInput");
const elSearchDrop = document.getElementById("searchDrop");

const elMeAvatarBtn = document.getElementById("meAvatarBtn");
const elMeMenu = document.getElementById("meMenu");
const elMenuProfile = document.getElementById("menuProfile");
const elMenuSettings = document.getElementById("menuSettings");
const elMenuLogout = document.getElementById("menuLogout");

const elToast = document.getElementById("toast");

let me = null;
let selectedFile = null;

/* Helpers */
function setStatus(txt) { if (elStatus) elStatus.textContent = txt || ""; }

function toast(msg) {
  if (!elToast) return;
  elToast.textContent = msg || "Done";
  elToast.classList.add("show");
  setTimeout(() => elToast.classList.remove("show"), 1600);
}

function showProgress(on, label = "Uploading…", pct = 0) {
  if (!elProgressWrap) return;
  elProgressWrap.style.display = on ? "block" : "none";
  if (elProgressLabel) elProgressLabel.textContent = label;
  if (elProgressFill) elProgressFill.style.width = `${pct}%`;
  if (elProgressPct) elProgressPct.textContent = `${pct}%`;
}

function safeText(s) {
  return (s ?? "").toString().replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[c]));
}

function setMeAvatar(profile) {
  if (!elMeAvatarBtn) return;
  const url = profile?.avatar_url;
  const name = profile?.full_name || "P";
  const letter = (name || "P").trim().charAt(0).toUpperCase() || "P";
  if (url) elMeAvatarBtn.innerHTML = `<img src="${url}" alt="Me" />`;
  else elMeAvatarBtn.textContent = letter;
}

function mediaHTML(mediaUrl) {
  if (!mediaUrl) return "";
  const u = mediaUrl.toLowerCase();
  const isVideo = u.endsWith(".mp4") || u.endsWith(".mov") || u.endsWith(".webm") || u.includes("video");
  if (isVideo) return `<video class="pv-media" src="${mediaUrl}" controls playsinline></video>`;
  return `<img class="pv-media" src="${mediaUrl}" alt="Post media" />`;
}

/* File UI */
function setFileUI(file) {
  selectedFile = file || null;
  if (!selectedFile) {
    if (elFileInfo) elFileInfo.style.display = "none";
    if (elFileName) elFileName.textContent = "";
    if (elPostFile) elPostFile.value = "";
    return;
  }
  if (elFileInfo) elFileInfo.style.display = "flex";
  if (elFileName) elFileName.textContent = selectedFile.name;
}

/* Auth */
async function requireLogin() {
  me = await getCurrentUser();
  if (!me) {
    window.location.href = "/auth/login.html";
    return false;
  }
  setMeAvatar(me.profile);
  return true;
}

/* Upload */
async function uploadMedia(file) {
  if (!file) return null;
  const ext = (file.name.split(".").pop() || "bin").toLowerCase();
  const path = `${me.id}/${Date.now()}_${Math.random().toString(16).slice(2)}.${ext}`;

  let pct = 1;
  showProgress(true, "Uploading…", pct);
  const timer = setInterval(() => {
    pct = Math.min(95, pct + Math.ceil(Math.random() * 7));
    showProgress(true, "Uploading…", pct);
  }, 220);

  const { error } = await supabase.storage.from(MEDIA_BUCKET).upload(path, file, {
    cacheControl: "3600",
    upsert: false
  });

  clearInterval(timer);

  if (error) {
    showProgress(false);
    console.error("Upload error:", error);
    throw error;
  }

  showProgress(true, "Finalizing…", 100);
  setTimeout(() => showProgress(false), 400);

  const { data } = supabase.storage.from(MEDIA_BUCKET).getPublicUrl(path);
  return data?.publicUrl || null;
}

/* Key detection (robust) */
function detectKeys(row) {
  const keys = row ? Object.keys(row) : [];
  const pick = (cands) => cands.find(k => keys.includes(k)) || null;

  return {
    idKey: pick(["id", "post_id"]),
    userKey: pick(["user_id", "author_id", "profile_id", "uid", "user"]),
    contentKey: pick(["content", "text", "body", "caption", "post_text", "message"]),
    mediaKey: pick(["media_url", "image_url", "image", "photo_url", "video_url", "media"]),
    createdKey: pick(["created_at", "created", "timestamp"])
  };
}

/* Fetch posts with order fallback */
async function fetchPostsRaw() {
  // Try created_at first
  let res = await supabase
    .from("posts")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(50);

  if (res.error) {
    // Fallback: order by id if created_at is missing
    res = await supabase
      .from("posts")
      .select("*")
      .order("id", { ascending: false })
      .limit(50);
  }

  if (res.error) {
    console.error("Feed fetch error:", res.error);
    setStatus("Feed error");
    toast("Feed error");
    return [];
  }

  return res.data || [];
}

/* Profiles map */
async function fetchProfilesMap(ids) {
  if (!ids.length) return new Map();
  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name, avatar_url, rank, nationality, company_name")
    .in("id", ids);

  if (error) {
    console.error("Profiles fetch error:", error);
    return new Map();
  }

  const map = new Map();
  (data || []).forEach(p => map.set(p.id, p));
  return map;
}

/* Likes & Comments batch */
async function fetchLikesForPosts(postIds) {
  if (!postIds.length) return { counts: new Map(), iLiked: new Set() };

  const { data, error } = await supabase
    .from("post_likes")
    .select("post_id, user_id")
    .in("post_id", postIds);

  if (error) {
    console.error("Likes fetch error:", error);
    return { counts: new Map(), iLiked: new Set() };
  }

  const counts = new Map();
  const iLiked = new Set();

  for (const r of (data || [])) {
    counts.set(r.post_id, (counts.get(r.post_id) || 0) + 1);
    if (r.user_id === me.id) iLiked.add(r.post_id);
  }

  return { counts, iLiked };
}

async function fetchCommentsForPosts(postIds) {
  if (!postIds.length) return { counts: new Map(), latest: new Map() };

  // Pull latest comments (limit per table, then we show latest 2 per post)
  const { data, error } = await supabase
    .from("post_comments")
    .select("id, post_id, user_id, content, created_at")
    .in("post_id", postIds)
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) {
    console.error("Comments fetch error:", error);
    return { counts: new Map(), latest: new Map() };
  }

  const counts = new Map();
  const latest = new Map(); // post_id -> array (max 2)

  for (const c of (data || [])) {
    counts.set(c.post_id, (counts.get(c.post_id) || 0) + 1);

    const arr = latest.get(c.post_id) || [];
    if (arr.length < 2) arr.push(c);
    latest.set(c.post_id, arr);
  }

  return { counts, latest };
}

/* Render */
let cachedKeyset = null;

function renderPosts(rows, profMap, likeInfo, commentInfo, keyset) {
  if (!elList) return;

  if (!rows.length) {
    elList.innerHTML = `<div style="opacity:.7;font-size:13px;padding:14px;">No posts yet</div>`;
    return;
  }

  elList.innerHTML = rows.map((r) => {
    const pid = keyset.idKey ? r[keyset.idKey] : "";
    const uid = keyset.userKey ? r[keyset.userKey] : null;
    const prof = uid ? (profMap.get(uid) || {}) : {};

    const name = prof.full_name || "Seafarer";
    const avatar = prof.avatar_url || "";
    const rank = prof.rank ? ` • ${safeText(prof.rank)}` : "";
    const nat = prof.nationality ? ` • ${safeText(prof.nationality)}` : "";

    const when = keyset.createdKey && r[keyset.createdKey]
      ? new Date(r[keyset.createdKey]).toLocaleString()
      : "";

    const content = keyset.contentKey ? (r[keyset.contentKey] || "") : "";
    const mediaUrl = keyset.mediaKey ? (r[keyset.mediaKey] || "") : "";

    const mine = me && uid && uid === me.id;

    const likes = likeInfo.counts.get(pid) || 0;
    const liked = likeInfo.iLiked.has(pid);

    const cCount = commentInfo.counts.get(pid) || 0;
    const latest = commentInfo.latest.get(pid) || [];

    return `
      <article class="pv-post" data-post-id="${safeText(pid)}">
        <div class="pv-post-hd">
          <div class="pv-avatar">
            ${avatar
              ? `<img src="${avatar}" alt="${safeText(name)}" />`
              : `<div class="pv-avatar-fallback">${safeText(name).trim().charAt(0).toUpperCase() || "P"}</div>`
            }
          </div>
          <div class="pv-hd-text">
            <div class="pv-name-row">
              <div class="pv-name">${safeText(name)}</div>
              <div class="pv-time">${safeText(when)}</div>
            </div>
            <div class="pv-meta">${rank}${nat}</div>
          </div>
        </div>

        ${content ? `<div class="pv-content">${safeText(content)}</div>` : ""}
        ${mediaUrl ? mediaHTML(mediaUrl) : ""}

        <div class="pv-post-ft" style="justify-content:space-between;">
          <div style="display:flex;gap:8px;">
            <button class="pv-btn" type="button" data-action="like">
              ${liked ? "Unlike" : "Like"} (${likes})
            </button>
            <button class="pv-btn" type="button" data-action="toggleComments">
              Comments (${cCount})
            </button>
          </div>

          ${mine ? `<button class="pv-btn" type="button" data-action="delete">Delete</button>` : ""}
        </div>

        <div class="pv-comments" data-comments-wrap style="display:none;margin-top:10px;">
          <div style="opacity:.8;font-weight:800;font-size:12px;margin-bottom:8px;">
            Comments
          </div>

          <div data-comments-list style="display:flex;flex-direction:column;gap:8px;">
            ${latest.map(c => `
              <div style="font-size:13px;line-height:1.25;">
                <div style="opacity:.7;font-size:11px;">${new Date(c.created_at).toLocaleString()}</div>
                <div>${safeText(c.content)}</div>
              </div>
            `).join("")}
          </div>

          <div style="display:flex;gap:8px;margin-top:10px;">
            <input data-comment-input
              placeholder="Write a comment…"
              style="flex:1;padding:10px 12px;border-radius:999px;border:1px solid rgba(0,0,0,.12);outline:none;"
            />
            <button class="pv-btn" type="button" data-action="sendComment">Send</button>
          </div>
        </div>
      </article>
    `;
  }).join("");
}

/* Actions */
async function toggleLike(postId, liked) {
  if (liked) {
    const { error } = await supabase
      .from("post_likes")
      .delete()
      .eq("post_id", postId)
      .eq("user_id", me.id);

    if (error) { console.error(error); toast("Unlike failed"); return; }
  } else {
    const { error } = await supabase
      .from("post_likes")
      .insert([{ post_id: postId, user_id: me.id }]);

    if (error) { console.error(error); toast("Like failed"); return; }
  }
  await loadFeed();
}

async function sendComment(postId, inputEl) {
  const txt = (inputEl?.value || "").trim();
  if (!txt) return;

  const { error } = await supabase
    .from("post_comments")
    .insert([{ post_id: postId, user_id: me.id, content: txt }]);

  if (error) { console.error(error); toast("Comment failed"); return; }

  inputEl.value = "";
  await loadFeed();
}

async function deletePost(postId, keyset) {
  const ok = confirm("Delete this post?");
  if (!ok) return;

  const idCol = keyset.idKey || "id";

  const { error } = await supabase
    .from("posts")
    .delete()
    .eq(idCol, postId);

  if (error) {
    console.error("Delete error:", error);
    toast("Delete failed (RLS?)");
    return;
  }

  toast("Deleted");
  await loadFeed();
}

/* Insert post with fallback */
async function insertPostWithFallback(content, mediaUrl) {
  const attempts = [
    { user_id: me.id, content: content || "", media_url: mediaUrl || null },
    { author_id: me.id, text: content || "", image_url: mediaUrl || null },
    { user_id: me.id, text: content || "", image_url: mediaUrl || null },
    { author_id: me.id, content: content || "", media_url: mediaUrl || null }
  ];

  let lastErr = null;
  for (const payload of attempts) {
    const { error } = await supabase.from("posts").insert([payload]);
    if (!error) return true;
    lastErr = error;

    const msg = (error.message || "").toLowerCase();
    if (!msg.includes("column") && !msg.includes("does not exist")) break;
  }

  console.error("Insert failed:", lastErr);
  return false;
}

async function createPost() {
  if (!me) return;

  const content = (elPostText?.value || "").trim();
  if (!content && !selectedFile) {
    toast("Write something or add media");
    return;
  }

  elPostBtn.disabled = true;
  setStatus("Posting…");

  try {
    let mediaUrl = null;
    if (selectedFile) mediaUrl = await uploadMedia(selectedFile);

    const ok = await insertPostWithFallback(content, mediaUrl);
    if (!ok) { toast("Post failed"); return; }

    if (elPostText) elPostText.value = "";
    setFileUI(null);

    // Force a refresh (prevents “posted but not showing”)
    await new Promise(r => setTimeout(r, 350));
    await loadFeed();

    toast("Posted");
  } catch (e) {
    console.error(e);
    toast("Upload/Save failed");
  } finally {
    elPostBtn.disabled = false;
    setStatus("");
  }
}

/* Search (unchanged logic) */
let searchTimer = null;
async function runSearch(q) {
  const query = (q || "").trim();
  if (!query) {
    elSearchDrop.style.display = "none";
    elSearchDrop.innerHTML = "";
    return;
  }

  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name, avatar_url, rank, company_name")
    .ilike("full_name", `%${query}%`)
    .limit(8);

  if (error) {
    console.error("Search error:", error);
    elSearchDrop.style.display = "none";
    return;
  }

  const rows = data || [];
  if (!rows.length) {
    elSearchDrop.innerHTML = `<div class="searchItem" style="opacity:.7;">No results</div>`;
    elSearchDrop.style.display = "block";
    return;
  }

  elSearchDrop.innerHTML = rows.map(r => {
    const name = r.full_name || "Seafarer";
    const meta = [r.rank, r.company_name].filter(Boolean).join(" • ");
    return `
      <div class="searchItem" data-uid="${r.id}">
        <div class="sAvatar">
          ${r.avatar_url ? `<img src="${r.avatar_url}" alt="${safeText(name)}" />` : safeText(name.trim().charAt(0).toUpperCase() || "P")}
        </div>
        <div class="sText">
          <div class="sName">${safeText(name)}</div>
          <div class="sMeta">${safeText(meta || "")}</div>
        </div>
      </div>
    `;
  }).join("");

  elSearchDrop.style.display = "block";
}

/* Load feed */
async function loadFeed() {
  setStatus("Loading…");
  const ok = await requireLogin();
  if (!ok) return;

  const rows = await fetchPostsRaw();
  const first = rows[0] || null;

  cachedKeyset = detectKeys(first);

  const uKey = cachedKeyset.userKey;
  const postIds = [];
  const userIds = [];

  for (const r of rows) {
    if (cachedKeyset.idKey && r[cachedKeyset.idKey]) postIds.push(r[cachedKeyset.idKey]);
    if (uKey && r[uKey] && !userIds.includes(r[uKey])) userIds.push(r[uKey]);
  }

  const profMap = await fetchProfilesMap(userIds);
  const likeInfo = await fetchLikesForPosts(postIds);
  const commentInfo = await fetchCommentsForPosts(postIds);

  renderPosts(rows, profMap, likeInfo, commentInfo, cachedKeyset);

  setStatus("");
}

/* Events */
function wireEvents() {
  // Menu toggle
  if (elMeAvatarBtn && elMeMenu) {
    elMeAvatarBtn.addEventListener("click", () => {
      const open = elMeMenu.style.display === "block";
      elMeMenu.style.display = open ? "none" : "block";
    });

    document.addEventListener("click", (e) => {
      if (!elMeMenu.contains(e.target) && !elMeAvatarBtn.contains(e.target)) {
        elMeMenu.style.display = "none";
      }
    });
  }

  // Menu actions
  if (elMenuProfile) elMenuProfile.addEventListener("click", () => window.location.href = "/profile/home.html");
  if (elMenuSettings) elMenuSettings.addEventListener("click", () => window.location.href = "/dashboard/settings.html");
  if (elMenuLogout) elMenuLogout.addEventListener("click", async () => {
    await supabase.auth.signOut();
    window.location.href = "/auth/login.html";
  });

  // File choose
  if (elFileBtn && elPostFile) elFileBtn.addEventListener("click", () => elPostFile.click());
  if (elPostFile) elPostFile.addEventListener("change", (e) => setFileUI(e.target.files && e.target.files[0]));
  if (elClearFile) elClearFile.addEventListener("click", () => setFileUI(null));

  // Post
  if (elPostBtn) elPostBtn.addEventListener("click", createPost);

  // Post actions
  if (elList) {
    elList.addEventListener("click", async (e) => {
      const btn = e.target.closest("[data-action]");
      if (!btn) return;

      const postEl = e.target.closest("[data-post-id]");
      if (!postEl) return;

      const postId = postEl.getAttribute("data-post-id");
      const action = btn.getAttribute("data-action");

      if (action === "delete") {
        await deletePost(postId, cachedKeyset || { idKey: "id" });
        return;
      }

      if (action === "like") {
        const liked = btn.textContent.trim().toLowerCase().startsWith("unlike");
        await toggleLike(postId, liked);
        return;
      }

      if (action === "toggleComments") {
        const wrap = postEl.querySelector("[data-comments-wrap]");
        if (wrap) wrap.style.display = (wrap.style.display === "none" ? "block" : "none");
        return;
      }

      if (action === "sendComment") {
        const input = postEl.querySelector("[data-comment-input]");
        await sendComment(postId, input);
        return;
      }
    });
  }

  // Search
  if (elSearchInput && elSearchDrop) {
    elSearchInput.addEventListener("input", () => {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(() => runSearch(elSearchInput.value), 250);
    });

    elSearchDrop.addEventListener("click", (e) => {
      const item = e.target.closest(".searchItem");
      if (!item) return;
      const uid = item.getAttribute("data-uid");
      elSearchDrop.style.display = "none";
      elSearchInput.value = "";
      window.location.href = `/profile/user.html?uid=${encodeURIComponent(uid)}`;
    });

    document.addEventListener("click", (e) => {
      if (!elSearchDrop.contains(e.target) && !elSearchInput.contains(e.target)) {
        elSearchDrop.style.display = "none";
      }
    });
  }
}

/* Start */
wireEvents();
loadFeed();