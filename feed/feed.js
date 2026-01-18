import { supabase, getCurrentUser } from "/js/supabase.js";

/* =========================================================
   PEPSVAL FEED — FINAL BUG-FIX BUILD
   - Robust avatar everywhere
   - Avatar menu: settings + logout
   - Posts: create (media upload), delete
   - Likes + comments: instant update (no reload)
   - Comment likes + delete: safe (won’t crash if table/policy missing)
   - Clear on-screen errors when Supabase blocks (RLS/policy)
========================================================= */

const MEDIA_BUCKET = "post_media";

/* ---------- DOM ---------- */
const $ = (id) => document.getElementById(id);

const elStatus = $("feedStatus");
const elList = $("feedList");

const elPostText = $("postText");
const elPostBtn = $("postBtn");
const elFileBtn = $("fileBtn");
const elFile = $("postFile");
const elFileInfo = $("fileInfo");
const elFileName = $("fileName");
const elClearFile = $("clearFile");

const elProgressWrap = $("progressWrap");
const elProgressFill = $("progressFill");
const elProgressPct = $("progressPct");
const elProgressLabel = $("progressLabel");

// Avatar/menu
const elMeAvatarBtn = $("meAvatarBtn");
const elMeMenu = $("meMenu");
const elMenuProfile = $("menuProfile");
const elMenuSettings = $("menuSettings");
const elMenuLogout = $("menuLogout");
const elMeAvatarImg = elMeAvatarBtn ? elMeAvatarBtn.querySelector("img.avatar") : null;

/* ---------- State ---------- */
let me = null;
let selectedFile = null;

/* ---------- UI helpers ---------- */
function setStatus(msg = "") { if (elStatus) elStatus.textContent = msg; }
function esc(s) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
function toast(msg) {
  const t = $("toast");
  if (!t) return alert(msg);
  t.textContent = msg;
  t.style.opacity = "1";
  t.style.transform = "translateX(-50%) translateY(0)";
  setTimeout(() => {
    t.style.opacity = "0";
    t.style.transform = "translateX(-50%) translateY(8px)";
  }, 2600);
}
function showProgress(on, label = "", pct = 0) {
  if (!elProgressWrap) return;
  elProgressWrap.style.display = on ? "block" : "none";
  if (!on) return;
  if (elProgressLabel) elProgressLabel.textContent = label;
  if (elProgressFill) elProgressFill.style.width = `${pct}%`;
  if (elProgressPct) elProgressPct.textContent = `${pct}%`;
}
function safeDate(v) {
  if (!v) return "";
  try { return new Date(v).toLocaleString(); } catch { return ""; }
}

/* ---------- Error surfacing (so you SEE what's failing) ---------- */
function showDbError(prefix, err) {
  const msg = err?.message || String(err || "Unknown error");
  console.error(prefix, err);
  setStatus(`❌ ${prefix}: ${msg}`);
  toast(`${prefix}: ${msg}`);
}

/* ---------- Auth ---------- */
async function requireLogin() {
  me = await getCurrentUser();
  if (!me) {
    toast("Not logged in — redirecting");
    window.location.href = "/auth/login.html";
    return false;
  }
  return true;
}

/* ---------- Avatar menu ---------- */
function setMenuOpen(open) {
  if (!elMeMenu) return;
  elMeMenu.style.display = open ? "block" : "none";
}
function isMenuOpen() {
  return !!elMeMenu && elMeMenu.style.display === "block";
}
function bindAvatarMenu() {
  if (!elMeAvatarBtn || !elMeMenu) return;

  elMeAvatarBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    setMenuOpen(!isMenuOpen());
  });

  document.addEventListener("click", (e) => {
    if (!isMenuOpen()) return;
    const inside = elMeMenu.contains(e.target) || elMeAvatarBtn.contains(e.target);
    if (!inside) setMenuOpen(false);
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") setMenuOpen(false);
  });

  elMenuProfile?.addEventListener("click", () => {
    setMenuOpen(false);
    window.location.href = "/profile/home.html";
  });

  elMenuSettings?.addEventListener("click", () => {
    setMenuOpen(false);
    window.location.href = "/dashboard/settings.html";
  });

  elMenuLogout?.addEventListener("click", async () => {
    try {
      setMenuOpen(false);
      setStatus("Logging out…");
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      window.location.href = "/auth/login.html";
    } catch (err) {
      showDbError("Logout failed", err);
      setStatus("");
    }
  });
}

