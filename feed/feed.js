import { supabase } from "/js/supabase.js";
import { requireAuth, getMyProfile } from "/js/guard.js";

const userNameEl = document.getElementById("userName");
const userAvatarEl = document.getElementById("userAvatar");

const avatarBtn = document.getElementById("avatarBtn");
const avatarMenu = document.getElementById("avatarMenu");
const logoutBtn = document.getElementById("logoutBtn");

const postTextEl = document.getElementById("postText");
const postMediaEl = document.getElementById("postMedia");
const addMediaBtn = document.getElementById("addMedia");
const postBtn = document.getElementById("postBtn");
const mediaPreviewEl = document.getElementById("mediaPreview");
const feedListEl = document.getElementById("feedList");

let session = null;
let me = null;

const BUCKET = "post_media";

const DEFAULT_AVATAR =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80">
    <rect width="100%" height="100%" rx="40" ry="40" fill="#e7f4f7"/>
    <circle cx="40" cy="32" r="14" fill="#1F6F86"/>
    <rect x="16" y="52" width="48" height="18" rx="9" fill="#1F6F86"/>
  </svg>`);

function escapeHtml(s) {
  return (s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function fmt(ts) {
  try {
    return new Date(ts).toLocaleString();
  } catch {
    return "";
  }
}

function nameFromProfileRow(row) {
  const n =
    (row?.full_name && String(row.full_name).trim()) ||
    (row?.username && String(row.username).trim());
  return n || "Member";
}

function setTopBar(profile) {
  const nm = nameFromProfileRow(profile);
  userNameEl.textContent = nm;
  userAvatarEl.src = profile?.avatar_url || DEFAULT_AVATAR;
  userAvatarEl.onerror = () => (userAvatarEl.src = DEFAULT_AVATAR);
}

/* Dropdown */
function closeMenu() {
  if (!avatarMenu) return;
  avatarMenu.hidden = true;
}
function toggleMenu() {
  if (!avatarMenu) return;
  avatarMenu.hidden = !avatarMenu.hidden;
}
avatarBtn?.addEventListener("click", (e) => {
  e.preventDefault();
  toggleMenu();
});
document.addEventListener("click", (e) => {
  if (!avatarMenu || avatarMenu.hidden) return;
  const inside = avatarMenu.contains(e.target) || avatarBtn.contains(e.target);
  if (!inside) closeMenu();
});
logoutBtn?.addEventListener("click", async () => {
  await supabase.auth.signOut();
  window.location.href = "/auth/login.html";
});

/* Media preview */
let selectedFile = null;

function clearPreview() {
  selectedFile = null;
  mediaPreviewEl.innerHTML = "";
  if (postMediaEl) postMediaEl.value = "";
}

function showPreview(file) {
  const type = file.type || "";
  const url = URL.createObjectURL(file);

  if (type.startsWith("image/")) {
    mediaPreviewEl.innerHTML = `
      <div class="previewCard">
        <img class="previewImg" src="${url}" alt="preview"/>
        <button class="previewRemove" id="removePreview" type="button">Remove</button>
      </div>`;
  } else if (type.startsWith("video/")) {
    mediaPreviewEl.innerHTML = `
      <div class="previewCard">
        <video class="previewVid" src="${url}" controls playsinline></video>
        <button class="previewRemove" id="removePreview" type="button">Remove</button>
      </div>`;
  } else {
    mediaPreviewEl.innerHTML = `
      <div class="previewCard">
        <div class="muted">Selected: ${escapeHtml(file.name)}</div>
        <button class="previewRemove" id="removePreview" type="button">Remove</button>
      </div>`;
  }

  document.getElementById("removePreview")?.addEventListener("click", () => {
    URL.revokeObjectURL(url);
    clearPreview();
  });
}

addMediaBtn?.addEventListener("click", () => postMediaEl?.click());
postMediaEl?.addEventListener("change", (e) => {
  const file = e.target.files?.[0];
  if (!file) return;

  if (file.size > 25 * 1024 * 1024) {
    alert("File too large (max 25MB).");
    clearPreview();
    return;
  }
  selectedFile = file;
  showPreview(file);
});

/* Likes cache */
const likeCache = new Map(); // postId -> { count:number, liked:boolean }
let lastFeedRows = [];

/* Comments bottom sheet (Instagram style) */
let commentsModalEl = null;
let currentPostId = null;
let currentReplyTo = null; // { id, name } or null
const commentLikeCache = new Map(); // commentId -> {count, liked}
const commentUserCache = new Map(); // userId -> {full_name, username, avatar_url}

function ensureCommentsModal() {
  if (commentsModalEl) return;

  commentsModalEl = document.createElement("div");
  commentsModalEl.id = "commentsModal";
  commentsModalEl.className = "pv-modal";
  commentsModalEl.hidden = true;
  commentsModalEl.innerHTML = `
    <div class="pv-modal-backdrop" data-close="1"></div>
    <section class="pv-sheet" role="dialog" aria-modal="true" aria-label="Comments">
      <div class="pv-sheet-head">
        <button class="pv-sheet-close" type="button" data-close="1">✕</button>
        <div class="pv-sheet-title">Comments</div>
        <div class="pv-sheet-spacer"></div>
      </div>

      <div class="pv-sheet-body">
        <div id="pvCommentsList" class="pv-comments-list">
          <div class="loading">Loading comments…</div>
        </div>
      </div>

      <div class="pv-sheet-compose">
        <div id="pvReplyChip" class="pv-reply-chip" hidden>
          <span id="pvReplyText"></span>
          <button id="pvReplyCancel" class="pv-reply-cancel" type="button">✕</button>
        </div>

        <div class="pv-compose-row">
          <input id="pvCommentInput" class="pv-compose-input" type="text" placeholder="Add a comment…" maxlength="600" />
          <button id="pvCommentSend" class="pv-compose-send" type="button">Post</button>
        </div>
      </div>
    </section>
  `;
  document.body.appendChild(commentsModalEl);

  commentsModalEl.addEventListener("click", (e) => {
    const close = e.target?.closest?.("[data-close]");
    if (close) closeComments();
  });

  const cancelBtn = commentsModalEl.querySelector("#pvReplyCancel");
  cancelBtn?.addEventListener("click", () => setReplyTo(null));

  const sendBtn = commentsModalEl.querySelector("#pvCommentSend");
  sendBtn?.addEventListener("click", submitComment);

  const input = commentsModalEl.querySelector("#pvCommentInput");
  input?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      submitComment();
    }
  });

  const list = commentsModalEl.querySelector("#pvCommentsList");
  list?.addEventListener("click", async (e) => {
    const btn = e.target?.closest?.("button[data-caction]");
    if (!btn) return;

    const action = btn.getAttribute("data-caction");
    const cid = btn.getAttribute("data-cid");

    if (action === "reply") {
      const nm = btn.getAttribute("data-cname") || "Member";
      setReplyTo({ id: Number(cid), name: nm });
      return;
    }

    if (action === "like") {
      await toggleCommentLike(Number(cid));
      return;
    }

    if (action === "delete") {
      await deleteComment(Number(cid));
      return;
    }
  });
}

function openComments(postId) {
  ensureCommentsModal();
  currentPostId = Number(postId);
  setReplyTo(null);
  commentsModalEl.hidden = false;
  document.documentElement.classList.add("pv-noscroll");
  document.body.classList.add("pv-noscroll");
  loadComments();
}

function closeComments() {
  if (!commentsModalEl) return;
  commentsModalEl.hidden = true;
  document.documentElement.classList.remove("pv-noscroll");
  document.body.classList.remove("pv-noscroll");
  currentPostId = null;
  setReplyTo(null);
}

function setReplyTo(obj) {
  currentReplyTo = obj;
  const chip = commentsModalEl.querySelector("#pvReplyChip");
  const txt = commentsModalEl.querySelector("#pvReplyText");
  if (!chip || !txt) return;

  if (!obj) {
    chip.hidden = true;
    txt.textContent = "";
    return;
  }
  chip.hidden = false;
  txt.textContent = `Replying to ${obj.name}`;
}
commentUserCache.get(String(uid));
  return nameFromProfileRow(p);
}

function userAvatarById(uid) {
  const p = commentUserCache.get(String(uid));
  return p?.avatar_url || DEFAULT_AVATAR;
}

async function loadCommentLikes(commentIds) {
  commentLikeCache.clear();
  if (!commentIds.length) return;

  const { data, error } = await supabase
    .from("comment_likes")
    .select("comment_id, user_id")
    .in("comment_id", commentIds);

  if (error) return;

  for (const cid of commentIds) commentLikeCache.set(String(cid), { count: 0, liked: false });

  for (const r of data || []) {
    const key = String(r.comment_id);
    const cur = commentLikeCache.get(key) || { count: 0, liked: false };
    cur.count += 1;
    if (r.user_id === session?.user?.id) cur.liked = true;
    commentLikeCache.set(key, cur);
  }
}

function buildCommentTree(rows) {
  const byId = new Map();
  const roots = [];

  for (const r of rows) {
    byId.set(String(r.id), { ...r, children: [] });
  }

  for (const r of rows) {
    const node = byId.get(String(r.id));
    if (r.parent_id) {
      const parent = byId.get(String(r.parent_id));
      if (parent) parent.children.push(node);
      else roots.push(node);
    } else {
      roots.push(node);
    }
  }

  const sortByTime = (a, b) => new Date(a.created_at) - new Date(b.created_at);
  roots.sort(sortByTime);
  for (const n of roots) n.children.sort(sortByTime);

  return roots;
}

function renderComment(node, depth = 0) {
  const cid = node.id;
  const mine = node.user_id === session?.user?.id;
  const nm = escapeHtml(userNameById(node.user_id));
  const av = escapeHtml(userAvatarById(node.user_id));
  const time = escapeHtml(fmt(node.created_at));
  const text = escapeHtml(node.content || "");

  const li = commentLikeCache.get(String(cid)) || { count: 0, liked: false };
  const likeLabel = li.liked ? "Liked" : "Like";
  const likeCount = li.count || 0;

  const delBtn = mine
    ? `<button class="pv-cmini danger" type="button" data-caction="delete" data-cid="${escapeHtml(
        String(cid)
      )}">Delete</button>`
    : ``;

  const replyBtn =
    depth === 0
      ? `<button class="pv-cmini" type="button" data-caction="reply" data-cid="${escapeHtml(
          String(cid)
        )}" data-cname="${escapeHtml(nm)}">Reply</button>`
      : ``;

  const html = `
    <div class="pv-comment ${depth ? "pv-reply" : ""}">
      <img class="pv-cavatar" src="${av}" alt="" onerror="this.src='${DEFAULT_AVATAR}'"/>
      <div class="pv-cbody">
        <div class="pv-ctop">
          <div class="pv-cname">${nm}</div>
          <div class="pv-ctime">${time}</div>
        </div>
        <div class="pv-ctext">${text}</div>
        <div class="pv-cactions">
          <button class="pv-cmini ${li.liked ? "liked" : ""}" type="button" data-caction="like" data-cid="${escapeHtml(
            String(cid)
          )}">
            ${likeLabel} <span class="pv-cpill" data-clike-count="${escapeHtml(String(cid))}">${likeCount}</span>
          </button>
          ${replyBtn}
          ${delBtn}
        </div>

        ${
          node.children?.length
            ? `<div class="pv-replies">${node.children.map((c) => renderComment(c, depth + 1)).join("")}</div>`
            : ``
        }
      </div>
    </div>
  `;
  return html;
}

