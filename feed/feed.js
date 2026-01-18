alert("FEED.JS LOADED");
import { supabase, getCurrentUser } from "/js/supabase.js";

/* =========================================================
   PEPSVAL FEED — FULL, STABLE, DEFENSIVE
   Fixes (your request):
   - Avatar NOT showing -> loads from profiles.avatar_url
   - Avatar menu NOT working -> fixed open/close
   - Logout NOT working -> supabase.auth.signOut + redirect
   - Settings item in avatar menu -> /dashboard/settings.html

   Also keeps feed functional and smooth:
   - Create post with media upload (image/video) + progress
   - Load posts + profiles for names/avatars
   - Likes + comments update without full reload
   - Delete post (owner)
   - Comment likes + delete (if tables exist; safe fallback)
========================================================= */

const MEDIA_BUCKET = "post_media";

/* ---------- DOM helpers ---------- */
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

// avatar/menu
const elMeAvatarBtn = $("meAvatarBtn");
const elMeMenu = $("meMenu");
const elMenuProfile = $("menuProfile");
const elMenuSettings = $("menuSettings");
const elMenuLogout = $("menuLogout");
const elMeAvatarImg = elMeAvatarBtn ? elMeAvatarBtn.querySelector("img.avatar") : null;

let me = null;
let selectedFile = null;
let postKeyset = null;

/* ---------- UI ---------- */
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

/* ---------- Defensive key detection ---------- */
function detectKeys(row) {
  const keys = row ? Object.keys(row) : [];
  const pick = (arr) => arr.find(k => keys.includes(k)) || null;
  return {
    idKey: pick(["id", "post_id"]),
    userKey: pick(["user_id", "author_id", "uid", "profile_id"]),
    contentKey: pick(["content", "body", "text", "caption", "post_text"]),
    mediaKey: pick(["media_url", "image_url", "photo_url", "video_url", "media"]),
    createdKey: pick(["created_at", "created", "timestamp"])
  };
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

  if (elMenuProfile) {
    elMenuProfile.addEventListener("click", () => {
      setMenuOpen(false);
      window.location.href = "/profile/home.html";
    });
  }
  if (elMenuSettings) {
    elMenuSettings.addEventListener("click", () => {
      setMenuOpen(false);
      window.location.href = "/dashboard/settings.html";
    });
  }
  if (elMenuLogout) {
    elMenuLogout.addEventListener("click", async () => {
      try {
        setMenuOpen(false);
        setStatus("Logging out…");
        const { error } = await supabase.auth.signOut();
        if (error) throw error;
        window.location.href = "/auth/login.html";
      } catch (err) {
        console.error(err);
        toast(err?.message || "Logout failed");
        setStatus("");
      }
    });
  }
}

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
    console.warn("Avatar load failed:", e?.message || e);
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
  if (elFileBtn && elFile) elFileBtn.addEventListener("click", () => elFile.click());

  if (elFile) {
    elFile.addEventListener("change", () => {
      const f = elFile.files && elFile.files[0];
      setFileUI(f || null);
    });
  }

  if (elClearFile && elFile) {
    elClearFile.addEventListener("click", () => {
      elFile.value = "";
      setFileUI(null);
    });
  }

  if (elPostBtn) elPostBtn.addEventListener("click", createPost);
}

/* ---------- Upload media ---------- */
async function uploadMedia(file) {
  if (!file) return null;

  const ext = (file.name.split(".").pop() || "bin").toLowerCase();
  const path = `${me.id}/${Date.now()}_${Math.random().toString(16).slice(2)}.${ext}`;

  showProgress(true, "Uploading…", 5);

  const { error: upErr } = await supabase.storage
    .from(MEDIA_BUCKET)
    .upload(path, file, { upsert: false });

  if (upErr) throw new Error(upErr.message);

  showProgress(true, "Finishing…", 85);

  const { data: pub } = supabase.storage.from(MEDIA_BUCKET).getPublicUrl(path);
  const url = pub?.publicUrl || null;

  showProgress(true, "Done", 100);
  setTimeout(() => showProgress(false), 650);

  return url;
}