/* ---------- Avatar load (top-right) ---------- */
async function loadMyAvatar() {
  if (!me?.id || !elMeAvatarImg) return;
  try {
    const { data, error } = await supabase
      .from("profiles")
      .select("avatar_url, full_name")
      .eq("id", me.id)
      .maybeSingle();
    if (error) throw error;
    if (data?.avatar_url) elMeAvatarImg.src = data.avatar_url;
    if (data?.full_name) elMeAvatarImg.alt = data.full_name;
  } catch (e) {
    // do not crash feed
    console.warn("Top avatar failed:", e?.message || e);
  }
}

/* ---------- Composer ---------- */
function setFileUI(file) {
  selectedFile = file || null;

  if (!elFileInfo || !elFileName) return;
  if (!selectedFile) {
    elFileInfo.style.display = "none";
    elFileName.textContent = "";
    return;
  }
  elFileInfo.style.display = "flex";
  elFileName.textContent = selectedFile.name || "Attachment";
}

function bindComposer() {
  elFileBtn?.addEventListener("click", () => elFile?.click());

  elFile?.addEventListener("change", () => {
    const f = elFile.files && elFile.files[0];
    setFileUI(f || null);
  });

  elClearFile?.addEventListener("click", () => {
    if (elFile) elFile.value = "";
    setFileUI(null);
  });

  elPostBtn?.addEventListener("click", createPost);
}

/* ---------- Media upload ---------- */
async function uploadMedia(file) {
  if (!file) return null;

  const ext = (file.name.split(".").pop() || "bin").toLowerCase();
  const path = `${me.id}/${Date.now()}_${Math.random().toString(16).slice(2)}.${ext}`;

  showProgress(true, "Uploading…", 5);

  const { error: upErr } = await supabase.storage
    .from(MEDIA_BUCKET)
    .upload(path, file, { upsert: false });

  if (upErr) throw upErr;

  showProgress(true, "Finishing…", 85);

  const { data: pub } = supabase.storage.from(MEDIA_BUCKET).getPublicUrl(path);
  const url = pub?.publicUrl || null;

  showProgress(true, "Done", 100);
  setTimeout(() => showProgress(false), 650);

  return url;
}

/* ---------- Schema detection ---------- */
function detectPostKeys(row) {
  const keys = row ? Object.keys(row) : [];
  const pick = (arr) => arr.find(k => keys.includes(k)) || null;
  return {
    idKey: pick(["id", "post_id"]),
    userKey: pick(["user_id", "author_id", "uid", "profile_id"]),
    contentKey: pick(["content", "body", "text", "caption", "post_text"]),
    mediaKey: pick(["media_url", "image_url", "photo_url", "video_url", "media"]),
    createdKey: pick(["created_at", "created", "timestamp"]),
  };
}
function getPostId(p, ks) { return (ks.idKey ? p[ks.idKey] : p.id) ?? null; }
function getPostUserId(p, ks) { return (ks.userKey ? p[ks.userKey] : (p.user_id || p.author_id)) ?? null; }
function getPostText(p, ks) { return (ks.contentKey ? p[ks.contentKey] : (p.content || p.body || "")) ?? ""; }
function getPostMedia(p, ks) { return (ks.mediaKey ? p[ks.mediaKey] : (p.media_url || null)) ?? null; }
function getPostCreated(p, ks) { return (ks.createdKey ? p[ks.createdKey] : (p.created_at || null)) ?? null; }

/* ---------- Data fetch ---------- */
async function fetchPosts() {
  let res = await supabase.from("posts").select("*").order("created_at", { ascending: false }).limit(50);
  if (res.error) res = await supabase.from("posts").select("*").order("id", { ascending: false }).limit(50);
  if (res.error) throw res.error;
  return res.data || [];
}

async function fetchProfilesMap(userIds) {
  if (!userIds.length) return new Map();

  let res = await supabase
    .from("profiles")
    .select("id, full_name, avatar_url, rank, country")
    .in("id", userIds);

  if (res.error && /column .*country.* does not exist/i.test(res.error.message)) {
    res = await supabase
      .from("profiles")
      .select("id, full_name, avatar_url, rank")
      .in("id", userIds);
  }

  if (res.error) throw res.error;

  const map = new Map();
  (res.data || []).forEach(p => map.set(p.id, p));
  return map;
}

