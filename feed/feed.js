import { supabase } from "/js/supabase.js";
import { requireAuth, getMyProfile } from "/js/guard.js";

const userNameEl = document.getElementById("userName");
const userAvatarEl = document.getElementById("userAvatar");

const postTextEl = document.getElementById("postText");
const postMediaEl = document.getElementById("postMedia");
const addMediaBtn = document.getElementById("addMedia");
const postBtn = document.getElementById("postBtn");
const mediaPreviewEl = document.getElementById("mediaPreview");

const feedListEl = document.getElementById("feedList");

let session = null;
let me = null; // profile

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
  return (
    profile?.full_name ||
    profile?.username ||
    profile?.name ||
    "Member"
  );
}

function setTopBar(profile) {
  const name = displayName(profile);
  userNameEl.textContent = name;

  // avatar_url optional; fallback to simple default if missing
  const url = profile?.avatar_url || "/assets/default-avatar.png";
  userAvatarEl.src = url;
  userAvatarEl.onerror = () => { userAvatarEl.src = "/assets/default-avatar.png"; };
}

// -------- Media preview --------
let selectedFile = null;

function clearPreview() {
  selectedFile = null;
  mediaPreviewEl.innerHTML = "";
  if (postMediaEl) postMediaEl.value = "";
}

function showPreview(file) {
  if (!file) return;
  const type = file.type || "";
  const url = URL.createObjectURL(file);

  if (type.startsWith("image/")) {
    mediaPreviewEl.innerHTML = `
      <div class="previewCard">
        <img class="previewImg" src="${url}" alt="preview"/>
        <button class="previewRemove" id="removePreview">Remove</button>
      </div>
    `;
  } else if (type.startsWith("video/")) {
    mediaPreviewEl.innerHTML = `
      <div class="previewCard">
        <video class="previewVid" src="${url}" controls playsinline></video>
        <button class="previewRemove" id="removePreview">Remove</button>
      </div>
    `;
  } else {
    mediaPreviewEl.innerHTML = `
      <div class="previewCard">
        <div class="muted">Unsupported file type.</div>
        <button class="previewRemove" id="removePreview">Remove</button>
      </div>
    `;
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

  // basic size guard (25MB)
  if (file.size > 25 * 1024 * 1024) {
    alert("File too large. Please upload under 25MB.");
    clearPreview();
    return;
  }

  selectedFile = file;
  showPreview(file);
});

// -------- Posts rendering --------
function renderPost(p) {
  const mine = p.author_id === session.user.id;

  const author = escapeHtml(p.author_name || "Member");
  const time = escapeHtml(fmt(p.created_at));
  const text = escapeHtml(p.content || "");

  const authorLink = `/profile/user.html?id=${encodeURIComponent(p.author_id)}`;

  let mediaHtml = "";
  if (p.media_url && p.media_type) {
    if (p.media_type.startsWith("image/")) {
      mediaHtml = `<img class="postMediaImg" src="${escapeHtml(p.media_url)}" alt="post media" />`;
    } else if (p.media_type.startsWith("video/")) {
      mediaHtml = `
        <video class="postMediaVid" src="${escapeHtml(p.media_url)}" controls playsinline></video>
      `;
    }
  }

  return `
    <article class="postCard">
      <div class="postHeader">
        <div class="postAuthor">
          <a class="authorLink" href="${authorLink}">${author}</a>
          ${mine ? `<span class="youTag">you</span>` : ``}
        </div>
        <div class="postTime">${time}</div>
      </div>

      ${text ? `<div class="postText">${text}</div>` : ``}
      ${mediaHtml ? `<div class="postMedia">${mediaHtml}</div>` : ``}

      <div class="postFooter">
        <button class="miniBtn" disabled>Like</button>
        <button class="miniBtn" disabled>Comment</button>
        <button class="miniBtn" disabled>Share</button>
      </div>
    </article>
  `;
}

async function loadPosts() {
  feedListEl.innerHTML = `<div class="loading">Loading feed…</div>`;

  const { data, error } = await supabase
    .from("posts")
    .select("id, content, created_at, author_id, author_name, media_url, media_type")
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    feedListEl.innerHTML = `<div class="errorBox">Error loading feed: ${escapeHtml(error.message)}</div>`;
    return;
  }

  if (!data || data.length === 0) {
    feedListEl.innerHTML = `<div class="muted">No posts yet. Be the first to post!</div>`;
    return;
  }

  feedListEl.innerHTML = data.map(renderPost).join("");
}

// -------- Create post --------
async function uploadMedia(file) {
  // Requires a Supabase Storage bucket named: post-media (public)
  const bucket = "post-media";
  const ext = (file.name.split(".").pop() || "bin").toLowerCase();
  const path = `${session.user.id}/${Date.now()}-${Math.random().toString(16).slice(2)}.${ext}`;

  const { error: upErr } = await supabase
    .storage
    .from(bucket)
    .upload(path, file, { upsert: false, contentType: file.type });

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
    const author_name = displayName(me);

    let media_url = null;
    let media_type = null;

    if (selectedFile) {
      media_type = selectedFile.type || null;
      media_url = await uploadMedia(selectedFile);
    }

    const payload = {
      author_id: session.user.id,
      author_name,
      content,
      media_url,     // needs columns in posts table
      media_type
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

// -------- Init --------
(async function init() {
  session = await requireAuth();
  if (!session) return;

  // Ensure setup complete
  const mini = await getMyProfile(session.user.id);
  if (!mini || mini.setup_complete !== true) {
    window.location.href = "/setup/profile-setup.html";
    return;
  }

  // Load full profile for name/avatar
  const { data: prof, error } = await supabase
    .from("profiles")
    .select("id, full_name, username, avatar_url")
    .eq("id", session.user.id)
    .single();

  me = error ? null : prof;

  // fallback if profile read failed
  if (!me) {
    me = { full_name: session.user.email, avatar_url: "/assets/default-avatar.png" };
  }

  setTopBar(me);
  await loadPosts();
})();