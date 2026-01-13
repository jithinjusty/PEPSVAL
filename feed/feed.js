import { supabase, getCurrentUser } from "/js/supabase.js";

const MEDIA_BUCKET = "post_media";

let me = null;
let selectedFile = null;
let cachedKeyset = null;

const elStatus = document.getElementById("feedStatus");
const elList = document.getElementById("feedList");

const elPostText = document.getElementById("postText");
const elPostBtn = document.getElementById("postBtn");
const elFileBtn = document.getElementById("fileBtn");
const elFile = document.getElementById("postFile");
const elFileInfo = document.getElementById("fileInfo");
const elFileName = document.getElementById("fileName");
const elClearFile = document.getElementById("clearFile");

const elProgressWrap = document.getElementById("progressWrap");
const elProgressFill = document.getElementById("progressFill");
const elProgressPct = document.getElementById("progressPct");
const elProgressLabel = document.getElementById("progressLabel");

const elMeAvatarBtn = document.getElementById("meAvatarBtn");
const elMeMenu = document.getElementById("meMenu");
const elMenuProfile = document.getElementById("menuProfile");
const elMenuSettings = document.getElementById("menuSettings");
const elMenuLogout = document.getElementById("menuLogout");

const elSearchInput = document.getElementById("searchInput");
const elSearchDrop = document.getElementById("searchDrop");

let searchTimer = null;

/* ---------- Helpers ---------- */
function setStatus(msg) {
  if (!elStatus) return;
  elStatus.textContent = msg || "";
}

function toast(msg) {
  const el = document.getElementById("toast");
  if (!el) return alert(msg);
  el.textContent = msg;
  el.style.opacity = "1";
  el.style.transform = "translateY(0)";
  setTimeout(() => {
    el.style.opacity = "0";
    el.style.transform = "translateY(8px)";
  }, 2200);
}

function safeText(s) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function safeAttr(s) {
  return safeText(s).replaceAll("'", "&#039;");
}

function showProgress(on, label = "", pct = 0) {
  if (!elProgressWrap) return;
  elProgressWrap.style.display = on ? "block" : "none";
  if (on) {
    if (elProgressLabel) elProgressLabel.textContent = label || "";
    if (elProgressFill) elProgressFill.style.width = `${pct}%`;
    if (elProgressPct) elProgressPct.textContent = `${pct}%`;
  }
}

function setFileUI(file) {
  selectedFile = file || null;

  if (!elFileInfo || !elFileName || !elClearFile) return;
  if (!selectedFile) {
    elFileInfo.style.display = "none";
    elFileName.textContent = "";
    return;
  }

  elFileInfo.style.display = "flex";
  elFileName.textContent = selectedFile.name || "Attachment";
}

