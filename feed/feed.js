import { supabase, SUPABASE_URL, SUPABASE_ANON_KEY } from "/js/supabase.js";
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

const uploadStatusEl = document.getElementById("uploadStatus");
const uploadBarEl = document.getElementById("uploadBar");
const uploadPctEl = document.getElementById("uploadPct");

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
  try { return new Date(ts).toLocaleString(); } catch { return ""; }
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
function closeMenu() { if (!avatarMenu) return; avatarMenu.hidden = true; }
function toggleMenu() { if (!avatarMenu) return; avatarMenu.hidden = !avatarMenu.hidden; }
avatarBtn?.addEventListener("click", (e) => { e.preventDefault(); toggleMenu(); });
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
  if (uploadStatusEl) uploadStatusEl.hidden = true;
  if (uploadBarEl) uploadBarEl.value = 0;
  if (uploadPctEl) uploadPctEl.textContent = "0%";
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

/* Render posts (from v_feed_posts view) */
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

  const deleteBtn = isMine
    ? `<button class="miniBtn dangerBtn" type="button" data-action="delete" data-post-id="${escapeHtml(String(postId))}">Delete</button>`
    : ``;

  const likeLabel = row.liked_by_me ? "Liked" : "Like";
  const likeCount = Number(row.like_count || 0);
  const commentCount = Number(row.comment_count || 0);

  const actions = `
    <div class="postFooter">
      <button class="miniBtn ${row.liked_by_me ? "active" : ""}" type="button" data-action="like" data-post-id="${escapeHtml(String(postId))}">
        ${likeLabel} (${likeCount})
      </button>
      <button class="miniBtn" type="button" data-action="comment" data-post-id="${escapeHtml(String(postId))}">
        Comment (${commentCount})
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
            <img src="${escapeHtml(avatarUrl)}" alt="" style="width:34px;height:34px;border-radius:999px;object-fit:cover;border:1px solid #dbe7ef;background:#fff" onerror="this.src='${DEFAULT_AVATAR}'"/>
            <div>
              <div class="postAuthorName" style="font-weight:900;line-height:1.1;">${authorName}${isMine ? ` <span class="youTag">you</span>` : ``}</div>
              <div class="postTime">${time}</div>
            </div>
          </a>
        </div>
      </div>

      ${text ? `<div class="postText">${text}</div>` : ``}
      ${mediaHtml ? `<div class="postMedia">${mediaHtml}</div>` : ``}

      ${actions}

      <!-- Comments panel (simple) -->
      <div class="commentsWrap" data-comments-wrap="${escapeHtml(String(postId))}" style="display:none;margin-top:10px;border-top:1px solid #dbe7ef;padding-top:10px;">
        <div class="commentsList" data-comments-list="${escapeHtml(String(postId))}"></div>
        <div style="display:flex;gap:10px;margin-top:10px;">
          <input class="commentInput" data-comment-input="${escapeHtml(String(postId))}" placeholder="Add a comment..." style="flex:1;padding:10px;border:1px solid #dbe7ef;border-radius:12px;" />
          <button class="miniBtn" data-action="comment-post" data-post-id="${escapeHtml(String(postId))}">Post</button>
        </div>
      </div>
    </article>
  `;
}

async function loadPosts() {
  feedListEl.innerHTML = `<div class="loading">Loading feed…</div>`;

  const { data, error } = await supabase
    .from("v_feed_posts")
    .select("id, content, created_at, media_url, media_type, author_id, full_name, username, avatar_url, like_count, comment_count, liked_by_me")
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

  feedListEl.innerHTML = data.map(renderPost).join("");
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

/* Upload (with real % progress) */
async function uploadMedia(file) {
  const ext = (file.name.split(".").pop() || "bin").toLowerCase();
  const path = `${session.user.id}/${Date.now()}-${Math.random().toString(16).slice(2)}.${ext}`;

  if (uploadStatusEl) uploadStatusEl.hidden = false;
  if (uploadBarEl) uploadBarEl.value = 0;
  if (uploadPctEl) uploadPctEl.textContent = "0%";

  const url = `${SUPABASE_URL}/storage/v1/object/${BUCKET}/${path}`;

  await new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", url, true);
    xhr.setRequestHeader("Authorization", `Bearer ${session.access_token}`);
    xhr.setRequestHeader("apikey", SUPABASE_ANON_KEY);
    xhr.setRequestHeader("Content-Type", file.type || "application/octet-stream");
    xhr.setRequestHeader("x-upsert", "false");

    xhr.upload.onprogress = (evt) => {
      if (!evt.lengthComputable) return;
      const pct = Math.round((evt.loaded / evt.total) * 100);
      if (uploadBarEl) uploadBarEl.value = pct;
      if (uploadPctEl) uploadPctEl.textContent = `${pct}%`;
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        if (uploadBarEl) uploadBarEl.value = 100;
        if (uploadPctEl) uploadPctEl.textContent = "100%";
        resolve();
      } else {
        reject(new Error(`Upload failed (${xhr.status}): ${xhr.responseText}`));
      }
    };

    xhr.onerror = () => reject(new Error("Upload failed (network error)."));
    xhr.send(file);
  });

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