async function loadComments() {
  if (!currentPostId) return;
  const list = commentsModalEl.querySelector("#pvCommentsList");
  list.innerHTML = `<div class="loading">Loading comments…</div>`;

  const { data, error } = await supabase
    .from("post_comments")
    .select("id, post_id, user_id, parent_id, content, created_at")
    .eq("post_id", currentPostId)
    .order("created_at", { ascending: true });

  if (error) {
    list.innerHTML = `<div class="errorBox">Error loading comments: ${escapeHtml(error.message)}</div>`;
    return;
  }

  const rows = data || [];
  if (!rows.length) {
    list.innerHTML = `<div class="muted">No comments yet.</div>`;
    return;
  }

  await fetchUsersForComments(rows.map((r) => r.user_id));
  await loadCommentLikes(rows.map((r) => r.id));

  const tree = buildCommentTree(rows);
  list.innerHTML = tree.map((n) => renderComment(n)).join("");
}

function updateCommentLikeUI(commentId, liked, count) {
  const btn = commentsModalEl.querySelector(`button[data-caction="like"][data-cid="${CSS.escape(String(commentId))}"]`);
  const pill = commentsModalEl.querySelector(`span[data-clike-count="${CSS.escape(String(commentId))}"]`);
  if (pill) pill.textContent = String(count);

  if (btn) {
    btn.classList.toggle("liked", !!liked);
    const pillHtml =
      pill?.outerHTML || `<span class="pv-cpill" data-clike-count="${escapeHtml(String(commentId))}">${count}</span>`;
    btn.innerHTML = `${liked ? "Liked" : "Like"} ${pillHtml}`;
  }
}

