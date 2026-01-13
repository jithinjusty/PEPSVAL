import { supabase } from "/js/supabaseClient.js";

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
const elMeAvatar = document.getElementById("meAvatar");

function setStatus(t) { if (elStatus) elStatus.textContent = t || ""; }
function setHint(t) { if (elPostHint) elPostHint.textContent = t || ""; }

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
  const { data } = await supabase.auth.getUser();
  currentUserId = data?.user?.id || null;
  return currentUserId;
}

async function getMyProfile() {
  if (!currentUserId) return null;
  const { data } = await supabase
    .from("profiles")
    .select("id, full_name, avatar_url, rank, company")
    .eq("id", currentUserId)
    .maybeSingle();
  return data || null;
}

function setTopAvatar(profile) {
  if (!elMeAvatar) return;
  const name = profile?.full_name || "Pepsval Member";
  const url = profile?.avatar_url || "";
  if (url) {
    elMeAvatar.innerHTML = `<img src="${escapeHtml(url)}" alt="${escapeHtml(name)}" />`;
  } else {
    elMeAvatar.textContent = (name.trim()[0] || "P").toUpperCase();
  }
}

async function fetchProfilesMap(userIds) {
  if (!userIds?.length) return new Map();
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
  const { data, error } = await supabase
    .from("post_comments")
    .select("post_id")
    .in("post_id", postIds);
  if (error) return new Map();

  const counts = new Map();
  for (const row of data || []) counts.set(row.post_id, (counts.get(row.post_id) || 0) + 1);
  return counts;
}

function avatarFallback(name = "") {
  const letter = (name.trim()[0] || "P").toUpperCase();
  return `<div class="pv-avatar-fallback">${escapeHtml(letter)}</div>`;
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

  const contentHtml = content ? `<div class="pv-content">${escapeHtml(content).replaceAll("\n","<br/>")}</div>` : "";

  const isMine = post.user_id === currentUserId;

  return `
    <article class="pv-post" data-post-id="${escapeHtml(post.id)}" data-liked="${likedByMe ? "1" : "0"}">
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
        ${isMine ? `<button class="pv-mini" data-action="delete-post">Delete</button>` : ""}
      </header>

      ${contentHtml}
      ${media}

      <footer class="pv-post-ft">
        <button class="pv-btn" type="button" data-action="like-post">
          <span class="pv-heart">${likedByMe ? "❤️" : "🤍"}</span>
          Like <span class="pv-count" data-like-count>(${likeCount || 0})</span>
        </button>

        <button class="pv-btn" type="button" data-action="toggle-comments">
          💬 Comment <span class="pv-count" data-comment-count>(${commentCount || 0})</span>
        </button>

        <button class="pv-btn" type="button" data-action="share-post">↗️ Share</button>
      </footer>

      <section class="pv-comments" hidden>
        <div class="pv-comments-list"></div>
        <div class="pv-comments-box">
          <input class="pv-comment-input" type="text" placeholder="Write a comment…" maxlength="300" />
          <button class="pv-mini" data-action="send-comment">Send</button>
        </div>
        <div class="pv-replying" hidden>
          Replying… <button class="pv-mini" data-action="cancel-reply">Cancel</button>
        </div>
      </section>
    </article>
  `;
}