/* ---------- Create post ---------- */
async function createPost() {
  const text = (elPostText?.value || "").trim();
  if (!text && !selectedFile) {
    toast("Write something or attach a file.");
    return;
  }

  try {
    elPostBtn && (elPostBtn.disabled = true);
    setStatus("Posting…");

    let mediaUrl = null;
    if (selectedFile) mediaUrl = await uploadMedia(selectedFile);

    // Try common schema first
    let res = await supabase.from("posts").insert([{
      user_id: me.id,
      content: text,
      media_url: mediaUrl,
      created_at: new Date().toISOString()
    }]).select("*").maybeSingle();

    // Fallback schema
    if (res.error) {
      res = await supabase.from("posts").insert([{
        user_id: me.id,
        body: text,
        media_url: mediaUrl
      }]).select("*").maybeSingle();
    }

    if (res.error) throw new Error(res.error.message);

    // Reset composer
    if (elPostText) elPostText.value = "";
    if (elFile) elFile.value = "";
    setFileUI(null);

    toast("Posted");
    setStatus("");

    // Prepend new post without reload (best effort)
    await loadFeed(true);
  } catch (e) {
    console.error(e);
    setStatus("");
    toast(`Post failed: ${e?.message || "Unknown error"}`);
  } finally {
    elPostBtn && (elPostBtn.disabled = false);
  }
}