async function toggleCommentLike(commentId) {
  if (!commentId || !session?.user?.id) return;

  const key = String(commentId);
  const cur = commentLikeCache.get(key) || { count: 0, liked: false };

  const nextLiked = !cur.liked;
  const nextCount = Math.max(0, cur.count + (nextLiked ? 1 : -1));
  commentLikeCache.set(key, { count: nextCount, liked: nextLiked });
  updateCommentLikeUI(commentId, nextLiked, nextCount);

  try {
    if (nextLiked) {
      const { error } = await supabase.from("comment_likes").insert({
        comment_id: commentId,
        user_id: session.user.id,
      });
      if (error) throw error;
    } else {
      const { error } = await supabase
        .from("comment_likes")
        .delete()
        .eq("comment_id", commentId)
        .eq("user_id", session.user.id);
      if (error) throw error;
    }
  } catch (e) {
    commentLikeCache.set(key, cur);
    updateCommentLikeUI(commentId, cur.liked, cur.count);
    alert(`Comment like failed: ${e?.message || e}`);
  }
}

async function deleteComment(commentId) {
  const ok = confirm("Delete this comment?");
  if (!ok) return;

  const { error } = await supabase
    .from("post_comments")
    .delete()
    .eq("id", commentId)
    .eq("user_id", session.user.id);

  if (error) {
    alert(`Delete failed: ${error.message}`);
    return;
  }
  await loadComments();
}

