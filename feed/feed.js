// /feed/feed.js
import { supabase } from "/js/supabaseClient.js";

// IMPORTANT: your bucket name
const MEDIA_BUCKET = "post_media";

const elStatus = document.getElementById("feedStatus");
const elList = document.getElementById("feedList");

const elPostText = document.getElementById("postText");
const elPostBtn = document.getElementById("postBtn");
const elPostHint = document.getElementById("postHint");

const elPostFile = document.getElementById("postFile");
const elFileBtn = document.getElementById("fileBtn");

const elProgressWrap = document.getElementById("progressWrap");
const elProgressFill = document.getElementById("progressFill");
const elProgressPct = document.getElementById("progressPct");
const elProgressLabel = document.getElementById("progressLabel");

const elToast = document.getElementById("toast");

function setStatus(text) { if (elStatus) elStatus.textContent = text || ""; }
function setHint(text) { if (elPostHint) elPostHint.textContent = text || ""; }

function toast(text = "Done") {
  if (!elToast) return;
  elToast.textContent = text;
  elToast.classList.add("show");
  setTimeout(() => elToast.classList.remove("show"), 1200);
}

function escapeHtml(str = "") {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function timeAgo(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  const sec = Math.floor(diff / 1000);
  const min = Math.floor(sec / 60);
  const hr = Math.floor(min / 60);
  const day = Math.floor(hr / 24);
  if (day > 0) return `${day}d`;
  if (hr > 0) return `${hr}h`;
  if (min > 0) return `${min}m`;
  return `${sec}s`;
}

function avatarFallback(name = "") {
  const letter = (name.trim()[0] || "P").toUpperCase();
  return `<div class="pv-avatar-fallback" aria-hidden="true">${escapeHtml(letter)}</div>`;
}

function showProgress(show) {
  if (!elProgressWrap) return;
  elProgressWrap.style.display = show ? "block" : "none";
}
function setProgress(pct, label = "Uploading…") {
  const p = Math.max(0, Math.min(100, Math.round(pct)));
  if (elProgressFill) elProgressFill.style.width = `${p}%`;
  if (elProgressPct) elProgressPct.textContent = `${p}%`;
  if (elProgressLabel) elProgressLabel.textContent = label;
}

let currentUserId = null;

async function initAuth() {
  const { data, error } = await supabase.auth.getUser();
  if (error) return null;
  currentUserId = data?.user?.id || null;
  return currentUserId;
}

async function fetchProfilesMap(userIds) {
  if (!userIds || userIds.length === 0) return new Map();

  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name, avatar_url, rank, company")
    .in("id", userIds);

  if (error) return new Map();

  const map = new Map();
  for (const p of data || []) map.set(p.id, p);
  return map;
}

async function fetchLikesForPosts(postIds) {
  if (!postIds.length) return { counts: new Map(), mine: new Set() };

  const { data, error } = await supabase
    .from("post_likes")
    .select("post_id, user_id")
    .in("post_id", postIds);

  if (error) return { counts: new Map(), mine: new Set() };

  const counts = new Map();
  const mine = new Set();
  for (const row of data || []) {
    counts.set(row.post_id, (counts.get(row.post_id) || 0) + 1);
    if (row.user_id === currentUserId) mine.add(row.post_id);
  }
  return { counts, mine };
}

async function fetchCommentCounts(postIds) {
  if (!postIds.length) return new Map();

  const { data, error } = await supabase
    .from("post_comments")
    .select("post_id")
    .in("post_id", postIds);

  if (error) return new Map();

  const counts = new Map();
  for (const row of data || []) counts.set(row.post_id, (counts.get(row.post_id) || 0) + 1);
  return counts;
}

function renderPost(post, profile, likeCount, likedByMe, commentCount) {
  const name = profile?.full_name || "Pepsval Member";
  const rank = profile?.rank || "";
  const company = profile?.company || "";
  const avatarUrl = profile?.avatar_url || "";

  const headerMeta = [rank, company].filter(Boolean).join(" • ");
  const created = post?.created_at ? timeAgo(post.created_at) : "";

  const content = (post?.content ?? "").toString().trim();
  const imageUrl = (post?.image_url ?? "").toString().trim();
  const videoUrl = (post?.video_url ?? "").toString().trim();

  const media = videoUrl
    ? `<video class="pv-media" controls preload="metadata" src="${escapeHtml(videoUrl)}"></video>`
    : imageUrl
      ? `<img class="pv-media" src="${escapeHtml(imageUrl)}" alt="Post media" loading="lazy" />`
      : "";

  const contentHtml = content
    ? `<div class="pv-content">${escapeHtml(content).replaceAll("\n", "<br/>")}</div>`
    : "";

  const isMine = post?.user_id && currentUserId && post.user_id === currentUserId;

  return `
    <article class="pv-post" data-post-id="${escapeHtml(post.id)}">
      <header class="pv-post-hd">
        <div class="pv-avatar">
          ${avatarUrl ? `<img src="${escapeHtml(avatarUrl)}" alt="${escapeHtml(name)}" />` : avatarFallback(name)}
        </div>
        <div class="pv-hd-text">
          <div class="pv-name-row">
            <div class="pv-name">${escapeHtml(name)}</div>
            <div class="pv-time">${escapeHtml(created)}</div>
          </div>
          ${headerMeta ? `<div class="pv-meta">${escapeHtml(headerMeta)}</div>` : ""}
        </div>
        ${isMine ? `<button class="pv-mini" data-action="delete">Delete</button>` : ""}
      </header>

      ${contentHtml}
      ${media}

      <footer class="pv-post-ft">
        <button class="pv-btn" type="button" data-action="like">
          ${likedByMe ? "❤️" : "🤍"} Like <span class="pv-count">(${likeCount || 0})</span>
        </button>
        <button class="pv-btn" type="button" data-action="comments">
          💬 Comment <span class="pv-count">(${commentCount || 0})</span>
        </button>
        <button class="pv-btn" type="button" data-action="share">↗️ Share</button>
      </footer>

      <section class="pv-comments" hidden>
        <div class="pv-comments-list"></div>
        <div class="pv-comments-box">
          <input class="pv-comment-input" type="text" placeholder="Write a comment…" maxlength="300" />
          <button class="pv-mini" data-action="send-comment">Send</button>
        </div>
      </section>
    </article>
  `;
}

async function loadFeed() {
  setStatus("Loading feed…");

  const uid = await initAuth();
  if (!uid) {
    setStatus("Please login to view the feed.");
    if (elPostBtn) elPostBtn.disabled = true;
    setHint("Login required.");
    elList.innerHTML = "";
    return;
  }

  if (elPostBtn) elPostBtn.disabled = false;
  setHint("Text, photo & video supported.");

  const { data: posts, error } = await supabase
    .from("posts")
    .select("id, user_id, content, image_url, video_url, created_at")
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    setStatus("Could not load feed (database error).");
    elList.innerHTML = `<div class="pv-error"><b>Feed failed:</b> ${escapeHtml(error.message)}</div>`;
    return;
  }

  if (!posts || posts.length === 0) {
    setStatus("");
    elList.innerHTML = `<div class="pv-empty">No posts yet.</div>`;
    return;
  }

  const postIds = posts.map(p => p.id);
  const userIds = [...new Set(posts.map(p => p.user_id).filter(Boolean))];

  const [profilesMap, likesInfo, commentCounts] = await Promise.all([
    fetchProfilesMap(userIds),
    fetchLikesForPosts(postIds),
    fetchCommentCounts(postIds),
  ]);

  setStatus("");

  elList.innerHTML = posts.map(p => {
    const likeCount = likesInfo.counts.get(p.id) || 0;
    const likedByMe = likesInfo.mine.has(p.id);
    const commentCount = commentCounts.get(p.id) || 0;
    return renderPost(p, profilesMap.get(p.user_id), likeCount, likedByMe, commentCount);
  }).join("");
}

