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
function displayName(profile) {
  return profile?.full_name || profile?.username || "Member";
}
function setTopBar(profile) {
  userNameEl.textContent = displayName(profile);
  userAvatarEl.src = profile?.avatar_url || DEFAULT_AVATAR;
  userAvatarEl.onerror = () => { userAvatarEl.src = DEFAULT_AVATAR; };
}

/* Dropdown */
function closeMenu() { avatarMenu.hidden = true; }
function toggleMenu() { avatarMenu.hidden = !avatarMenu.hidden; }

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
  postMediaEl.value = "";
}
function showPreview(file) {
  const type = file.type || "";
  const url = URL.createObjectURL(file);

  if (type.startsWith("image/")) {
    mediaPreviewEl.innerHTML = `
      <div class="previewCard">
        <img class="previewImg" src="${url}" alt="preview"/>
        <button class="previewRemove" id="removePreview">Remove</button>
      </div>`;
  } else if (type.startsWith("video/")) {
    mediaPreviewEl.innerHTML = `
      <div class="previewCard">
        <video class="previewVid" src="${url}" controls playsinline></video>
        <button class="previewRemove" id="removePreview">Remove</button>
      </div>`;
  }

  document.getElementById("removePreview")?.addEventListener("click", () => {
    URL.revokeObjectURL(url);
    clearPreview();
  });
}

addMediaBtn?.addEventListener("click", () => postMediaEl.click());
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

/* Render posts */
function renderPost(p) {
  const author = escapeHtml(p.author_name || "Member");
  const time = escapeHtml(fmt(p.created_at));
  const text = escapeHtml(p.content || "");
  const authorLink = `/profile/user.html?id=${encodeURIComponent(p.author_id)}`;

  let mediaHtml = "";
  if (p.media_url && p.media_type) {
    if (p.media_type.startsWith("image/")) {
      mediaHtml = `<img class="postMediaImg" src="${escapeHtml(p.media_url)}" alt="post media"/>`;
    } else if (p.media_type.startsWith("video/")) {
      mediaHtml = `<video class="postMediaVid" src="${escapeHtml(p.media_url)}" controls playsinline></video>`;
    }
  }

  return `
    <article class="postCard">
      <div class="postHeader">
        <div class="postAuthor">
          <a class="authorLink" href="${authorLink}">${author}</a>
        </div>
        <div class="postTime">${time}</div>
      </div>
      ${text ? `<div class="postText">${text}</div>` : ``}
      ${mediaHtml ? `<div class="postMedia">${mediaHtml}</div>` : ``}
    </article>`;
}

async function loadPosts() {
  const { data, error } = await supabase
    .from("posts")
    .select("id, content, created_at, author_id, author_name, media_url, media_type")
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

/* Upload + create post */
async function uploadMedia(file) {
  const bucket = "post-media";
  const ext = (file.name.split(".").pop() || "bin").toLowerCase();
  const path = `${session.user.id}/${Date.now()}-${Math.random().toString(16).slice(2)}.${ext}`;

  const { error: upErr } = await supabase.storage
    .from(bucket)
    .upload(path, file, { contentType: file.type });

  if (upErr) throw upErr;

  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
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
      author_name: displayName(me),
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