async function submitComment() {
  if (!currentPostId) return;

  const input = commentsModalEl.querySelector("#pvCommentInput");
  const send = commentsModalEl.querySelector("#pvCommentSend");
  const content = (input?.value || "").trim();
  if (!content) return;

  send.disabled = true;
  try {
    const payload = {
      post_id: currentPostId,
      user_id: session.user.id,
      content,
      parent_id: currentReplyTo?.id || null,
    };

    const { error } = await supabase.from("post_comments").insert(payload);
    if (error) throw error;

    input.value = "";
    setReplyTo(null);
    await loadComments();

    const body = commentsModalEl.querySelector(".pv-sheet-body");
    body.scrollTop = body.scrollHeight;
  } catch (e) {
    alert(`Comment failed: ${e?.message || e}`);
  } finally {
    send.disabled = false;
  }
}

/* Render posts */
function renderPost(row) {
  const postId = row.id;
  const authorId = row.author_id;

  const authorName = escapeHtml(nameFromProfileRow(row));
  const time = escapeHtml(fmt(row.created_at));
  const text = escapeHtml(row.content || "");

  const isMine = authorId && session?.user?.id ? authorId === session.user.id : false;
  const authorLink = `/profile/user.html?id=${encodeURIComponent(authorId || "")}`;

  const avatarUrl = row.avatar_url || DEFAULT_AVATAR;

  let mediaHtml = "";
  if (row.media_url && row.media_type) {
    const safeUrl = escapeHtml(row.media_url);
    if (row.media_type.startsWith("image/")) {
      mediaHtml = `<img class="postMediaImg" src="${safeUrl}" alt="post media"/>`;
    } else if (row.media_type.startsWith("video/")) {
      mediaHtml = `<video class="postMediaVid" src="${safeUrl}" controls playsinline></video>`;
    }
  }

  const likeInfo = likeCache.get(String(postId)) || { count: 0, liked: false };
  const likeLabel = likeInfo.liked ? "Liked" : "Like";
  const likeCount = likeInfo.count || 0;

  const deleteBtn = isMine

async function fetchUsersForComments(userIds) {
  const unique = [...new Set(userIds.filter(Boolean))].filter((id) => !commentUserCache.has(String(id)));
  if (!unique.length) return;

  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name, username, avatar_url")
    .in("id", unique);

  if (error) return;
  for (const r of data || []) commentUserCache.set(String(r.id), r);
}

function userNameById(uid) {
  const p =
   ? `<button class="miniBtn dangerBtn" type="button" data-action="delete" data-post-id="${escapeHtml(
        String(postId)
      )}">Delete</button>`
    : ``;

  const actions = `
    <div class="postFooter">
      <button class="miniBtn ${likeInfo.liked ? "likedBtn" : ""}" type="button" data-action="like" data-post-id="${escapeHtml(
        String(postId)
      )}">
        ${likeLabel}
        <span class="countPill" data-like-count="${escapeHtml(String(postId))}">${likeCount}</span>
      </button>

      <button class="miniBtn" type="button" data-action="comment" data-post-id="${escapeHtml(String(postId))}">
        Comment
      </button>

      <button class="miniBtn" type="button" data-action="share" data-post-id="${escapeHtml(String(postId))}">
        Share
      </button>

      ${deleteBtn}
    </div>
  `;

  return `
    <article class="postCard" id="post-${escapeHtml(String(postId))}">
      <div class="postHeader">
        <div class="postAuthor" style="display:flex;align-items:center;gap:10px;">
          <a href="${authorLink}" style="display:inline-flex;align-items:center;gap:10px;text-decoration:none;color:inherit;">
            <img src="${escapeHtml(avatarUrl)}" alt="" class="postAvatar" onerror="this.src='${DEFAULT_AVATAR}'"/>
            <div>
              <div class="postAuthorName">${authorName}${isMine ? ` <span class="youTag">you</span>` : ``}</div>
              <div class="postTime">${time}</div>
            </div>
          </a>
        </div>
      </div>

      ${text ? `<div class="postText">${text}</div>` : ``}
      ${mediaHtml ? `<div class="postMedia">${mediaHtml}</div>` : ``}

      ${actions}
    </article>
  `;
}

async function loadLikesForPosts(postIds) {
  likeCache.clear();
  if (!postIds.length) return;

  const { data, error } = await supabase
    .from("post_likes")
    .select("post_id, user_id")
    .in("post_id", postIds);

  if (error) return;

  for (const pid of postIds) likeCache.set(String(pid), { count: 0, liked: false });

  for (const r of data || []) {
    const key = String(r.post_id);
    const cur = likeCache.get(key) || { count: 0, liked: false };
    cur.count += 1;
    if (r.user_id === session?.user?.id) cur.liked = true;
    likeCache.set(key, cur);
  }
}

async function loadPosts() {
  feedListEl.innerHTML = `<div class="loading">Loading feed…</div>`;

  const { data, error } = await supabase
    .from("v_feed_posts")
    .select("id, content, created_at, media_url, media_type, author_id, full_name, username, avatar_url")
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    feedListEl.innerHTML = `<div class="errorBox">Error loading feed: ${escapeHtml(error.message)}</div>`;
    return;
  }

  lastFeedRows = data || [];

  if (!lastFeedRows.length) {
    feedListEl.innerHTML = `<div class="muted">No posts yet. Be the first to post!</div>`;
    return;
  }

  const postIds = lastFeedRows.map((r) => r.id);
  await loadLikesForPosts(postIds);

  feedListEl.innerHTML = lastFeedRows.map(renderPost).join("");
}