async function fetchLikes(postIds) {
  const counts = new Map();
  const mine = new Set();
  if (!postIds.length) return { counts, mine };

  const { data, error } = await supabase
    .from("post_likes")
    .select("post_id, user_id")
    .in("post_id", postIds);

  if (error) throw error;

  for (const l of (data || [])) {
    counts.set(l.post_id, (counts.get(l.post_id) || 0) + 1);
    if (l.user_id === me.id) mine.add(l.post_id);
  }
  return { counts, mine };
}

async function fetchComments(postIds) {
  const counts = new Map();
  const byPost = new Map();
  if (!postIds.length) return { counts, byPost };

  const { data, error } = await supabase
    .from("post_comments")
    .select("id, post_id, user_id, body, content, created_at")
    .in("post_id", postIds)
    .order("created_at", { ascending: true });

  if (error) throw error;

  for (const c of (data || [])) {
    counts.set(c.post_id, (counts.get(c.post_id) || 0) + 1);
    const arr = byPost.get(c.post_id) || [];
    arr.push(c);
    byPost.set(c.post_id, arr);
  }
  return { counts, byPost };
}

/* comment_likes is optional; don’t crash if missing */
async function fetchCommentLikes(commentIds) {
  const counts = new Map();
  const mine = new Set();
  if (!commentIds.length) return { counts, mine, available: false };

  const { data, error } = await supabase
    .from("comment_likes")
    .select("comment_id, user_id")
    .in("comment_id", commentIds);

  if (error) {
    console.warn("comment_likes not available:", error.message);
    return { counts, mine, available: false };
  }

  for (const l of (data || [])) {
    counts.set(l.comment_id, (counts.get(l.comment_id) || 0) + 1);
    if (l.user_id === me.id) mine.add(l.comment_id);
  }
  return { counts, mine, available: true };
}

/* ---------- Render helpers ---------- */
function renderMedia(url) {
  if (!url) return "";
  const u = String(url);
  if (u.match(/\.(mp4|mov|webm)(\?|$)/i)) {
    return `<div class="pv-media"><video class="pv-mediaEl" src="${esc(u)}" controls></video></div>`;
  }
  return `<div class="pv-media"><img class="pv-mediaEl" src="${esc(u)}" alt="media"></div>`;
}

function renderCommentRow(c, profMap, cLikeInfo) {
  const uid = c.user_id;
  const prof = uid ? (profMap.get(uid) || {}) : {};
  const name = prof.full_name || "Seafarer";
  const avatar = prof.avatar_url || "";
  const text = c.body || c.content || "";
  const mine = uid === me.id;

  const clCount = cLikeInfo.counts.get(c.id) || 0;
  const clMine = cLikeInfo.mine.has(c.id);
  const clAvail = cLikeInfo.available;

  return `
    <div class="pv-commentRow" data-comment-id="${esc(c.id)}">
      <div class="pv-commentAvatar">
        ${avatar ? `<img src="${esc(avatar)}" alt="">` : `<span>${esc(name.slice(0, 1))}</span>`}
      </div>
      <div class="pv-commentBody">
        <div class="pv-commentTop">
          <div class="pv-commentName">${esc(name)}</div>
          <div class="pv-commentMeta">${esc(safeDate(c.created_at))}</div>
        </div>
        <div class="pv-commentText">${esc(text)}</div>
        <div class="pv-commentActions">
          ${clAvail ? `<button class="pv-linkBtn" data-action="likeComment" data-comment-id="${esc(c.id)}">${clMine ? "Unlike" : "Like"} (${clCount})</button>` : ``}
          ${mine ? `<button class="pv-linkBtn" data-action="deleteComment" data-comment-id="${esc(c.id)}">Delete</button>` : ``}
        </div>
      </div>
    </div>
  `;
}