function injectStyles() {
  const style = document.createElement("style");
  style.textContent = `
    .pv-post{padding:14px;border-radius:18px;background:rgba(255,255,255,.94);border:1px solid rgba(0,0,0,.06);margin:12px 0}
    .pv-post-hd{display:flex;gap:10px;align-items:center;margin-bottom:10px}
    .pv-avatar{width:40px;height:40px;border-radius:999px;overflow:hidden;background:rgba(0,0,0,.06);display:flex;align-items:center;justify-content:center;flex:0 0 auto}
    .pv-avatar img{width:100%;height:100%;object-fit:cover}
    .pv-avatar-fallback{font-weight:900;opacity:.9}
    .pv-hd-text{flex:1}
    .pv-name-row{display:flex;justify-content:space-between;gap:10px;align-items:center}
    .pv-name{font-weight:950}
    .pv-time{font-size:12px;opacity:.6}
    .pv-meta{font-size:12px;opacity:.7;margin-top:2px}
    .pv-content{font-size:14px;line-height:1.45;margin:8px 0 10px}
    .pv-media{width:100%;border-radius:16px;border:1px solid rgba(0,0,0,.06);max-height:520px;object-fit:cover}
    .pv-post-ft{display:flex;gap:10px;margin-top:10px;flex-wrap:wrap}
    .pv-btn{border:1px solid rgba(0,0,0,.08);background:#fff;padding:8px 10px;border-radius:999px;font-size:13px;font-weight:900}
    .pv-mini{border:1px solid rgba(0,0,0,.10);background:#fff;padding:8px 10px;border-radius:999px;font-size:12px;font-weight:900}
    .pv-count{opacity:.7}
    .pv-comments{margin-top:10px;padding-top:10px;border-top:1px solid rgba(0,0,0,.06)}
    .pv-comments-list{display:flex;flex-direction:column;gap:10px;margin-bottom:10px}
    .pv-comment{font-size:13px;line-height:1.35;padding:10px;border-radius:14px;background:rgba(0,0,0,.03);border:1px solid rgba(0,0,0,.06)}
    .pv-comment-actions{display:flex;gap:8px;margin-top:6px;flex-wrap:wrap}
    .pv-comments-box{display:flex;gap:8px;align-items:center}
    .pv-comment-input{flex:1;border:1px solid rgba(0,0,0,.12);border-radius:999px;padding:10px 12px;font-size:13px;outline:none}
    .pv-reply{margin-left:14px;border-left:2px solid rgba(31,111,134,.2);padding-left:10px}
    .pv-replying{margin-top:8px;opacity:.75;font-size:12px}
  `;
  document.head.appendChild(style);
}

async function uploadMedia(file) {
  // Clean % animation (browser doesn’t expose real % reliably)
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
  await initAuth();
  if (!currentUserId) { setHint("Please login first."); return; }

  const text = (elPostText?.value || "").trim();
  const file = elPostFile?.files?.[0] || null;

  if (!text && !file) { setHint("Write something or choose a file."); return; }

  if (elPostBtn) elPostBtn.disabled = true;
  setHint("Posting…");

  let image_url = null;
  let video_url = null;

  try {
    if (file) {
      const url = await uploadMedia(file);
      if ((file.type || "").startsWith("video/")) video_url = url;
      else image_url = url;
    }

    const { error } = await supabase.from("posts").insert({
      content: text || null,
      image_url,
      video_url
      // user_id default handled by DB
    });

    if (error) throw new Error(error.message);

    elPostText.value = "";
    elPostFile.value = "";
    setHint("Posted ✅");
    elPostBtn.disabled = false;

    await loadFeed();
  } catch (e) {
    setHint(`Post failed: ${e.message}`);
    elPostBtn.disabled = false;
  }
}

async function loadFeed() {
  setStatus("Loading feed…");
  await initAuth();

  if (!currentUserId) {
    setStatus("Please login to view the feed.");
    elList.innerHTML = "";
    if (elPostBtn) elPostBtn.disabled = true;
    return;
  }

  if (elPostBtn) elPostBtn.disabled = false;

  const myProfile = await getMyProfile();
  setTopAvatar(myProfile);

  const { data: posts, error } = await supabase
    .from("posts")
    .select("id, user_id, content, image_url, video_url, created_at")
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    setStatus("Feed error");
    elList.innerHTML = `<div style="padding:12px">Feed failed: ${escapeHtml(error.message)}</div>`;
    return;
  }

  if (!posts?.length) {
    setStatus("");
    elList.innerHTML = `<div style="padding:12px;opacity:.7">No posts yet.</div>`;
    return;
  }

  const postIds = posts.map(p => p.id);
  const userIds = [...new Set(posts.map(p => p.user_id).filter(Boolean))];

  const [profilesMap, likesInfo, commentCounts] = await Promise.all([
    fetchProfilesMap(userIds),
    fetchLikesForPosts(postIds),
    fetchCommentCounts(postIds)
  ]);

  setStatus("");

  elList.innerHTML = posts.map(p => {
    const likeCount = likesInfo.counts.get(p.id) || 0;
    const likedByMe = likesInfo.mine.has(p.id);
    const commentCount = commentCounts.get(p.id) || 0;
    return renderPost(p, profilesMap.get(p.user_id), likeCount, likedByMe, commentCount);
  }).join("");
}