/* Delete post */
async function deletePost(postId) {
  if (!postId) return;
  const ok = confirm("Delete this post?");
  if (!ok) return;

  const { error } = await supabase
    .from("posts")
    .delete()
    .eq("id", postId)
    .eq("author_id", session.user.id);

  if (error) {
    alert(`Delete failed: ${error.message}`);
    return;
  }
  await loadPosts();
}

/* Like toggle (no refresh) */
function updateLikeUI(postId, liked, count) {
  const btn = feedListEl.querySelector(`button[data-action="like"][data-post-id="${CSS.escape(String(postId))}"]`);
  const pill = feedListEl.querySelector(`span[data-like-count="${CSS.escape(String(postId))}"]`);
  if (pill) pill.textContent = String(count);

  if (btn) {
    btn.classList.toggle("likedBtn", !!liked);
    const pillHtml = pill
      ? pill.outerHTML
      : `<span class="countPill" data-like-count="${escapeHtml(String(postId))}">${count}</span>`;
    btn.innerHTML = `${liked ? "Liked" : "Like"} ${pillHtml}`;
  }
}

async function toggleLike(postId) {
  if (!postId || !session?.user?.id) return;

  const key = String(postId);
  const cur = likeCache.get(key) || { count: 0, liked: false };

  const nextLiked = !cur.liked;
  const nextCount = Math.max(0, cur.count + (nextLiked ? 1 : -1));
  likeCache.set(key, { count: nextCount, liked: nextLiked });
  updateLikeUI(postId, nextLiked, nextCount);

  try {
    if (nextLiked) {
      const { error } = await supabase.from("post_likes").insert({
        post_id: Number(postId),
        user_id: session.user.id,
      });
      if (error) throw error;
    } else {
      const { error } = await supabase
        .from("post_likes")
        .delete()
        .eq("post_id", postId)
        .eq("user_id", session.user.id);
      if (error) throw error;
    }
  } catch (e) {
    likeCache.set(key, cur);
    updateLikeUI(postId, cur.liked, cur.count);
    alert(`Like failed: ${e?.message || e}`);
  }
}

