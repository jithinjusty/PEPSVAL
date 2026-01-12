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

function esc(s) {
  return (s ?? "")
    .toString()
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
function displayName(profile) {
  const n =
    (profile?.full_name && String(profile.full_name).trim()) ||
    (profile?.username && String(profile.username).trim());
  return n || "Member";
}
function setTopBar(profile) {
  userNameEl.textContent = displayName(profile);
  userAvatarEl.src = profile?.avatar_url || DEFAULT_AVATAR;
  userAvatarEl.onerror = () => (userAvatarEl.src = DEFAULT_AVATAR);
}

/* avatar menu */
function closeMenu() {
  if (avatarMenu) avatarMenu.hidden = true;
}
function toggleMenu() {
  if (avatarMenu) avatarMenu.hidden = !avatarMenu.hidden;
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

/* media preview */
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
        <div class="muted">Selected: ${esc(file.name)}</div>
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

/* FEED state */
let feedRows = [];
const postState = new Map(); // postId -> { liked:boolean, likeCount:number, commentCount:number, media_url, media_type }
const myLikedPostIds = new Set(); // postIds liked by me

async function loadMyLikesForPosts(postIds) {
  myLikedPostIds.clear();
  if (!postIds.length) return;

  const { data, error } = await supabase
    .from("post_likes")
    .select("post_id")
    .eq("user_id", session.user.id)
    .in("post_id", postIds);

  if (error) return;

  for (const r of data || []) myLikedPostIds.add(String(r.post_id));
}

/* render */
function renderPost(row) {
  const postId = String(row.id);
  const isMine = row.author_id === session?.user?.id;

  const name = esc(displayName(row));
  const time = esc(fmt(row.created_at));
  const text = esc(row.content || "");
  const authorLink = `/profile/user.html?id=${encodeURIComponent(row.author_id || "")}`;

  const avatarUrl = row.avatar_url || DEFAULT_AVATAR;

  const media_url = row.media_url || null;
  const media_type = row.media_type || null;

  let mediaHtml = "";
  if (media_url && media_type) {
    const safeUrl = esc(media_url);
    if (media_type.startsWith("image/")) {
      mediaHtml = `<img class="postMediaImg" src="${safeUrl}" alt="post media"/>`;
    } else if (media_type.startsWith("video/")) {
      mediaHtml = `<video class="postMediaVid" src="${safeUrl}" controls playsinline></video>`;
    }
  }

  const liked = myLikedPostIds.has(postId);
  const likeCount = Number(row.like_count || 0);
  const commentCount = Number(row.comment_count || 0);

  postState.set(postId, {
    liked,
    likeCount,
    commentCount,
    media_url,
    media_type,
  });

  const deleteBtn = isMine
   ? `<button class="miniBtn dangerBtn" type="button" data-action="delete" data-post-id="${esc(
        postId
      )}">Delete</button>`
    : ``;

  return `
    <article class="postCard" id="post-${esc(postId)}">
      <div class="postHeader">
        <div class="postAuthor">
          <a href="${authorLink}" class="authorRow">
            <img class="postAvatar" src="${esc(avatarUrl)}" alt="" onerror="this.src='${DEFAULT_AVATAR}'"/>
            <div class="authorMeta">
              <div class="postAuthorName">${name}${isMine ? ` <span class="youTag">you</span>` : ``}</div>
              <div class="postTime">${time}</div>
            </div>
          </a>
        </div>
      </div>

      ${text ? `<div class="postText">${text}</div>` : ``}
      ${mediaHtml ? `<div class="postMedia">${mediaHtml}</div>` : ``}

      <div class="postFooter">
        <button class="miniBtn ${liked ? "likedBtn" : ""}" type="button" data-action="like" data-post-id="${esc(
          postId
        )}">
          <span class="btnLabel">${liked ? "Liked" : "Like"}</span>
          <span class="countPill" data-like-pill="${esc(postId)}">${likeCount}</span>
        </button>

        <button class="miniBtn" type="button" data-action="comment" data-post-id="${esc(postId)}">
          <span class="btnLabel">Comment</span>
          <span class="countPill" data-comment-pill="${esc(postId)}">${commentCount}</span>
        </button>

        <button class="miniBtn" type="button" data-action="share" data-post-id="${esc(postId)}">
          Share
        </button>

        ${deleteBtn}
      </div>
    </article>
  `;
}

async function loadFeed() {
  feedListEl.innerHTML = `<div class="loading">Loading feed…</div>`;

  const { data, error } = await supabase
    .from("v_feed_posts")
    .select(
      "id, content, created_at, media_url, media_type, author_id, full_name, username, avatar_url, like_count, comment_count"
    )
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    feedListEl.innerHTML = `<div class="errorBox">Error loading feed: ${esc(error.message)}</div>`;
    return;
  }

  feedRows = data || [];
  if (!feedRows.length) {
    feedListEl.innerHTML = `<div class="muted">No posts yet. Be the first to post!</div>`;
    return;
  }

  const postIds = feedRows.map((r) => r.id);
  await loadMyLikesForPosts(postIds);

  feedListEl.innerHTML = feedRows.map(renderPost).join("");
}

/* like (no refresh) */
function updatePostLikeUI(postId) {
  const st = postState.get(String(postId));
  if (!st) return;

  const btn = feedListEl.querySelector(`button[data-action="like"][data-post-id="${CSS.escape(String(postId))}"]`);
  const pill = feedListEl.querySelector(`span[data-like-pill="${CSS.escape(String(postId))}"]`);

  if (pill) pill.textContent = String(st.likeCount);

  if (btn) {
    btn.classList.toggle("likedBtn", !!st.liked);
    const label = btn.querySelector(".btnLabel");
    if (label) label.textContent = st.liked ? "Liked" : "Like";
  }
}

async function togglePostLike(postId) {
  const key = String(postId);
  const st = postState.get(key);
  if (!st) return;

  const prev = { ...st };

  st.liked = !st.liked;
  st.likeCount = Math.max(0, st.likeCount + (st.liked ? 1 : -1));
  postState.set(key, st);
  updatePostLikeUI(key);

  try {
    if (st.liked) {
      const { error } = await supabase.from("post_likes").insert({
        post_id: Number(postId),
        user_id: session.user.id,
      });
      if (error) throw error;
      myLikedPostIds.add(key);
    } else {
      const { error } = await supabase
        .from("post_likes")
        .delete()
        .eq("post_id", postId)
        .eq("user_id", session.user.id);
      if (error) throw error;
      myLikedPostIds.delete(key);
    }
  } catch (e) {
    postState.set(key, prev);
    if (prev.liked) myLikedPostIds.add(key);
    else myLikedPostIds.delete(key);
    updatePostLikeUI(key);
    alert(`Like failed: ${e?.message || e}`);
  }
}

/* delete post */
async function deletePost(postId) {
  if (!confirm("Delete this post?")) return;
  const { error } = await supabase
    .from("posts")
    .delete()
    .eq("id", postId)
    .eq("author_id", session.user.id);
  if (error) {
    alert(`Delete failed: ${error.message}`);
    return;
  }
  await loadFeed();
}

/* upload + create post */
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

    const { error } = await supabase.from("posts").insert({
      author_id: session.user.id,
      author_name: displayName(me),
      content,
      media_url,
      media_type,
    });

    if (error) throw error;

    postTextEl.value = "";
    clearPreview();
    await loadFeed();
  } catch (e) {
    alert(`Post failed: ${e?.message || e}`);
  } finally {
    postBtn.disabled = false;
    postBtn.textContent = "Post";
  }
}