/* ---------- Likes (instant UI update) ---------- */
async function togglePostLike(postEl) {
  const postId = postEl.dataset.postId;
  const liked = postEl.dataset.liked === "1";

  const countEl = postEl.querySelector("[data-like-count]");
  const heartEl = postEl.querySelector(".pv-heart");

  // current count
  const currentCount = Number((countEl?.textContent || "0").replace(/[^\d]/g, "")) || 0;

  // optimistic update
  postEl.dataset.liked = liked ? "0" : "1";
  if (heartEl) heartEl.textContent = liked ? "🤍" : "❤️";
  if (countEl) countEl.textContent = `(${liked ? Math.max(0, currentCount - 1) : currentCount + 1})`;

  if (!liked) {
    // insert like (user_id default auth.uid())
    const { error } = await supabase.from("post_likes").insert({ post_id: postId });
    if (error) {
      // revert on failure
      postEl.dataset.liked = "0";
      if (heartEl) heartEl.textContent = "🤍";
      if (countEl) countEl.textContent = `(${currentCount})`;
      return toast("Like failed");
    }
    return;
  } else {
    const { error } = await supabase
      .from("post_likes")
      .delete()
      .eq("post_id", postId)
      .eq("user_id", currentUserId);
    if (error) {
      // revert on failure
      postEl.dataset.liked = "1";
      if (heartEl) heartEl.textContent = "❤️";
      if (countEl) countEl.textContent = `(${currentCount})`;
      return toast("Unlike failed");
    }
    return;
  }
}

/* ---------- Comments + Replies + Comment Like ---------- */
const replyState = new Map(); // postId -> commentId

async function loadComments(postEl) {
  const postId = postEl.dataset.postId;
  const box = postEl.querySelector(".pv-comments");
  const list = postEl.querySelector(".pv-comments-list");
  if (!box || !list) return;

  box.hidden = false;
  list.innerHTML = `<div style="opacity:.7;font-size:12px">Loading comments…</div>`;

  const { data, error } = await supabase
    .from("post_comments")
    .select("id, post_id, user_id, content, created_at, parent_id")
    .eq("post_id", postId)
    .order("created_at", { ascending: true })
    .limit(200);

  if (error) {
    list.innerHTML = `<div style="opacity:.7;font-size:12px">Could not load comments.</div>`;
    return;
  }

  const comments = data || [];
  if (!comments.length) {
    list.innerHTML = `<div style="opacity:.7;font-size:12px">No comments yet.</div>`;
    return;
  }

  const userIds = [...new Set(comments.map(c => c.user_id).filter(Boolean))];
  const profilesMap = await fetchProfilesMap(userIds);

  // fetch comment likes
  const commentIds = comments.map(c => c.id);
  const { data: likesRows } = await supabase
    .from("comment_likes")
    .select("comment_id, user_id")
    .in("comment_id", commentIds);

  const likeCount = new Map();
  const likedMine = new Set();
  for (const r of likesRows || []) {
    likeCount.set(r.comment_id, (likeCount.get(r.comment_id) || 0) + 1);
    if (r.user_id === currentUserId) likedMine.add(r.comment_id);
  }

  // build tree
  const roots = comments.filter(c => !c.parent_id);
  const children = new Map();
  for (const c of comments) {
    if (!c.parent_id) continue;
    children.set(c.parent_id, [...(children.get(c.parent_id) || []), c]);
  }

  function renderComment(c, isReply = false) {
    const name = profilesMap.get(c.user_id)?.full_name || "Member";
    const mine = c.user_id === currentUserId;
    const lc = likeCount.get(c.id) || 0;
    const lm = likedMine.has(c.id);

    const kids = children.get(c.id) || [];
    const kidsHtml = kids.map(k => `<div class="pv-reply">${renderComment(k, true)}</div>`).join("");

    return `
      <div class="pv-comment" data-comment-id="${escapeHtml(c.id)}" data-is-reply="${isReply ? "1" : "0"}">
        <div><b>${escapeHtml(name)}</b> ${escapeHtml(c.content)} <span style="opacity:.6;font-size:12px">• ${escapeHtml(timeAgo(c.created_at))}</span></div>
        <div class="pv-comment-actions">
          <button class="pv-mini" data-action="like-comment">${lm ? "❤️" : "🤍"} (${lc})</button>
          <button class="pv-mini" data-action="reply-comment">Reply</button>
          ${mine ? `<button class="pv-mini" data-action="delete-comment">Delete</button>` : ""}
        </div>
        ${kidsHtml}
      </div>
    `;
  }

  list.innerHTML = roots.map(c => renderComment(c, false)).join("");
}