/* Upload + create post */
async function uploadMedia(file) {
  const ext = (file.name.split(".").pop() || "bin").toLowerCase();
  const path = `${session.user.id}/${Date.now()}-${Math.random().toString(16).slice(2)}.${ext}`;

  const { error: upErr } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, { contentType: file.type, upsert: false, cacheControl: "3600" });

  if (upErr) throw upErr;

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

async function createPost() {
  const content = (postTextEl.value || "").trim();

  if (!content && !selectedFile) {
    alert("Write something or add a photo/video.");
    return;
  }

  postBtn.disabled = true;
  postBtn.textContent = "Posting…";

  try {
    let media_url = null;
    let media_type = null;

    if (selectedFile) {
      media_type = selectedFile.type || null;
      media_url = await uploadMedia(selectedFile);
    }

    const payload = {
      author_id: session.user.id,
      author_name: nameFromProfileRow(me),
      content,
      media_url,
      media_type,
    };

    const { error } = await supabase.from("posts").insert(payload);
    if (error) throw error;

    postTextEl.value = "";
    clearPreview();
    await loadPosts();
  } catch (e) {
    alert(`Post failed: ${e.message || e}`);
  } finally {
    postBtn.disabled = false;
    postBtn.textContent = "Post";
  }
}

postBtn?.addEventListener("click", createPost);

/* Actions */
feedListEl?.addEventListener("click", async (e) => {
  const btn = e.target?.closest?.("button[data-action]");
  if (!btn) return;

  const action = btn.getAttribute("data-action");
  const postId = btn.getAttribute("data-post-id");

  if (action === "delete") {
    await deletePost(postId);
    return;
  }

  if (action === "like") {
    await toggleLike(postId);
    return;
  }

  if (action === "comment") {
    openComments(postId);
    return;
  }

  if (action === "share") {
    const url = `${location.origin}/feed/index.html#post-${postId}`;
    try {
      await navigator.share({ title: "Pepsval Post", url });
    } catch {
      try {
        await navigator.clipboard.writeText(url);
        alert("Link copied ✅");
      } catch {
        alert(url);
      }
    }
    return;
  }
});

/* Init */
(async function init() {
  session = await requireAuth();
  if (!session) return;

  const mini = await getMyProfile(session.user.id);
  if (!mini || mini.setup_complete !== true) {
    window.location.href = "/setup/profile-setup.html";
    return;
  }

  const { data: prof } = await supabase
    .from("profiles")
    .select("id, full_name, username, avatar_url")
    .eq("id", session.user.id)
    .single();

  me = prof || {};
  setTopBar(me);
  await loadPosts();
})();
