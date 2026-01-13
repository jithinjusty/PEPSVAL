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
    .replace(/>/g, "&gt;");
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

addMediaBtn?.addEventListener("click", (e) => {
  e.preventDefault();
  postMediaEl?.click();
});
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

/* ---- Feed rendering ---- */
const postsCache = new Map(); // postId -> row

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

  const liked = row.liked_by_me === true;
  const likeCount = Number(row.like_count || 0);
  const commentCount = Number(row.comment_count || 0);

  const likeLabel = liked ? "Liked" : "Like";
  const likeCls = liked ? "miniBtn miniBtn--active" : "miniBtn";

  const deleteBtn = isMine
    ? `<button class="miniBtn dangerBtn" type="button" data-action="delete" data-post-id="${escapeHtml(
        String(postId)
      )}">Delete</button>`
    : ``;

  const actions = `
    <div class="postFooter">
      <button class="${likeCls}" type="button" data-action="like" data-post-id="${escapeHtml(String(postId))}">
        ${likeLabel} <span class="count" data-count="like">${likeCount}</span>
      </button>

      <button class="miniBtn" type="button" data-action="comment" data-post-id="${escapeHtml(String(postId))}">
        Comment <span class="count" data-count="comment">${commentCount}</span>
      </button>

      <button class="miniBtn" type="button" data-action="share" data-post-id="${escapeHtml(String(postId))}">
        Share
      </button>

      ${deleteBtn}
    </div>
  `;

  return `
    <article class="postCard" id="post-${escapeHtml(String(postId))}" data-post-id="${escapeHtml(String(postId))}">
      <div class="postHeader">
        <div class="postAuthor">
          <a class="authorRow" href="${authorLink}">
            <img class="authorAvatar" src="${escapeHtml(avatarUrl)}" alt="" onerror="this.src='${DEFAULT_AVATAR}'"/>
            <div class="authorMeta">
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

async function loadPosts() {
  feedListEl.innerHTML = `<div class="loading">Loading feed…</div>`;

  const { data, error } = await supabase
    .from("v_feed_posts")
    .select(
      "id, content, created_at, media_url, media_type, author_id, full_name, username, avatar_url, like_count, comment_count, liked_by_me"
    )
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    feedListEl.innerHTML = `<div class="errorBox">Error loading feed: ${escapeHtml(error.message)}</div>`;
    return;
  }

  if (!data?.length) {
    feedListEl.innerHTML = `<div class="muted">No posts yet. Be the first to post!</div>`;
    return;
  }

  postsCache.clear();
  for (const row of data) postsCache.set(String(row.id), row);

  feedListEl.innerHTML = data.map(renderPost).join("");
}

/* Delete post */
async function deletePost(postId) {
  if (!session?.user?.id) {
    alert("Please login again.");
    return;
  }
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

  document.getElementById(`post-${postId}`)?.remove();
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

  if (!session?.user?.id) {
    alert("Please login again.");
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
      author_name: nameFromProfileRow(me), // legacy
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

/* ---- Like system (no full refresh) ---- */
function findPostCard(postId) {
  return feedListEl?.querySelector?.(`.postCard[data-post-id="${CSS.escape(String(postId))}"]`) || null;
}
function setLikeUI(postId, liked, likeCount) {
  const card = findPostCard(postId);
  if (!card) return;

  const likeBtn = card.querySelector('button[data-action="like"]');
  if (!likeBtn) return;

  const countEl = likeBtn.querySelector('span[data-count="like"]');
  if (countEl) countEl.textContent = String(Math.max(0, Number(likeCount || 0)));

  likeBtn.classList.toggle("miniBtn--active", liked === true);
  likeBtn.childNodes[0].textContent = liked ? "Liked " : "Like ";
}

async function toggleLike(postId) {
  if (!session?.user?.id) {
    alert("Please login again.");
    return;
  }

  const row = postsCache.get(String(postId));
  const currentlyLiked = row?.liked_by_me === true;
  const currentCount = Number(row?.like_count || 0);

  const nextLiked = !currentlyLiked;
  const nextCount = currentCount + (nextLiked ? 1 : -1);

  setLikeUI(postId, nextLiked, nextCount);

  if (row) {
    row.liked_by_me = nextLiked;
    row.like_count = nextCount;
    postsCache.set(String(postId), row);
  }

  try {
    if (nextLiked) {
      const { error } = await supabase.from("post_likes").insert({
        post_id: postId,
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
    setLikeUI(postId, currentlyLiked, currentCount);
    if (row) {
      row.liked_by_me = currentlyLiked;
      row.like_count = currentCount;
      postsCache.set(String(postId), row);
    }
    alert(`Like failed: ${e.message || e}`);
  }
}

/* ---- Comments bottom-sheet ---- */
let commentsUI = null;

function ensureCommentsUI() {
  if (commentsUI) return commentsUI;

  const overlay = document.createElement("div");
  overlay.className = "sheetOverlay";
  overlay.hidden = true;

  overlay.innerHTML = `
    <div class="sheet" role="dialog" aria-modal="true" aria-label="Comments">
      <div class="sheetHeader">
        <button type="button" class="sheetClose" aria-label="Close">×</button>
        <div class="sheetTitle">Comments</div>
      </div>

      <div class="sheetBody">
        <div class="commentsList" id="commentsList"><div class="muted">Loading…</div></div>
      </div>

      <div class="sheetComposer">
        <div class="replyHint" id="replyHint" hidden></div>
        <input id="commentInput" class="commentInput" placeholder="Write a comment…" autocomplete="off" />
        <button id="commentSend" class="commentSend" type="button">Post</button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  const sheet = overlay.querySelector(".sheet");
  const closeBtn = overlay.querySelector(".sheetClose");

  closeBtn?.addEventListener("click", () => closeComments());
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) closeComments();
  });
  sheet?.addEventListener("click", (e) => e.stopPropagation());

  commentsUI = {
    overlay,
    listEl: overlay.querySelector("#commentsList"),
    inputEl: overlay.querySelector("#commentInput"),
    sendEl: overlay.querySelector("#commentSend"),
    replyHintEl: overlay.querySelector("#replyHint"),
    activePostId: null,
    replyToId: null,
  };

  commentsUI.sendEl?.addEventListener("click", async () => {
    await submitComment();
  });
  commentsUI.inputEl?.addEventListener("keydown", async (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      await submitComment();
    }
  });

  commentsUI.listEl?.addEventListener("click", (e) => {
    const btn = e.target?.closest?.("button[data-reply-id]");
    if (!btn) return;

    const id = btn.getAttribute("data-reply-id");
    const name = btn.getAttribute("data-reply-name") || "Member";

    commentsUI.replyToId = id;
    commentsUI.replyHintEl.hidden = false;
    commentsUI.replyHintEl.innerHTML = `Replying to <b>${escapeHtml(name)}</b> <button type="button" class="replyCancel" id="replyCancel">Cancel</button>`;

    commentsUI.replyHintEl.querySelector("#replyCancel")?.addEventListener("click", () => {
      commentsUI.replyToId = null;
      commentsUI.replyHintEl.hidden = true;
      commentsUI.replyHintEl.innerHTML = "";
      commentsUI.inputEl.focus();
    });

    commentsUI.inputEl.focus();
  });

  return commentsUI;
}