function renderFeed(posts, ks, profMap, likeInfo, commentInfo, cLikeInfo) {
  if (!elList) return;

  if (!posts.length) {
    elList.innerHTML = `<div style="opacity:.7;padding:14px;">No posts yet</div>`;
    return;
  }

  elList.innerHTML = posts.map(p => {
    const pid = getPostId(p, ks);
    const uid = getPostUserId(p, ks);

    const prof = uid ? (profMap.get(uid) || {}) : {};
    const name = prof.full_name || "Seafarer";
    const avatar = prof.avatar_url || "";
    const rank = prof.rank ? ` • ${esc(prof.rank)}` : "";
    const country = prof.country ? ` • ${esc(prof.country)}` : "";

    const text = getPostText(p, ks);
    const media = getPostMedia(p, ks);
    const created = getPostCreated(p, ks);

    const likes = likeInfo.counts.get(pid) || 0;
    const iLiked = likeInfo.mine.has(pid);

    const commCount = commentInfo.counts.get(pid) || 0;
    const comments = commentInfo.byPost.get(pid) || [];

    const isMine = (uid === me.id);

    return `
      <article class="pv-post" data-post-id="${esc(pid)}">
        <header class="pv-postHead">
          <div class="pv-user">
            <div class="pv-userAvatar">
              ${avatar ? `<img src="${esc(avatar)}" alt="${esc(name)}">` : `<span>${esc(name.slice(0, 1))}</span>`}
            </div>
            <div class="pv-userMeta">
              <div class="pv-userName">${esc(name)}</div>
              <div class="pv-userSub">${rank}${country}</div>
            </div>
          </div>
          <div class="pv-postRight">
            <div class="pv-time">${esc(safeDate(created))}</div>
            ${isMine ? `<button class="pv-linkBtn" data-action="deletePost">Delete</button>` : ``}
          </div>
        </header>

        <div class="pv-postText">${esc(text)}</div>
        ${renderMedia(media)}

        <div class="pv-actions">
          <button class="pv-pillBtn" data-action="toggleLike">${iLiked ? "Unlike" : "Like"} (<span data-like-count>${likes}</span>)</button>
          <button class="pv-pillBtn" data-action="toggleComments">Comments (<span data-comment-count>${commCount}</span>)</button>
        </div>

        <div class="pv-commentsWrap" data-comments style="display:none;">
          <div class="pv-commentsTitle">Comments</div>
          <div class="pv-commentsList">
            ${comments.length ? comments.map(c => renderCommentRow(c, profMap, cLikeInfo)).join("") : `<div style="opacity:.7;padding:8px 0;">No comments yet</div>`}
          </div>

          <div class="pv-commentComposer">
            <input data-comment-input placeholder="Write a comment…" />
            <button class="pv-btn" data-action="sendComment">Send</button>
          </div>
        </div>
      </article>
    `;
  }).join("");
}

/* ---------- Mutations (instant UI) ---------- */
async function createPost() {
  const text = (elPostText?.value || "").trim();
  if (!text && !selectedFile) return toast("Write something or attach a file.");

  try {
    elPostBtn && (elPostBtn.disabled = true);
    setStatus("Posting…");

    let mediaUrl = null;
    if (selectedFile) mediaUrl = await uploadMedia(selectedFile);

    let res = await supabase.from("posts").insert([{
      user_id: me.id,
      content: text,
      media_url: mediaUrl,
      created_at: new Date().toISOString()
    }]).select("*").maybeSingle();

    if (res.error) {
      // fallback schema
      res = await supabase.from("posts").insert([{
        user_id: me.id,
        body: text,
        media_url: mediaUrl
      }]).select("*").maybeSingle();
    }

    if (res.error) throw res.error;

    // reset composer
    if (elPostText) elPostText.value = "";
    if (elFile) elFile.value = "";
    setFileUI(null);

    toast("Posted");
    setStatus("");

    // Reload list (safe + consistent)
    await loadFeed();
  } catch (e) {
    showDbError("Post failed", e);
    setStatus("");
  } finally {
    elPostBtn && (elPostBtn.disabled = false);
  }
}

async function deletePost(postId) {
  if (!postId) return;
  if (!confirm("Delete this post?")) return;

  try {
    setStatus("Deleting…");
    const { error } = await supabase.from("posts").delete().eq("id", postId).eq("user_id", me.id);
    if (error) throw error;

    // instant DOM remove
    const el = elList.querySelector(`article[data-post-id="${CSS.escape(postId)}"]`);
    el?.remove();

    toast("Deleted");
    setStatus("");
  } catch (e) {
    showDbError("Delete post failed", e);
    setStatus("");
  }
}