async function uploadMediaWithFakeProgress(file) {
  // Browser upload doesn't give real percent reliably → we show clean percent 0→90 then 100
  showProgress(true);
  setProgress(0, "Uploading…");

  let pct = 0;
  const timer = setInterval(() => {
    pct = Math.min(90, pct + Math.max(1, Math.round(Math.random() * 6)));
    setProgress(pct, "Uploading…");
  }, 180);

  const safeName = file.name.replace(/[^\w.\-]+/g, "_");
  const path = `${currentUserId}/${Date.now()}_${safeName}`;

  const { error } = await supabase.storage
    .from(MEDIA_BUCKET)
    .upload(path, file, { upsert: true, contentType: file.type || undefined });

  clearInterval(timer);

  if (error) {
    showProgress(false);
    throw new Error(error.message);
  }

  const { data } = supabase.storage.from(MEDIA_BUCKET).getPublicUrl(path);
  setProgress(100, "Uploaded ✅");
  setTimeout(() => showProgress(false), 700);

  return data.publicUrl;
}

async function createPost() {
  const uid = await initAuth();
  if (!uid) { setHint("Please login first."); return; }

  const text = (elPostText?.value || "").trim();
  const file = elPostFile?.files?.[0] || null;

  if (!text && !file) { setHint("Write something or choose a file."); return; }

  if (elPostBtn) elPostBtn.disabled = true;
  setHint("Posting…");

  let image_url = null;
  let video_url = null;

  try {
    if (file) {
      const publicUrl = await uploadMediaWithFakeProgress(file);
      if ((file.type || "").startsWith("video/")) video_url = publicUrl;
      else image_url = publicUrl;
    }

    const payload = {
      content: text || null,
      image_url,
      video_url
      // user_id is filled by DB default auth.uid()
    };

    const { error } = await supabase.from("posts").insert(payload);
    if (error) throw new Error(error.message);

    if (elPostText) elPostText.value = "";
    if (elPostFile) elPostFile.value = "";

    setHint("Posted ✅");
    if (elPostBtn) elPostBtn.disabled = false;

    await loadFeed();
  } catch (e) {
    setHint(`Post failed: ${e.message}`);
    if (elPostBtn) elPostBtn.disabled = false;
  }
}