function openComments(postId) {
  const ui = ensureCommentsUI();
  ui.activePostId = String(postId);
  ui.replyToId = null;
  ui.replyHintEl.hidden = true;
  ui.replyHintEl.innerHTML = "";
  ui.inputEl.value = "";
  ui.overlay.hidden = false;
  document.body.style.overflow = "hidden";
  loadComments(postId);
  setTimeout(() => ui.inputEl.focus(), 200);
}

function closeComments() {
  const ui = ensureCommentsUI();
  ui.overlay.hidden = true;
  ui.activePostId = null;
  ui.replyToId = null;
  document.body.style.overflow = "";
}

async function loadComments(postId) {
  const ui = ensureCommentsUI();
  ui.listEl.innerHTML = `<div class="muted">Loading…</div>`;

  const { data, error } = await supabase
    .from("post_comments")
    .select("id, post_id, user_id, parent_id, body, created_at")
    .eq("post_id", postId)
    .order("created_at", { ascending: true });

  if (error) {
    ui.listEl.innerHTML = `<div class="errorBox">Error loading comments: ${escapeHtml(error.message)}</div>`;
    return;
  }

  if (!data?.length) {
    ui.listEl.innerHTML = `<div class="muted">No comments yet.</div>`;
    return;
  }

  const ids = [...new Set(data.map((c) => c.user_id).filter(Boolean))];
  let profMap = new Map();

  if (ids.length) {
    const { data: profs } = await supabase
      .from("profiles")
      .select("id, full_name, username, avatar_url")
      .in("id", ids);

    (profs || []).forEach((p) => profMap.set(p.id, p));
  }

  const byParent = new Map();
  for (const c of data) {
    const key = c.parent_id ? String(c.parent_id) : "root";
    if (!byParent.has(key)) byParent.set(key, []);
    byParent.get(key).push(c);
  }

  const renderOne = (c, depth = 0) => {
    const p = profMap.get(c.user_id) || {};
    const nm = escapeHtml(nameFromProfileRow(p));
    const av = escapeHtml(p.avatar_url || DEFAULT_AVATAR);
    const body = escapeHtml(c.body || "");
    const time = escapeHtml(fmt(c.created_at));
    const pad = depth > 0 ? `style="margin-left:${Math.min(28, depth * 18)}px"` : "";

    return `
      <div class="cItem" ${pad}>
        <img class="cAvatar" src="${av}" alt="" onerror="this.src='${DEFAULT_AVATAR}'"/>
        <div class="cMain">
          <div class="cTop">
            <div class="cName">${nm}</div>
            <div class="cTime">${time}</div>
          </div>
          <div class="cBody">${body}</div>
          <div class="cActions">
            <button type="button" class="cReply" data-reply-id="${escapeHtml(String(c.id))}" data-reply-name="${nm}">Reply</button>
          </div>
        </div>
      </div>
      ${(byParent.get(String(c.id)) || []).map((r) => renderOne(r, depth + 1)).join("")}
    `;
  };

  const roots = byParent.get("root") || [];
  ui.listEl.innerHTML = roots.map((c) => renderOne(c, 0)).join("");
}