postBtn?.addEventListener("click", createPost);

/* COMMENTS (Instagram-style bottom sheet) */
let commentsUI = null;
let currentPostId = null;
let replyTo = null; // {id, name} or null

const commentUserCache = new Map(); // userId -> profile row
const commentLikeCache = new Map(); // commentId -> {count, liked}

function ensureCommentsUI() {
  if (commentsUI) return;

  commentsUI = document.createElement("div");
  commentsUI.id = "pvCommentsSheet";
  commentsUI.className = "pvSheetWrap";
  commentsUI.hidden = true;
  commentsUI.innerHTML = `
    <div class="pvSheetBackdrop" data-close="1"></div>
    <section class="pvSheet">
      <div class="pvSheetHead">
        <button class="pvSheetClose" type="button" data-close="1">✕</button>
        <div class="pvSheetTitle">Comments</div>
        <div class="pvSheetRight"></div>
      </div>

      <div class="pvSheetBody" id="pvCommentsList">
        <div class="loading">Loading comments…</div>
      </div>

      <div class="pvSheetCompose">
        <div class="pvReplyChip" id="pvReplyChip" hidden>
          <span id="pvReplyText"></span>
          <button class="pvReplyCancel" id="pvReplyCancel" type="button">✕</button>
        </div>

        <div class="pvComposeRow">
          <input class="pvComposeInput" id="pvCommentInput" type="text" placeholder="Add a comment…" maxlength="600"/>
          <button class="pvComposeSend" id="pvCommentSend" type="button">Post</button>
        </div>
      </div>
    </section>
  `;
  document.body.appendChild(commentsUI);

  commentsUI.addEventListener("click", (e) => {
    if (e.target?.closest?.("[data-close]")) closeComments();
  });

  commentsUI.querySelector("#pvReplyCancel")?.addEventListener("click", () => setReplyTo(null));
  commentsUI.querySelector("#pvCommentSend")?.addEventListener("click", submitComment);
  commentsUI.querySelector("#pvCommentInput")?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      submitComment();
    }
  });

  commentsUI.querySelector("#pvCommentsList")?.addEventListener("click", async (e) => {
    const btn = e.target?.closest?.("button[data-caction]");
    if (!btn) return;

    const action = btn.getAttribute("data-caction");
    const cid = Number(btn.getAttribute("data-cid"));

    if (action === "reply") {
      const nm = btn.getAttribute("data-cname") || "Member";
      setReplyTo({ id: cid, name: nm });
      return;
    }

    if (action === "like") {
      await toggleCommentLike(cid);
      return;
    }

    if (action === "delete") {
      await deleteComment(cid);
      return;
    }
  });
}