async function toggleLike(postId, postEl) {
  const btn = postEl.querySelector('[data-action="toggleLike"]');
  const countEl = postEl.querySelector("[data-like-count]");
  if (!btn || !countEl) return;

  const currentlyLiked = btn.textContent.trim().toLowerCase().startsWith("unlike");
  let count = Number(countEl.textContent || "0");

  // optimistic UI
  if (currentlyLiked) { count = Math.max(0, count - 1); }
  else { count = count + 1; }
  countEl.textContent = String(count);
  btn.firstChild.textContent = currentlyLiked ? "Like (" : "Unlike ("; // keep label stable-ish

  try {
    if (currentlyLiked) {
      const { error } = await supabase.from("post_likes").delete().eq("post_id", postId).eq("user_id", me.id);
      if (error) throw error;
    } else {
      // insert (if duplicate happens, policy/table should have unique; if not, this still works mostly)
      const { error } = await supabase.from("post_likes").insert([{ post_id: postId, user_id: me.id }]);
      if (error) throw error;
    }
  } catch (e) {
    // rollback UI
    if (currentlyLiked) countEl.textContent = String(count + 1);
    else countEl.textContent = String(Math.max(0, count - 1));
    btn.firstChild.textContent = currentlyLiked ? "Unlike (" : "Like (";
    showDbError("Like failed", e);
  }
}

async function sendComment(postId, postEl) {
  const wrap = postEl.querySelector("[data-comments]");
  const input = wrap?.querySelector("[data-comment-input]");
  const list = wrap?.querySelector(".pv-commentsList");
  const countEl = postEl.querySelector("[data-comment-count]");

  const txt = (input?.value || "").trim();
  if (!txt) return;

  // optimistic UI append
  const node = document.createElement("div");
  node.className = "pv-comment";
  node.innerHTML = `<div class="pv-commentText">${esc(txt)}</div><div class="pv-commentMeta">${esc(new Date().toLocaleString())}</div>`;
  if (list) list.appendChild(node);

  if (countEl) countEl.textContent = String(Number(countEl.textContent || "0") + 1);
  if (input) input.value = "";

  try {
    let res = await supabase.from("post_comments").insert([{
      post_id: postId,
      user_id: me.id,
      body: txt,
      created_at: new Date().toISOString()
    }]);

    if (res.error) {
      res = await supabase.from("post_comments").insert([{
        post_id: postId,
        user_id: me.id,
        content: txt
      }]);
    }

    if (res.error) throw res.error;

  } catch (e) {
    // rollback optimistic UI
    node.remove();
    if (countEl) countEl.textContent = String(Math.max(0, Number(countEl.textContent || "1") - 1));
    showDbError("Comment failed", e);
  }
}

async function toggleCommentLike(commentId, btn) {
  const currentlyLiked = btn.textContent.trim().toLowerCase().startsWith("unlike");
  const m = btn.textContent.match(/\((\d+)\)/);
  let count = m ? Number(m[1]) : 0;

  // optimistic label
  count = currentlyLiked ? Math.max(0, count - 1) : count + 1;
  btn.textContent = `${currentlyLiked ? "Like" : "Unlike"} (${count})`;

  try {
    if (currentlyLiked) {
      const { error } = await supabase.from("comment_likes").delete().eq("comment_id", commentId).eq("user_id", me.id);
      if (error) throw error;
    } else {
      const { error } = await supabase.from("comment_likes").insert([{ comment_id: commentId, user_id: me.id }]);
      if (error) throw error;
    }
  } catch (e) {
    // rollback
    count = currentlyLiked ? count + 1 : Math.max(0, count - 1);
    btn.textContent = `${currentlyLiked ? "Unlike" : "Like"} (${count})`;
    showDbError("Comment like failed", e);
  }
}

async function deleteComment(commentId, rowEl) {
  if (!confirm("Delete this comment?")) return;
  try {
    const { error } = await supabase.from("post_comments").delete().eq("id", commentId).eq("user_id", me.id);
    if (error) throw error;
    rowEl.remove();
    toast("Comment deleted");
  } catch (e) {
    showDbError("Delete comment failed", e);
  }
}