async function submitComment() {
  const ui = ensureCommentsUI();
  const postId = ui.activePostId;
  if (!postId) return;

  if (!session?.user?.id) {
    alert("Please login again.");
    return;
  }

  const body = (ui.inputEl.value || "").trim();
  if (!body) return;

  ui.sendEl.disabled = true;
  ui.sendEl.textContent = "…";

  try {
    const payload = {
      post_id: postId,
      user_id: session.user.id,
      body, // IMPORTANT
      parent_id: ui.replyToId ? ui.replyToId : null,
    };

    const { error } = await supabase.from("post_comments").insert(payload);
    if (error) throw error;

    ui.inputEl.value = "";
    ui.replyToId = null;
    ui.replyHintEl.hidden = true;
    ui.replyHintEl.innerHTML = "";

    const row = postsCache.get(String(postId));
    const current = Number(row?.comment_count || 0) + 1;

    if (row) {
      row.comment_count = current;
      postsCache.set(String(postId), row);
    }

    const card = findPostCard(postId);
    const countEl = card?.querySelector('button[data-action="comment"] span[data-count="comment"]');
    if (countEl) countEl.textContent = String(current);

    await loadComments(postId);
  } catch (e) {
    alert(`Comment failed: ${e.message || e}`);
  } finally {
    ui.sendEl.disabled = false;
    ui.sendEl.textContent = "Post";
  }
}

/* ---- Share ---- */
async function sharePost(postId) {
  const url = `${location.origin}/feed/index.html#post-${postId}`;

  try {
    if (navigator.share) {
      await navigator.share({ title: "Pepsval Post", url });
      return;
    }
  } catch {
    // fallthrough
  }

  try {
    await navigator.clipboard.writeText(url);
    alert("Link copied ✅");
  } catch {
    prompt("Copy this link:", url);
  }
}

/* ---- Actions ---- */
feedListEl?.addEventListener("click", async (e) => {
  const btn = e.target?.closest?.("button[data-action]");
  if (!btn) return;

  const action = btn.getAttribute("data-action");
  const postId = btn.getAttribute("data-post-id");
  if (!postId) return;

  if (action === "delete") return deletePost(postId);
  if (action === "like") return toggleLike(postId);
  if (action === "comment") return openComments(postId);
  if (action === "share") return sharePost(postId);
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