async function requireLogin() {
  me = await getCurrentUser();
  if (!me) {
    window.location.href = "/auth/login.html";
    return false;
  }
  return true;
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

/* ---------- Fetchers ---------- */
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

async function fetchProfilesMap(userIds) {
  if (!userIds.length) return new Map();

  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name, avatar_url, rank, country")
    .in("id", userIds);

  if (error) {
    console.error("Profiles fetch error:", error);
    return new Map();
  }

  const map = new Map();
  (data || []).forEach(p => map.set(p.id, p));
  return map;
}

async function fetchLikesForPosts(postIds) {
  if (!postIds.length) return { counts: new Map(), mine: new Set() };

  const { data, error } = await supabase
    .from("post_likes")
    .select("id, post_id, user_id")
    .in("post_id", postIds);

  if (error) {
    console.error("Likes fetch error:", error);
    return { counts: new Map(), mine: new Set() };
  }

  const counts = new Map();
  const mine = new Set();

  for (const l of (data || [])) {
    counts.set(l.post_id, (counts.get(l.post_id) || 0) + 1);
    if (me && l.user_id === me.id) mine.add(l.post_id);
  }

  return { counts, mine };
}

async function fetchCommentsForPosts(postIds) {
  if (!postIds.length) return { counts: new Map(), latest: new Map() };

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
  const latest = new Map();

  for (const c of (data || [])) {
    counts.set(c.post_id, (counts.get(c.post_id) || 0) + 1);

    const arr = latest.get(c.post_id) || [];
    if (arr.length < 2) arr.push(c);
    latest.set(c.post_id, arr);
  }

  return { counts, latest };
}

/* ---------- Rendering ---------- */
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

    const name = prof.full_name || prof.name || "Seafarer";
    const avatar = prof.avatar_url || "";
    const rank = prof.rank ? ` • ${safeText(prof.rank)}` : "";
    const country = prof.country ? ` • ${safeText(prof.country)}` : "";

    const content = keyset.contentKey ? (r[keyset.contentKey] || "") : (r.content || r.text || "");
    const media = keyset.mediaKey ? (r[keyset.mediaKey] || null) : (r.media_url || r.image_url || null);
    const created = keyset.createdKey ? r[keyset.createdKey] : (r.created_at || r.created);

    const likes = likeInfo.counts.get(pid) || 0;
    const iLiked = likeInfo.mine.has(pid);
    const commentsCount = commentInfo.counts.get(pid) || 0;
    const latest = commentInfo.latest.get(pid) || [];

    const isMine = (uid && me && uid === me.id);

    const mediaHtml = media ? `
      <div style="margin-top:10px;border-radius:14px;overflow:hidden;border:1px solid rgba(0,0,0,.08);background:#fff;">
        ${String(media).match(/\.(mp4|mov|webm)(\?|$)/i)
          ? `<video src="${safeAttr(media)}" controls style="width:100%;display:block"></video>`
          : `<img src="${safeAttr(media)}" alt="media" style="width:100%;display:block" />`}
      </div>` : "";

    const commentsHtml = latest.map(c => {
      const cp = profMap.get(c.user_id) || {};
      const cName = cp.full_name || cp.name || "Seafarer";
      const cAvatar = cp.avatar_url || "";
      const mine = (me && c.user_id === me.id);
      return `
        <div class="pv-commentRow">
          <div class="pv-commentAvatar">
            ${cAvatar ? `<img src="${safeAttr(cAvatar)}" alt="" />` : `<span>${safeText((cName||"S").slice(0,1))}</span>`}
          </div>
          <div class="pv-commentBody">
            <div class="pv-commentTop">
              <div class="pv-commentName">${safeText(cName)}</div>
              <div class="pv-commentMeta">${c.created_at ? new Date(c.created_at).toLocaleString() : ""}</div>
            </div>
            <div class="pv-commentText">${safeText(c.content || "")}</div>
          </div>
          ${mine ? `<button type="button" class="pv-linkBtn" data-action="deleteComment" data-comment-id="${safeAttr(c.id)}">Delete</button>` : ``}
        </div>
      `;
    }).join("");

    return `
      <article class="pv-post" data-post-id="${safeAttr(pid)}">
        <header class="pv-postHead">
          <div class="pv-user">
            <div class="pv-userAvatar">
              ${avatar ? `<img src="${safeAttr(avatar)}" alt="${safeAttr(name)}"/>` : `<span>${safeText(name.slice(0,1))}</span>`}
            </div>
            <div class="pv-userMeta">
              <div class="pv-userName">${safeText(name)}</div>
              <div class="pv-userSub">${safeText(rank)}${safeText(country)}</div>
            </div>
          </div>

          <div class="pv-postRight">
            <div class="pv-time">${created ? new Date(created).toLocaleString() : ""}</div>
            ${isMine ? `<button class="pv-linkBtn" type="button" data-action="delete">Delete</button>` : ``}
          </div>
        </header>

        <div class="pv-postText">${safeText(content)}</div>
        ${mediaHtml}

        <div class="pv-actions">
          <button class="pv-pillBtn" type="button" data-action="like">${iLiked ? "Unlike" : "Like"} (${likes})</button>
          <button class="pv-pillBtn" type="button" data-action="toggleComments">Comments (${commentsCount})</button>
        </div>

        <div class="pv-commentsWrap" data-comments-wrap style="display:none;">
          <div class="pv-commentsTitle">Comments</div>
          <div class="pv-commentsList">
            ${commentsHtml || `<div style="opacity:.7;font-size:13px;padding:8px 0;">No comments yet</div>`}
          </div>

          <div class="pv-commentComposer">
            <input data-comment-input placeholder="Write a comment…" />
            <button class="pv-btn" type="button" data-action="sendComment">Send</button>
          </div>
        </div>
      </article>
    `;
  }).join("");
}