function openComments(postId) {
  ensureCommentsUI();
  currentPostId = Number(postId);
  setReplyTo(null);
  commentsUI.hidden = false;
  document.documentElement.classList.add("pvNoScroll");
  document.body.classList.add("pvNoScroll");
  loadComments();
}

function closeComments() {
  if (!commentsUI) return;
  commentsUI.hidden = true;
  document.documentElement.classList.remove("pvNoScroll");
  document.body.classList.remove("pvNoScroll");
  currentPostId = null;
  setReplyTo(null);
}

function setReplyTo(obj) {
  replyTo = obj;
  const chip = commentsUI.querySelector("#pvReplyChip");
  const txt = commentsUI.querySelector("#pvReplyText");
  if (!chip || !txt) return;

  if (!obj) {
    chip.hidden = true;
    txt.textContent = "";
    return;
  }
  chip.hidden = false;
  txt.textContent = `Replying to ${obj.name}`;
}

async function fetchProfiles(userIds) {
  const ids = [...new Set(userIds.filter(Boolean))].filter((id) => !commentUserCache.has(String(id)));
  if (!ids.length) return;

  const { data } = await supabase.from("profiles").select("id, full_name, username, avatar_url").in("id", ids);
  for (const r of data || []) commentUserCache.set(String(r.id), r);
}

function cName(uid) {
  return displayName(commentUserCache.get(String(uid)));
}
function cAvatar(uid) {
  return commentUserCache.get(String(uid))?.avatar_url || DEFAULT_AVATAR;
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
    if (r.user_id === session.user.id) cur.liked = true;
    commentLikeCache.set(key, cur);
  }
}

function buildTree(rows) {
  const byId = new Map();
  const roots = [];

  for (const r of rows) byId.set(String(r.id), { ...r, children: [] });

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
  const cid = String(node.id);
  const mine = node.author_id === session.user.id;

  const nm = esc(cName(node.author_id));
  const av = esc(cAvatar(node.author_id));
  const time = esc(fmt(node.created_at));
  const text = esc(node.content || "");

  const li = commentLikeCache.get(cid) || { count: 0, liked: false };

  const delBtn = mine
    ? `<button class="pvCBtn danger" type="button" data-caction="delete" data-cid="${esc(cid)}">Delete</button>`
    : ``;

  const replyBtn =
    depth === 0
      ? `<button class="pvCBtn" type="button" data-caction="reply" data-cid="${esc(cid)}" data-cname="${esc(
          nm
        )}">Reply</button>`
      : ``;

  return `
    <div class="pvComment ${depth ? "pvReply" : ""}">
      <img class="pvCAvatar" src="${av}" alt="" onerror="this.src='${DEFAULT_AVATAR}'"/>
      <div class="pvCBody">
        <div class="pvCTop">
          <div class="pvCName">${nm}</div>
          <div class="pvCTime">${time}</div>
        </div>
        <div class="pvCText">${text}</div>

        <div class="pvCActions">
          <button class="pvCBtn ${li.liked ? "liked" : ""}" type="button" data-caction="like" data-cid="${esc(
            cid
          )}">
            ${li.liked ? "Liked" : "Like"} <span class="pvCPill" data-clike-pill="${esc(cid)}">${li.count}</span>
          </button>
          ${replyBtn}
          ${delBtn}
        </div>

        ${
          node.children?.length
            ? `<div class="pvReplies">${node.children.map((c) => renderComment(c, depth + 1)).join("")}</div>`
            : ``
        }
      </div>
    </div>
  `;
}