/* ---------- Events ---------- */
function bindFeedEvents() {
  if (!elList) return;

  elList.addEventListener("click", async (e) => {
    const btn = e.target.closest("[data-action]");
    if (!btn) return;

    const postEl = e.target.closest("article[data-post-id]");
    const postId = postEl?.getAttribute("data-post-id");
    const action = btn.getAttribute("data-action");

    if (action === "toggleComments") {
      const wrap = postEl.querySelector("[data-comments]");
      if (!wrap) return;
      wrap.style.display = (wrap.style.display === "none" || !wrap.style.display) ? "block" : "none";
      return;
    }

    if (action === "toggleLike") return await toggleLike(postId, postEl);
    if (action === "sendComment") return await sendComment(postId, postEl);
    if (action === "deletePost") return await deletePost(postId);

    if (action === "likeComment") {
      const cid = btn.getAttribute("data-comment-id");
      return await toggleCommentLike(cid, btn);
    }

    if (action === "deleteComment") {
      const cid = btn.getAttribute("data-comment-id");
      const row = btn.closest(".pv-commentRow");
      return await deleteComment(cid, row);
    }
  });
}

/* ---------- Main load ---------- */
async function loadFeed() {
  try {
    setStatus("Loading feed…");

    const posts = await fetchPosts();
    const ks = detectPostKeys(posts[0] || {});

    const postIds = [];
    const userIds = [];

    for (const p of posts) {
      const pid = getPostId(p, ks);
      if (pid) postIds.push(pid);

      const uid = getPostUserId(p, ks);
      if (uid) userIds.push(uid);
    }

    const likesInfo = await fetchLikes(postIds);
    const commentsInfo = await fetchComments(postIds);

    // collect commenters for avatar
    const commentIds = [];
    for (const arr of commentsInfo.byPost.values()) {
      for (const c of arr) {
        if (c.id) commentIds.push(c.id);
        if (c.user_id) userIds.push(c.user_id);
      }
    }

    const profMap = await fetchProfilesMap([...new Set(userIds.filter(Boolean))]);
    const cLikeInfo = await fetchCommentLikes(commentIds);

    renderFeed(posts, ks, profMap, likesInfo, commentsInfo, cLikeInfo);

    setStatus("");
  } catch (e) {
    showDbError("Feed load failed", e);
  }
}

/* ---------- Boot ---------- */
document.addEventListener("DOMContentLoaded", async () => {
  window.addEventListener("error", (e) => showDbError("Script error", e?.error || e?.message));
  window.addEventListener("unhandledrejection", (e) => showDbError("Promise error", e?.reason));

  const ok = await requireLogin();
  if (!ok) return;

  bindAvatarMenu();
  await loadMyAvatar();

  bindComposer();
  bindFeedEvents();

  await loadFeed();

  // --- PROFILE SEARCH LOGIC ---
  const searchInput = $("searchInput");
  const searchDrop = $("searchDrop");

  if (searchInput) {
    searchInput.addEventListener("input", async () => {
      const q = searchInput.value.trim();
      if (q.length < 2) {
        if (searchDrop) searchDrop.style.display = "none";
        return;
      }

      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, avatar_url, rank")
        .ilike("full_name", `%${q}%`)
        .limit(10);

      if (error) {
        console.error("Profile search error:", error);
        return;
      }

      if (searchDrop) {
        if (!data || data.length === 0) {
          searchDrop.innerHTML = `<div style="padding:10px; font-size:13px; color:#888;">No users found for "${q}"</div>`;
        } else {
          searchDrop.innerHTML = data.map(p => `
            <div class="searchItem" onclick="window.location.href='/profile/user.html?id=${p.id}'" style="display:flex; gap:10px; padding:10px; border-bottom:1px solid #eee; cursor:pointer; align-items:center;">
              <div class="sAv" style="width:34px; height:34px; border-radius:18px; overflow:hidden; border:1px solid #eee; background:#f0f2f5; display:flex; align-items:center; justify-content:center; flex-shrink:0;">
                ${p.avatar_url ? `<img src="${p.avatar_url}" style="width:100%; height:100%; object-fit:cover;">` : `<span style="font-weight:900; color:#1f6f86;">${(p.full_name || "U").slice(0, 1)}</span>`}
              </div>
              <div class="sMeta" style="min-width:0;">
                <div class="sName" style="font-weight:800; font-size:14px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${esc(p.full_name)}</div>
                <div class="sSub" style="font-size:12px; opacity:.7; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${esc(p.rank || "Seafarer")}</div>
              </div>
            </div>
          `).join("");
        }
        searchDrop.style.display = "block";
      }
    });

    document.addEventListener("click", (e) => {
      if (searchDrop && !searchInput.contains(e.target) && !searchDrop.contains(e.target)) {
        searchDrop.style.display = "none";
      }
    });
  }
});
