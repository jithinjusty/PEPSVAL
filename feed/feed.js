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

/* ---------------- UI helpers ---------------- */
function setStatus(msg) {
  if (!elStatus) return;
  elStatus.textContent = msg || "";
}
function toast(msg) {
  const el = document.getElementById("toast");
  if (!el) return alert(msg);
  el.textContent = msg;
  el.style.opacity = "1";
  el.style.transform = "translateX(-50%) translateY(0)";
  setTimeout(() => {
    el.style.opacity = "0";
    el.style.transform = "translateX(-50%) translateY(8px)";
  }, 2600);
}

function showFatal(err) {
  const msg = (err?.message || err || "").toString();
  console.error(err);
  setStatus(`❌ ${msg}`);
  toast(msg);
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

/* Show ANY JS error directly on screen */
window.addEventListener("error", (e) => showFatal(e?.error || e?.message || "Script error"));
window.addEventListener("unhandledrejection", (e) => showFatal(e?.reason || "Unhandled promise rejection"));

/* ---------------- Auth ---------------- */
async function requireLogin() {
  me = await getCurrentUser();

  if (!me) {
    showFatal("Not logged in. Redirecting to login…");
    window.location.href = "/auth/login.html";
    return false;
  }
  return true;
}

/* ---------------- Key detection (robust) ---------------- */
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

/* ---------------- Diagnostics ---------------- */
async function supabaseSelfTest() {
  setStatus("Checking database access…");

  const { data: sessionData, error: sessionErr } = await supabase.auth.getSession();
  if (sessionErr) throw sessionErr;
  if (!sessionData?.session) throw new Error("No Supabase session on this page (auth not loaded).");

  const t1 = await supabase.from("posts").select("*").limit(1);
  if (t1.error) throw new Error(`posts SELECT blocked: ${t1.error.message}`);

  const t2 = await supabase.from("post_comments").select("*").limit(1);
  if (t2.error) throw new Error(`post_comments SELECT blocked: ${t2.error.message}`);

  const t3 = await supabase.from("post_likes").select("*").limit(1);
  if (t3.error) throw new Error(`post_likes SELECT blocked: ${t3.error.message}`);

  setStatus("");
}

/* ---------------- Fetchers ---------------- */
async function fetchPostsRaw() {
  let res = await supabase.from("posts").select("*").order("created_at", { ascending: false }).limit(50);
  if (res.error) res = await supabase.from("posts").select("*").order("id", { ascending: false }).limit(50);

  if (res.error) throw new Error(`Feed load failed: ${res.error.message}`);
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

  if (res.error) throw new Error(`Profiles load failed: ${res.error.message}`);

  const map = new Map();
  (res.data || []).forEach(p => map.set(p.id, p));
  return map;
}

async function fetchLikesForPosts(postIds) {
  const counts = new Map();
  const mine = new Set();
  if (!postIds.length) return { counts, mine };

  const { data, error } = await supabase
    .from("post_likes")
    .select("post_id, user_id")
    .in("post_id", postIds);

  if (error) throw new Error(`Likes load failed: ${error.message}`);

  for (const l of (data || [])) {
    counts.set(l.post_id, (counts.get(l.post_id) || 0) + 1);
    if (me && l.user_id === me.id) mine.add(l.post_id);
  }

  return { counts, mine };
}

async function fetchCommentsForPosts(postIds) {
  const counts = new Map();
  const latest = new Map();
  if (!postIds.length) return { counts, latest };

  const { data, error } = await supabase
    .from("post_comments")
    .select("id, post_id, user_id, author_id, body, content, created_at, parent_id")
    .in("post_id", postIds)
    .order("created_at", { ascending: true });

  if (error) throw new Error(`Comments load failed: ${error.message}`);

  for (const c of (data || [])) {
    counts.set(c.post_id, (counts.get(c.post_id) || 0) + 1);
    const arr = latest.get(c.post_id) || [];
    arr.push(c);
    latest.set(c.post_id, arr);
  }

  return { counts, latest };
}

async function fetchCommentLikes(commentIds) {
  const counts = new Map();
  const mine = new Set();
  if (!commentIds.length) return { counts, mine };

  const { data, error } = await supabase
    .from("comment_likes")
    .select("comment_id, user_id")
    .in("comment_id", commentIds);

  if (error) throw new Error(`Comment likes load failed: ${error.message}`);

  for (const l of (data || [])) {
    counts.set(l.comment_id, (counts.get(l.comment_id) || 0) + 1);
    if (me && l.user_id === me.id) mine.add(l.comment_id);
  }
  return { counts, mine };
}

/* ---------------- Rendering helpers ---------------- */
function buildCommentTree(comments) {
  const byId = new Map();
  const roots = [];
  comments.forEach(c => {
    c.children = [];
    byId.set(c.id, c);
  });
  comments.forEach(c => {
    if (c.parent_id && byId.has(c.parent_id)) {
      byId.get(c.parent_id).children.push(c);
    } else {
      roots.push(c);
    }
  });
  return roots;
}

function renderCommentNode(c, profMap, likeInfo, depth = 0) {
  const commenterId = c.user_id || c.author_id;
  const cp = commenterId ? (profMap.get(commenterId) || {}) : {};
  const cName = cp.full_name || "Seafarer";
  const cAvatar = cp.avatar_url || "";
  const mine = (me && commenterId === me.id);
  const text = (c.content || c.body || "");
  const likes = likeInfo.counts.get(c.id) || 0;
  const iLiked = likeInfo.mine.has(c.id);

  const childrenHtml = (c.children || []).map(ch => renderCommentNode(ch, profMap, likeInfo, depth + 1)).join("");

  return `
  <div class="pv-commentRow" data-comment-id="${safeAttr(c.id)}" style="margin-left:${depth * 14}px">
    <div class="pv-commentAvatar">
      ${cAvatar ? `<img src="${safeAttr(cAvatar)}" alt="" />` : `<span>${safeText((cName||"S").slice(0,1))}</span>`}
    </div>
    <div class="pv-commentBody">
      <div class="pv-commentTop">
        <div class="pv-commentName">${safeText(cName)}</div>
        <div class="pv-commentMeta">${c.created_at ? new Date(c.created_at).toLocaleString() : ""}</div>
      </div>
      <div class="pv-commentText">${safeText(text)}</div>
      <div class="pv-commentActions">
        <button class="pv-linkBtn" data-action="likeComment" data-comment-id="${safeAttr(c.id)}">
          ${iLiked ? "Unlike" : "Like"} (${likes})
        </button>
        <button class="pv-linkBtn" data-action="replyComment" data-comment-id="${safeAttr(c.id)}">Reply</button>
        ${mine ? `<button class="pv-linkBtn" data-action="deleteComment" data-comment-id="${safeAttr(c.id)}">Delete</button>` : ``}
      </div>
      <div class="pv-replyBox" data-reply-box="${safeAttr(c.id)}" style="display:none;">
        <input class="pv-replyInput" placeholder="Write a reply…" />
        <button class="pv-btn" data-action="sendReply" data-comment-id="${safeAttr(c.id)}">Send</button>
      </div>
      ${childrenHtml}
    </div>
  </div>`;
}

/* ---------------- Rendering ---------------- */
function renderPosts(rows, profMap, likeInfo, commentInfo, keyset, commentLikeInfo) {
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
    const country = prof.country ? ` • ${safeText(prof.country)}` : "";

    const content = keyset.contentKey ? (r[keyset.contentKey] || "") : "";
    const media = keyset.mediaKey ? (r[keyset.mediaKey] || null) : null;
    const created = keyset.createdKey ? r[keyset.createdKey] : null;

    const likes = likeInfo.counts.get(pid) || 0;
    const iLiked = likeInfo.mine.has(pid);
    const commentsCount = commentInfo.counts.get(pid) || 0;
    const flatComments = commentInfo.latest.get(pid) || [];
    const tree = buildCommentTree(flatComments);
    const commentsHtml = tree.map(c => renderCommentNode(c, profMap, commentLikeInfo)).join("");

    const isMine = (me && (r.user_id === me.id || r.author_id === me.id));

    const mediaHtml = media ? `
      <div class="pv-media">
        ${String(media).match(/\.(mp4|mov|webm)(\?|$)/i)
          ? `<video src="${safeAttr(media)}" class="pv-mediaEl" controls></video>`
          : `<img src="${safeAttr(media)}" class="pv-mediaEl" alt="media" />`}
      </div>` : "";

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
            <div>
              ${isMine ? `<button class="pv-linkBtn" type="button" data-action="deletePost">Delete</button>` : ``}
            </div>
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

/* ---------------- Mutations (posts unchanged) ---------------- */
async function uploadMedia(file) { /* unchanged */ }
// … (everything above createPost / deletePost / toggleLike / sendComment stays the same)

/* ----------- Comment actions WITHOUT loadFeed ----------- */
async function likeComment(commentId, btn) {
  const liked = btn.textContent.trim().toLowerCase().startsWith("unlike");
  if (liked) {
    const { error } = await supabase.from("comment_likes").delete().eq("comment_id", commentId).eq("user_id", me.id);
    if (error) throw new Error(error.message);
  } else {
    const { error } = await supabase.from("comment_likes").insert([{ comment_id: commentId, user_id: me.id }]);
    if (error) throw new Error(error.message);
  }
  // refresh only this comment’s like count
  const { data } = await supabase.from("comment_likes").select("comment_id").eq("comment_id", commentId);
  const count = (data || []).length;
  btn.textContent = `${liked ? "Like" : "Unlike"} (${count})`;
}

async function sendReply(parentId, postId, inputEl) {
  const txt = (inputEl?.value || "").trim();
  if (!txt) return;
  const payload = {
    post_id: postId,
    user_id: me.id,
    author_id: me.id,
    body: txt,
    content: txt,
    parent_id: parentId
  };
  const { error } = await supabase.from("post_comments").insert([payload]);
  if (error) throw new Error(error.message);
  await loadFeed(); // safe: only when adding new nodes
}

async function deleteCommentSoft(commentId, rowEl) {
  const { error } = await supabase.from("post_comments").delete().eq("id", commentId);
  if (error) throw new Error(error.message);
  rowEl.remove();
  toast("Deleted");
}

/* ---------------- Main ---------------- */
async function loadFeed() {
  try {
    setStatus("Loading feed…");

    const rows = await fetchPostsRaw();
    cachedKeyset = detectKeys(rows[0] || {});

    const postIds = [];
    const userIds = [];
    for (const r of rows) {
      if (cachedKeyset.idKey && r[cachedKeyset.idKey]) postIds.push(r[cachedKeyset.idKey]);
      if (r.user_id) userIds.push(r.user_id);
      if (r.author_id) userIds.push(r.author_id);
    }

    const likeInfo = await fetchLikesForPosts(postIds);
    const commentInfo = await fetchCommentsForPosts(postIds);

    const commentIds = [];
    for (const arr of commentInfo.latest.values()) {
      for (const c of arr) {
        if (c.id) commentIds.push(c.id);
        if (c.user_id) userIds.push(c.user_id);
        if (c.author_id) userIds.push(c.author_id);
      }
    }

    const uniqueUsers = [...new Set(userIds.filter(Boolean))];
    const profMap = await fetchProfilesMap(uniqueUsers);
    const commentLikeInfo = await fetchCommentLikes(commentIds);

    renderPosts(rows, profMap, likeInfo, commentInfo, cachedKeyset, commentLikeInfo);
    setStatus("");
  } catch (e) {
    showFatal(e);
  }
}

document.addEventListener("DOMContentLoaded", async () => {
  try {
    const ok = await requireLogin();
    if (!ok) return;

    await supabaseSelfTest();

    if (elList) {
      elList.addEventListener("click", async (e) => {
        const btn = e.target.closest("[data-action]");
        if (!btn) return;

        const postEl = e.target.closest("[data-post-id]");
        const action = btn.getAttribute("data-action");

        try {
          if (action === "likeComment") {
            return await likeComment(btn.getAttribute("data-comment-id"), btn);
          }
          if (action === "replyComment") {
            const cid = btn.getAttribute("data-comment-id");
            const box = postEl.querySelector(`[data-reply-box="${cid}"]`);
            if (box) box.style.display = box.style.display === "none" ? "block" : "none";
            return;
          }
          if (action === "sendReply") {
            const cid = btn.getAttribute("data-comment-id");
            const box = postEl.querySelector(`[data-reply-box="${cid}"]`);
            const input = box?.querySelector("input");
            return await sendReply(cid, postEl.getAttribute("data-post-id"), input);
          }
          if (action === "deleteComment") {
            const cid = btn.getAttribute("data-comment-id");
            const row = btn.closest(".pv-commentRow");
            return await deleteCommentSoft(cid, row);
          }
        } catch (err) {
          showFatal(err);
        }
      });
    }

    await loadFeed();
  } catch (e) {
    showFatal(e);
  }
});