/* Create post */
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

/* Likes */
async function toggleLike(postId) {
  const { data: existing, error: selErr } = await supabase
    .from("post_likes")
    .select("id")
    .eq("post_id", postId)
    .eq("user_id", session.user.id)
    .maybeSingle();

  if (selErr) throw selErr;

  if (existing?.id) {
    const { error } = await supabase.from("post_likes").delete().eq("id", existing.id);
    if (error) throw error;
    return false;
  } else {
    const { error } = await supabase.from("post_likes").insert({ post_id: postId, user_id: session.user.id });
    if (error) throw error;
    return true;
  }
}

/* Comments */
async function loadComments(postId) {
  const wrap = document.querySelector(`[data-comments-wrap="${CSS.escape(String(postId))}"]`);
  const list = document.querySelector(`[data-comments-list="${CSS.escape(String(postId))}"]`);
  if (!wrap || !list) return;

  list.innerHTML = `<div class="muted">Loading comments…</div>`;

  const { data, error } = await supabase
    .from("post_comments")
    .select("id, post_id, user_id, body, parent_id, created_at")
    .eq("post_id", postId)
    .order("created_at", { ascending: true });

  if (error) {
    list.innerHTML = `<div class="errorBox">Comment load failed: ${escapeHtml(error.message)}</div>`;
    return;
  }

  if (!data?.length) {
    list.innerHTML = `<div class="muted">No comments yet.</div>`;
    return;
  }

  list.innerHTML = data
    .map((c) => {
      const mine = c.user_id === session.user.id;
      return `
        <div style="padding:10px;border:1px solid #dbe7ef;border-radius:12px;margin-bottom:8px;background:#fff">
          <div style="font-weight:800">${mine ? "You" : "Member"} <span style="font-weight:600;color:#5a6b76;font-size:12px">• ${escapeHtml(fmt(c.created_at))}</span></div>
          <div style="margin-top:6px;white-space:pre-wrap">${escapeHtml(c.body || "")}</div>
        </div>
      `;
    })
    .join("");
}

async function addComment(postId, text) {
  const content = (text || "").trim();
  if (!content) throw new Error("Write a comment first.");

  const { error } = await supabase
    .from("post_comments")
    .insert({ post_id: postId, user_id: session.user.id, body: content });

  if (error) throw error;
}

/* Share */
async function sharePost(postId) {
  const url = `${location.origin}/feed/index.html#post-${postId}`;
  try {
    await navigator.share({ title: "Pepsval Post", url });
  } catch {
    await navigator.clipboard.writeText(url);
    alert("Link copied ✅");
  }
}

/* Events */
feedListEl?.addEventListener("click", async (e) => {
  const btn = e.target?.closest?.("button[data-action]");
  if (!btn) return;

  const action = btn.getAttribute("data-action");
  const postId = btn.getAttribute("data-post-id");

  try {
    if (action === "delete") {
      await deletePost(postId);
      return;
    }

    if (action === "like") {
      await toggleLike(postId);
      await loadPosts();
      return;
    }

    if (action === "comment") {
      const wrap = document.querySelector(`[data-comments-wrap="${CSS.escape(String(postId))}"]`);
      if (!wrap) return;
      const isOpen = wrap.style.display !== "none";
      wrap.style.display = isOpen ? "none" : "block";
      if (!isOpen) await loadComments(postId);
      return;
    }

    if (action === "comment-post") {
      const input = document.querySelector(`[data-comment-input="${CSS.escape(String(postId))}"]`);
      if (!input) return;
      await addComment(postId, input.value);
      input.value = "";
      await loadComments(postId);
      await loadPosts();
      return;
    }

    if (action === "share") {
      await sharePost(postId);
      return;
    }
  } catch (err) {
    alert(err?.message || String(err));
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