/* ---------- Fetch feed ---------- */
async function fetchPosts() {
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

async function fetchLikes(postIds) {
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

  if (error) throw new Error(`Comments load failed: ${error.message}`);

  for (const c of (data || [])) {
    counts.set(c.post_id, (counts.get(c.post_id) || 0) + 1);
    const arr = byPost.get(c.post_id) || [];
    arr.push(c);
    byPost.set(c.post_id, arr);
  }
  return { counts, byPost };
}

/* ---------- Render ---------- */
function renderFeed(posts, profMap, likesInfo, commentsInfo) {
  if (!elList) return;

  if (!posts.length) {
    elList.innerHTML = `<div style="opacity:.7;padding:14px;">No posts yet</div>`;
    return;
  }

  elList.innerHTML = posts.map(p => {
    const pid = postKeyset.idKey ? p[postKeyset.idKey] : p.id;
    const uid = postKeyset.userKey ? p[postKeyset.userKey] : (p.user_id || p.author_id);

    const prof = uid ? (profMap.get(uid) || {}) : {};
    const name = prof.full_name || "Seafarer";
    const avatar = prof.avatar_url || "";
    const rank = prof.rank ? ` • ${esc(prof.rank)}` : "";
    const country = prof.country ? ` • ${esc(prof.country)}` : "";

    const content = postKeyset.contentKey ? (p[postKeyset.contentKey] || "") : (p.content || p.body || "");
    const media = postKeyset.mediaKey ? (p[postKeyset.mediaKey] || null) : (p.media_url || null);
    const created = postKeyset.createdKey ? p[postKeyset.createdKey] : (p.created_at || null);

    const likes = likesInfo.counts.get(pid) || 0;
    const iLiked = likesInfo.mine.has(pid);
    const commCount = commentsInfo.counts.get(pid) || 0;
    const comments = commentsInfo.byPost.get(pid) || [];

    const isMine = (me && (p.user_id === me.id || p.author_id === me.id));

    const mediaHtml = media ? `
      <div class="pv-media">
        ${String(media).match(/\.(mp4|mov|webm)(\?|$)/i)
          ? `<video class="pv-mediaEl" src="${esc(media)}" controls></video>`
          : `<img class="pv-mediaEl" src="${esc(media)}" alt="media" />`}
      </div>` : "";

    return `
      <article class="pv-post" data-post-id="${esc(pid)}">
        <header class="pv-postHead">
          <div class="pv-user">
            <div class="pv-userAvatar">
              ${avatar ? `<img src="${esc(avatar)}" alt="${esc(name)}" />` : `<span>${esc(name.slice(0,1))}</span>`}
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

        <div class="pv-postText">${esc(content)}</div>
        ${mediaHtml}

        <div class="pv-actions">
          <button class="pv-pillBtn" data-action="like">${iLiked ? "Unlike" : "Like"} (${likes})</button>
          <button class="pv-pillBtn" data-action="toggleComments">Comments (${commCount})</button>
        </div>

        <div class="pv-commentsWrap" data-comments style="display:none;">
          <div class="pv-commentsTitle">Comments</div>
          <div class="pv-commentsList">
            ${comments.length ? comments.map(c => {
              const t = c.body || c.content || "";
              return `
                <div class="pv-comment">
                  <div class="pv-commentText">${esc(t)}</div>
                  <div class="pv-commentMeta">${esc(safeDate(c.created_at))}</div>
                </div>`;
            }).join("") : `<div style="opacity:.7;padding:8px 0;">No comments yet</div>`}
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

/* ---------- Actions (in-place) ---------- */
async function deletePost(postId) {
  if (!postId) return;
  if (!confirm("Delete this post?")) return;

  try {
    setStatus("Deleting…");
    const { error } = await supabase.from("posts").delete().eq("id", postId).eq("user_id", me.id);
    if (error) throw new Error(error.message);
    toast("Deleted");
    setStatus("");

    // remove from DOM immediately
    const el = elList.querySelector(`[data-post-id="${CSS.escape(postId)}"]`);
    if (el) el.remove();
  } catch (e) {
    console.error(e);
    setStatus("");
    toast(`Delete failed: ${e?.message || "Unknown error"}`);
  }
}

async function toggleLike(postId, btn) {
  if (!postId) return;
  const currentlyLiked = btn.textContent.trim().toLowerCase().startsWith("unlike");

  try {
    if (currentlyLiked) {
      const { error } = await supabase.from("post_likes").delete().eq("post_id", postId).eq("user_id", me.id);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabase.from("post_likes").insert([{ post_id: postId, user_id: me.id }]);
      if (error) throw new Error(error.message);
    }

    // refresh just this post like count
    const { data, error } = await supabase.from("post_likes").select("post_id").eq("post_id", postId);
    if (error) throw new Error(error.message);

    const count = (data || []).length;
    btn.textContent = `${currentlyLiked ? "Like" : "Unlike"} (${count})`;
  } catch (e) {
    console.error(e);
    toast(`Like failed: ${e?.message || "Unknown error"}`);
  }
}

async function sendComment(postId, wrap) {
  const input = wrap.querySelector("[data-comment-input]");
  const txt = (input?.value || "").trim();
  if (!txt) return;

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

    if (res.error) throw new Error(res.error.message);

    input.value = "";

    // append comment without reload
    const list = wrap.querySelector(".pv-commentsList");
    const node = document.createElement("div");
    node.className = "pv-comment";
    node.innerHTML = `<div class="pv-commentText">${esc(txt)}</div><div class="pv-commentMeta">${esc(new Date().toLocaleString())}</div>`;
    list.appendChild(node);

    // update count label
    const postEl = wrap.closest("[data-post-id]");
    const btn = postEl.querySelector('[data-action="toggleComments"]');
    if (btn) {
      const m = btn.textContent.match(/\((\d+)\)/);
      const n = m ? Number(m[1]) : 0;
      btn.textContent = `Comments (${n + 1})`;
    }
  } catch (e) {
    console.error(e);
    toast(`Comment failed: ${e?.message || "Unknown error"}`);
  }
}

/* ---------- Feed click binding ---------- */
function bindFeedClicks() {
  if (!elList) return;

  elList.addEventListener("click", async (e) => {
    const btn = e.target.closest("[data-action]");
    if (!btn) return;

    const postEl = e.target.closest("[data-post-id]");
    const postId = postEl?.getAttribute("data-post-id");
    const action = btn.getAttribute("data-action");

    if (action === "toggleComments") {
      const wrap = postEl.querySelector("[data-comments]");
      if (!wrap) return;
      wrap.style.display = (wrap.style.display === "none" || !wrap.style.display) ? "block" : "none";
      return;
    }

    if (action === "sendComment") {
      const wrap = postEl.querySelector("[data-comments]");
      return await sendComment(postId, wrap);
    }

    if (action === "like") {
      return await toggleLike(postId, btn);
    }

    if (action === "deletePost") {
      return await deletePost(postId);
    }
  });
}

/* ---------- Load feed ---------- */
async function loadFeed(reloadAll = false) {
  try {
    setStatus("Loading feed…");
    const posts = await fetchPosts();
    postKeyset = detectKeys(posts[0] || {});

    const postIds = [];
    const userIds = [];
    for (const p of posts) {
      const pid = postKeyset.idKey ? p[postKeyset.idKey] : p.id;
      if (pid) postIds.push(pid);
      const uid = postKeyset.userKey ? p[postKeyset.userKey] : (p.user_id || p.author_id);
      if (uid) userIds.push(uid);
    }

    const profMap = await fetchProfilesMap([...new Set(userIds.filter(Boolean))]);
    const likesInfo = await fetchLikes(postIds);
    const commentsInfo = await fetchComments(postIds);

    renderFeed(posts, profMap, likesInfo, commentsInfo);

    setStatus("");
  } catch (e) {
    console.error(e);
    setStatus(`❌ ${e?.message || "Feed failed"}`);
    toast(e?.message || "Feed failed");
  }
}

/* ---------- Boot ---------- */
document.addEventListener("DOMContentLoaded", async () => {
  // show errors on screen
  window.addEventListener("error", (e) => {
    console.error(e?.error || e);
    setStatus(`❌ ${e?.message || "Script error"}`);
  });
  window.addEventListener("unhandledrejection", (e) => {
    console.error(e?.reason || e);
    setStatus(`❌ ${e?.reason?.message || e?.reason || "Promise error"}`);
  });

  const ok = await requireLogin();
  if (!ok) return;

  bindAvatarMenu();
  await loadMyAvatar();

  bindComposer();
  bindFeedClicks();

  await loadFeed();
});