/* ---------- Mutations ---------- */
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

async function insertPostWithFallback(content, mediaUrl, keyset) {
  // Prefer detected keys from existing rows (most reliable).
  const ks = keyset || cachedKeyset || {};
  const userKey = ks.userKey || "user_id";
  const contentKey = ks.contentKey || "content";
  const mediaKey = ks.mediaKey || "media_url";

  const base = {};
  base[userKey] = me.id;

  const attempts = [
    { ...base, [contentKey]: content || "", ...(mediaUrl ? { [mediaKey]: mediaUrl } : {}) },

    // common fallbacks
    { user_id: me.id, content: content || "", media_url: mediaUrl || null },
    { user_id: me.id, content: content || "", image_url: mediaUrl || null },
    { user_id: me.id, text: content || "", image_url: mediaUrl || null },
    { author_id: me.id, text: content || "", image_url: mediaUrl || null },
    { author_id: me.id, content: content || "", media_url: mediaUrl || null },
    { profile_id: me.id, body: content || "", media: mediaUrl || null },
    { uid: me.id, caption: content || "", media: mediaUrl || null }
  ];

  let lastErr = null;
  for (const payload of attempts) {
    Object.keys(payload).forEach(k => payload[k] === undefined && delete payload[k]);

    const { error } = await supabase.from("posts").insert([payload]);
    if (!error) return { ok: true, error: null };
    lastErr = error;

    const msg = (error.message || "").toLowerCase();
    if (!msg.includes("column") && !msg.includes("does not exist")) break;
  }

  console.error("Insert failed:", lastErr);
  return { ok: false, error: lastErr };
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
    // Ensure we have a reliable keyset from real data (prevents "Post failed")
    if (!cachedKeyset) {
      const rows = await fetchPostsRaw();
      cachedKeyset = detectKeys(rows[0] || null);
    }

    let mediaUrl = null;
    if (selectedFile) mediaUrl = await uploadMedia(selectedFile);

    const res = await insertPostWithFallback(content, mediaUrl, cachedKeyset);
    if (!res.ok) {
      const msg = res.error?.message ? `Post failed: ${res.error.message}` : "Post failed";
      toast(msg);
      return;
    }

    if (elPostText) elPostText.value = "";
    setFileUI(null);

    await new Promise(r => setTimeout(r, 200));
    await loadFeed();

    toast("Posted");
  } catch (e) {
    console.error(e);
    toast(e?.message ? `Upload/Save failed: ${e.message}` : "Upload/Save failed");
  } finally {
    elPostBtn.disabled = false;
    setStatus("");
  }
}

async function deletePost(postId, keyset) {
  if (!postId) return;

  const { error } = await supabase
    .from("posts")
    .delete()
    .eq(keyset?.idKey || "id", postId);

  if (error) {
    console.error(error);
    toast("Delete failed");
    return;
  }

  toast("Deleted");
  await loadFeed();
}