async function toggleLike(postId, btn) {
  const liked = btn.textContent.includes("❤️");

  if (!liked) {
    const { error } = await supabase.from("post_likes").insert({ post_id: postId });
    if (error) return toast("Like failed");
    toast("Liked");
  } else {
    const { error } = await supabase
      .from("post_likes")
      .delete()
      .eq("post_id", postId)
      .eq("user_id", currentUserId);
    if (error) return toast("Unlike failed");
    toast("Unliked");
  }

  await loadFeed();
}

async function toggleComments(postEl) {
  const box = postEl.querySelector(".pv-comments");
  const list = postEl.querySelector(".pv-comments-list");
  if (!box || !list) return;

  const isOpen = !box.hasAttribute("hidden");
  if (isOpen) { box.setAttribute("hidden", ""); return; }

  box.removeAttribute("hidden");
  list.innerHTML = `<div class="pv-small">Loading comments…</div>`;

  const postId = postEl.dataset.postId;

  const { data, error } = await supabase
    .from("post_comments")
    .select("id, user_id, content, created_at")
    .eq("post_id", postId)
    .order("created_at", { ascending: true })
    .limit(100);

  if (error) { list.innerHTML = `<div class="pv-small">Could not load comments.</div>`; return; }

  if (!data || data.length === 0) {
    list.innerHTML = `<div class="pv-small">No comments yet.</div>`;
    return;
  }

  const userIds = [...new Set(data.map(c => c.user_id).filter(Boolean))];
  const profilesMap = await fetchProfilesMap(userIds);

  list.innerHTML = data.map(c => {
    const name = profilesMap.get(c.user_id)?.full_name || "Member";
    const mine = c.user_id === currentUserId;
    return `
      <div class="pv-comment" data-comment-id="${escapeHtml(c.id)}">
        <b>${escapeHtml(name)}</b> ${escapeHtml(c.content)}
        <span class="pv-small"> • ${escapeHtml(timeAgo(c.created_at))}</span>
        ${mine ? `<button class="pv-mini" data-action="delete-comment">Delete</button>` : ""}
      </div>
    `;
  }).join("");
}

async function sendComment(postEl) {
  const input = postEl.querySelector(".pv-comment-input");
  const postId = postEl.dataset.postId;
  const text = (input?.value || "").trim();
  if (!text) return;

  const { error } = await supabase.from("post_comments").insert({ post_id: postId, content: text });
  if (error) return toast("Comment failed");

  input.value = "";
  toast("Commented");
  await toggleComments(postEl);
  await loadFeed();
}

async function deletePost(postId) {
  const ok = confirm("Delete this post?");
  if (!ok) return;

  const { error } = await supabase
    .from("posts")
    .delete()
    .eq("id", postId)
    .eq("user_id", currentUserId);

  if (error) return toast("Delete failed");
  toast("Deleted");
  await loadFeed();
}