async function loadComments() {
  const list = commentsUI.querySelector("#pvCommentsList");
  list.innerHTML = `<div class="loading">Loading comments…</div>`;

  const { data, error } = await supabase
    .from("post_comments")
    .select("id, post_id, author_id, parent_id, content, created_at")
    .eq("post_id", currentPostId)
    .order("created_at", { ascending: true });

  if (error) {
    list.innerHTML = `<div class="errorBox">Error loading comments: ${esc(error.message)}</div>`;
    return;
  }

  const rows = data || [];
  if (!rows.length) {
    list.innerHTML = `<div class="muted">No comments yet.</div>`;
    return;
  }

  await fetchProfiles(rows.map((r) => r.author_id));
  await loadCommentLikes(rows.map((r) => r.id));

  const tree = buildTree(rows);
  list.innerHTML = tree.map((n) => renderComment(n)).join("");
}

function updatePostCommentUI(postId) {
  const st = postState.get(String(postId));
  if (!st) return;
  const pill = feedListEl.querySelector(`span[data-comment-pill="${CSS.escape(String(postId))}"]`);
  if (pill) pill.textContent = String(st.commentCount);
}

async function submitComment() {
  const input = commentsUI.querySelector("#pvCommentInput");
  const send = commentsUI.querySelector("#pvCommentSend");

  const content = (input?.value || "").trim();
  if (!content) return;

  send.disabled = true;

  try {
    const { error } = await supabase.from("post_comments").insert({
      post_id: currentPostId,
      author_id: session.user.id,
      content,
      parent_id: replyTo?.id || null,
    });

    if (error) throw error;

    input.value = "";
    setReplyTo(null);

    const pst = postState.get(String(currentPostId));
    if (pst) {
      pst.commentCount = Math.max(0, Number(pst.commentCount || 0) + 1);
      postState.set(String(currentPostId), pst);
      updatePostCommentUI(String(currentPostId));
    }

    await loadComments();
    const body = commentsUI.querySelector("#pvCommentsList");
    body.scrollTop = body.scrollHeight;
  } catch (e) {
    alert(`Comment failed: ${e?.message || e}`);
  } finally {
    send.disabled = false;
  }
}

async function deleteComment(commentId) {
  if (!confirm("Delete this comment?")) return;

  const { error } = await supabase
    .from("post_comments")
    .delete()
    .eq("id", commentId)
    .eq("author_id", session.user.id);

  if (error) {
    alert(`Delete failed: ${error.message}`);
    return;
  }

  const pst = postState.get(String(currentPostId));
  if (pst) {
    pst.commentCount = Math.max(0, Number(pst.commentCount || 0) - 1);
    postState.set(String(currentPostId), pst);
    updatePostCommentUI(String(currentPostId));
  }

  await loadComments();
}

function updateCommentLikeUI(commentId) {
  const st = commentLikeCache.get(String(commentId));
  if (!st) return;

  const btn = commentsUI.querySelector(
    `button[data-caction="like"][data-cid="${CSS.escape(String(commentId))}"]`
  );
  const pill = commentsUI.querySelector(`span[data-clike-pill="${CSS.escape(String(commentId))}"]`);

  if (pill) pill.textContent = String(st.count);

  if (btn) {
    btn.classList.toggle("liked", !!st.liked);
    btn.childNodes[0].textContent = st.liked ? "Liked " : "Like ";
  }
}