async function toggleLike(postId, liked) {
  if (!postId) return;

  if (liked) {
    const { error } = await supabase
      .from("post_likes")
      .delete()
      .eq("post_id", postId)
      .eq("user_id", me.id);

    if (error) {
      console.error(error);
      toast("Unlike failed");
      return;
    }
  } else {
    const { error } = await supabase
      .from("post_likes")
      .insert([{ post_id: postId, user_id: me.id }]);

    if (error) {
      console.error(error);
      toast("Like failed");
      return;
    }
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

async function deleteComment(commentId) {
  if (!commentId) return;
  if (!me) return;

  const { error } = await supabase
    .from("post_comments")
    .delete()
    .eq("id", commentId)
    .eq("user_id", me.id);

  if (error) {
    console.error(error);
    toast("Delete failed");
    return;
  }

  toast("Deleted");
  await loadFeed();
}

/* ---------- Search ---------- */
async function runSearch(q) {
  const text = (q || "").trim();
  if (!text) {
    elSearchDrop.style.display = "none";
    elSearchDrop.innerHTML = "";
    return;
  }

  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name, avatar_url, rank, country")
    .ilike("full_name", `%${text}%`)
    .limit(10);

  if (error) {
    console.error(error);
    elSearchDrop.style.display = "none";
    return;
  }

  const rows = data || [];
  if (!rows.length) {
    elSearchDrop.style.display = "none";
    elSearchDrop.innerHTML = "";
    return;
  }

  elSearchDrop.innerHTML = rows.map(r => `
    <div class="searchItem" data-uid="${safeAttr(r.id)}">
      <div class="sAv">
        ${r.avatar_url ? `<img src="${safeAttr(r.avatar_url)}" alt=""/>` : `<span>${safeText((r.full_name||"S").slice(0,1))}</span>`}
      </div>
      <div class="sMeta">
        <div class="sName">${safeText(r.full_name || "Seafarer")}</div>
        <div class="sSub">${safeText(r.rank || "")}${r.country ? " • " + safeText(r.country) : ""}</div>
      </div>
    </div>
  `).join("");

  elSearchDrop.style.display = "block";
}

/* ---------- Main ---------- */
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

  const likeInfo = await fetchLikesForPosts(postIds);
  const commentInfo = await fetchCommentsForPosts(postIds);

  // Add commenter ids too so we can show who commented
  const commenterIds = [];
  for (const arr of commentInfo.latest.values()) {
    for (const c of arr) {
      if (c.user_id && !userIds.includes(c.user_id) && !commenterIds.includes(c.user_id)) {
        commenterIds.push(c.user_id);
      }
    }
  }

  const profMap = await fetchProfilesMap(userIds.concat(commenterIds));

  renderPosts(rows, profMap, likeInfo, commentInfo, cachedKeyset);

  setStatus("");
}

document.addEventListener("DOMContentLoaded", async () => {
  await requireLogin();

  // Avatar menu
  if (elMeAvatarBtn && elMeMenu) {
    elMeAvatarBtn.addEventListener("click", (e) => {
      e.preventDefault();
      elMeMenu.style.display = (elMeMenu.style.display === "block" ? "none" : "block");
    });

    document.addEventListener("click", (e) => {
      if (!elMeMenu.contains(e.target) && !elMeAvatarBtn.contains(e.target)) {
        elMeMenu.style.display = "none";
      }
    });
  }

  if (elMenuProfile) elMenuProfile.addEventListener("click", () => (window.location.href = "/profile/home.html"));
  if (elMenuSettings) elMenuSettings.addEventListener("click", () => (window.location.href = "/dashboard/settings.html"));

  if (elMenuLogout) elMenuLogout.addEventListener("click", async () => {
    await supabase.auth.signOut();
    window.location.href = "/auth/login.html";
  });

  // File choose
  if (elFileBtn && elFile) elFileBtn.addEventListener("click", () => elFile.click());

  if (elFile) {
    elFile.addEventListener("change", () => {
      const file = elFile.files?.[0] || null;
      setFileUI(file);
    });
  }

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

      if (action === "deleteComment") {
        const cid = btn.getAttribute("data-comment-id");
        await deleteComment(cid);
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

  await loadFeed();
});
