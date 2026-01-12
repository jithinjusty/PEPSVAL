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
    const pillHtml = pill ? pill.outerHTML : `<span class="countPill" data-like-count="${escapeHtml(String(postId))}">${count}</span>`;
    btn.innerHTML = `${liked ? "Liked" : "Like"} ${pillHtml}`;
  }
}

async function toggleLike(postId) {
  if (!postId || !session?.user?.id) return;

  const key = String(postId);
  const cur = likeCache.get(key) || { count: 0, liked: false };

  // optimistic UI
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
    // rollback on error
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
    alert("Next step: Comments system (modal + replies + likes).");
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