async function deleteComment(commentId) {
  const { error } = await supabase
    .from("post_comments")
    .delete()
    .eq("id", commentId)
    .eq("user_id", currentUserId);

  if (error) return toast("Delete failed");
  toast("Deleted");
  await loadFeed();
}

async function sharePost(postId) {
  const url = `${location.origin}/feed/?post=${encodeURIComponent(postId)}`;
  try { await navigator.clipboard.writeText(url); toast("Link copied"); }
  catch { prompt("Copy this link:", url); }
}

function injectFeedStyles() {
  const style = document.createElement("style");
  style.textContent = `
    .pv-error,.pv-empty{padding:14px;border-radius:14px;background:rgba(0,0,0,.04);font-size:14px;color:#0f172a}
    .pv-small{opacity:.7;font-size:12px}
    .pv-post{padding:14px;border-radius:18px;background:rgba(255,255,255,.9);border:1px solid rgba(0,0,0,.06);margin:12px 0;backdrop-filter: blur(6px);color:#0f172a}
    .pv-post-hd{display:flex;gap:10px;align-items:center;margin-bottom:10px}
    .pv-avatar{width:40px;height:40px;border-radius:999px;overflow:hidden;background:rgba(0,0,0,.06);display:flex;align-items:center;justify-content:center;flex:0 0 auto}
    .pv-avatar img{width:100%;height:100%;object-fit:cover}
    .pv-avatar-fallback{font-weight:900;opacity:.85;color:#0f172a}
    .pv-hd-text{flex:1}
    .pv-name-row{display:flex;justify-content:space-between;gap:10px;align-items:center}
    .pv-name{font-weight:900;color:#0f172a}
    .pv-time{font-size:12px;opacity:.6;color:#0f172a}
    .pv-meta{font-size:12px;opacity:.65;margin-top:2px;color:#0f172a}
    .pv-content{font-size:14px;line-height:1.45;margin:8px 0 10px;color:#0f172a}
    .pv-media{width:100%;border-radius:16px;border:1px solid rgba(0,0,0,.06);max-height:520px;object-fit:cover}
    .pv-post-ft{display:flex;gap:10px;margin-top:10px;flex-wrap:wrap}
    .pv-btn{border:1px solid rgba(0,0,0,.08);background:rgba(255,255,255,.95);padding:8px 10px;border-radius:999px;font-size:13px;color:#0f172a;font-weight:800}
    .pv-count{opacity:.7;font-weight:800}
    .pv-mini{border:1px solid rgba(0,0,0,.10);background:#fff;color:#0f172a;padding:8px 10px;border-radius:999px;font-size:12px;font-weight:800}
    .pv-comments{margin-top:10px;padding-top:10px;border-top:1px solid rgba(0,0,0,.06)}
    .pv-comments-list{display:flex;flex-direction:column;gap:8px;margin-bottom:10px}
    .pv-comment{font-size:13px;line-height:1.35}
    .pv-comments-box{display:flex;gap:8px;align-items:center}
    .pv-comment-input{flex:1;border:1px solid rgba(0,0,0,.12);border-radius:999px;padding:10px 12px;font-size:13px;outline:none}
  `;
  document.head.appendChild(style);
}

document.addEventListener("DOMContentLoaded", async () => {
  injectFeedStyles();

  if (elFileBtn && elPostFile) {
    elFileBtn.addEventListener("click", () => elPostFile.click());
    elPostFile.addEventListener("change", () => {
      const f = elPostFile.files?.[0];
      if (!f) return;
      setHint(`Selected: ${f.name}`);
    });
  }

  if (elPostBtn) elPostBtn.addEventListener("click", createPost);

  // Event delegation (like/comment/share/delete)
  elList.addEventListener("click", async (e) => {
    const btn = e.target.closest("button");
    if (!btn) return;

    const postEl = e.target.closest(".pv-post");
    const action = btn.dataset.action;
    if (!action) return;

    const postId = postEl?.dataset?.postId;

    if (action === "like" && postId) return toggleLike(postId, btn);
    if (action === "comments" && postEl) return toggleComments(postEl);
    if (action === "send-comment" && postEl) return sendComment(postEl);
    if (action === "delete" && postId) return deletePost(postId);
    if (action === "share" && postId) return sharePost(postId);

    if (action === "delete-comment") {
      const commentEl = e.target.closest(".pv-comment");
      const cid = commentEl?.dataset?.commentId;
      if (cid) return deleteComment(cid);
    }
  });

  await loadFeed();
});