async function sendComment(postEl) {
  const postId = postEl.dataset.postId;
  const input = postEl.querySelector(".pv-comment-input");
  const replyingEl = postEl.querySelector(".pv-replying");
  const text = (input?.value || "").trim();
  if (!text) return;

  const parentId = replyState.get(postId) || null;

  const { error } = await supabase.from("post_comments").insert({
    post_id: postId,
    content: text,
    parent_id: parentId
  });

  if (error) return toast("Comment failed");

  input.value = "";
  replyState.delete(postId);
  if (replyingEl) replyingEl.hidden = true;

  // update count quickly
  const countEl = postEl.querySelector("[data-comment-count]");
  const current = Number((countEl?.textContent || "0").replace(/[^\d]/g, "")) || 0;
  if (countEl) countEl.textContent = `(${current + 1})`;

  await loadComments(postEl);
  toast("Commented");
}

async function deleteComment(postEl, commentId) {
  const { error } = await supabase
    .from("post_comments")
    .delete()
    .eq("id", commentId)
    .eq("user_id", currentUserId);

  if (error) return toast("Delete failed");
  toast("Deleted");
  await loadComments(postEl);
}

async function toggleCommentLike(postEl, commentId, btn) {
  const liked = btn.textContent.includes("❤️");

  if (!liked) {
    const { error } = await supabase.from("comment_likes").insert({ comment_id: commentId });
    if (error) return toast("Like failed");
  } else {
    const { error } = await supabase
      .from("comment_likes")
      .delete()
      .eq("comment_id", commentId)
      .eq("user_id", currentUserId);
    if (error) return toast("Unlike failed");
  }

  await loadComments(postEl);
}

/* ---------- Share ---------- */
async function sharePost(postId) {
  const url = `${location.origin}/feed/?post=${encodeURIComponent(postId)}`;
  // Try native share first
  if (navigator.share) {
    try { await navigator.share({ title: "Pepsval Post", url }); return; } catch {}
  }
  // Fallback copy
  try { await navigator.clipboard.writeText(url); toast("Link copied"); }
  catch { prompt("Copy this link:", url); }
}

/* ---------- Delete Post ---------- */
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

/* ---------- Events ---------- */
document.addEventListener("DOMContentLoaded", async () => {
  injectStyles();
  await initAuth();

  if (elFileBtn && elPostFile) {
    elFileBtn.addEventListener("click", () => elPostFile.click());
    elPostFile.addEventListener("change", () => {
      const f = elPostFile.files?.[0];
      if (!f) return;
      setHint(`Selected: ${f.name}`);
    });
  }

  if (elPostBtn) elPostBtn.addEventListener("click", createPost);

  elList.addEventListener("click", async (e) => {
    const btn = e.target.closest("button");
    if (!btn) return;

    const postEl = e.target.closest(".pv-post");
    if (!postEl) return;

    const action = btn.dataset.action;
    const postId = postEl.dataset.postId;

    if (action === "like-post") return togglePostLike(postEl);
    if (action === "toggle-comments") {
      const box = postEl.querySelector(".pv-comments");
      if (!box) return;
      if (!box.hidden) { box.hidden = true; return; }
      return loadComments(postEl);
    }
    if (action === "send-comment") return sendComment(postEl);
    if (action === "cancel-reply") {
      replyState.delete(postId);
      const replyingEl = postEl.querySelector(".pv-replying");
      if (replyingEl) replyingEl.hidden = true;
      const input = postEl.querySelector(".pv-comment-input");
      if (input) input.placeholder = "Write a comment…";
      return;
    }
    if (action === "share-post") return sharePost(postId);
    if (action === "delete-post") return deletePost(postId);

    // comment-level actions
    const commentEl = e.target.closest(".pv-comment");
    const commentId = commentEl?.dataset?.commentId;

    if (action === "reply-comment" && commentId) {
      replyState.set(postId, commentId);
      const replyingEl = postEl.querySelector(".pv-replying");
      if (replyingEl) replyingEl.hidden = false;
      const input = postEl.querySelector(".pv-comment-input");
      if (input) {
        input.placeholder = "Write a reply…";
        input.focus();
      }
      return;
    }

    if (action === "delete-comment" && commentId) return deleteComment(postEl, commentId);
    if (action === "like-comment" && commentId) return toggleCommentLike(postEl, commentId, btn);
  });

  await loadFeed();
});