async function toggleCommentLike(commentId) {
  const key = String(commentId);
  const cur = commentLikeCache.get(key) || { count: 0, liked: false };
  const prev = { ...cur };

  cur.liked = !cur.liked;
  cur.count = Math.max(0, cur.count + (cur.liked ? 1 : -1));
  commentLikeCache.set(key, cur);
  updateCommentLikeUI(key);

  try {
    if (cur.liked) {
      const { error } = await supabase.from("comment_likes").insert({
        comment_id: Number(commentId),
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
    commentLikeCache.set(key, prev);
    updateCommentLikeUI(key);
    alert(`Comment like failed: ${e?.message || e}`);
  }
}

/* SHARE (internal placeholder + external + save media) */
let shareUI = null;

function ensureShareUI() {
  if (shareUI) return;

  shareUI = document.createElement("div");
  shareUI.id = "pvShareSheet";
  shareUI.className = "pvSheetWrap";
  shareUI.hidden = true;
  shareUI.innerHTML = `
    <div class="pvSheetBackdrop" data-close="1"></div>
    <section class="pvSheet">
      <div class="pvSheetHead">
        <button class="pvSheetClose" type="button" data-close="1">✕</button>
        <div class="pvSheetTitle">Share</div>
        <div class="pvSheetRight"></div>
      </div>

      <div class="pvSheetBody">
        <div class="pvShareGrid">
          <button class="pvShareBtn" type="button" data-saction="copy">Copy Link</button>
          <button class="pvShareBtn" type="button" data-saction="native">Share to Apps</button>
          <button class="pvShareBtn" type="button" data-saction="save">Save Media</button>
          <button class="pvShareBtn" type="button" data-saction="pepsval">Send in Pepsval</button>
        </div>
        <div class="pvShareHint">“Send in Pepsval” will open Messages with the post link (if Messages page supports it).</div>
      </div>
    </section>
  `;
  document.body.appendChild(shareUI);

  shareUI.addEventListener("click", (e) => {
    if (e.target?.closest?.("[data-close]")) closeShare();
  });

  shareUI.querySelector(".pvSheetBody")?.addEventListener("click", async (e) => {
    const btn = e.target?.closest?.("button[data-saction]");
    if (!btn) return;
    const action = btn.getAttribute("data-saction");
    await handleShareAction(action);
  });
}

let sharePostId = null;
function openShare(postId) {
  ensureShareUI();
  sharePostId = String(postId);
  shareUI.hidden = false;
  document.documentElement.classList.add("pvNoScroll");
  document.body.classList.add("pvNoScroll");
}
function closeShare() {
  if (!shareUI) return;
  shareUI.hidden = true;
  document.documentElement.classList.remove("pvNoScroll");
  document.body.classList.remove("pvNoScroll");
  sharePostId = null;
}

function postLink(postId) {
  return `${location.origin}/feed/index.html#post-${postId}`;
}

async function downloadMedia(url, filename) {
  const res = await fetch(url);
  const blob = await res.blob();
  const a = document.createElement("a");
  const obj = URL.createObjectURL(blob);
  a.href = obj;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(obj);
}

async function handleShareAction(action) {
  if (!sharePostId) return;

  const link = postLink(sharePostId);
  const st = postState.get(String(sharePostId));

  if (action === "copy") {
    await navigator.clipboard.writeText(link);
    alert("Link copied ✅");
    closeShare();
    return;
  }

  if (action === "native") {
    try {
      await navigator.share({ title: "Pepsval Post", url: link });
    } catch {
      await navigator.clipboard.writeText(link);
      alert("Link copied ✅");
    }
    closeShare();
    return;
  }

  if (action === "save") {
    if (!st?.media_url) {
      alert("No media to save.");
      return;
    }
    const ext = st.media_type?.startsWith("video/") ? "mp4" : "jpg";
    await downloadMedia(st.media_url, `pepsval-post-${sharePostId}.${ext}`);
    closeShare();
    return;
  }

  if (action === "pepsval") {
    const url = `/messages/index.html?share=${encodeURIComponent(link)}`;
    window.location.href = url;
    return;
  }
}

/* click actions */
feedListEl?.addEventListener("click", async (e) => {
  const btn = e.target?.closest?.("button[data-action]");
  if (!btn) return;

  const action = btn.getAttribute("data-action");
  const postId = btn.getAttribute("data-post-id");

  if (action === "like") return togglePostLike(postId);
  if (action === "comment") return openComments(postId);
  if (action === "share") return openShare(postId);
  if (action === "delete") return deletePost(postId);
});

/* init */
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
  await loadFeed();
})();