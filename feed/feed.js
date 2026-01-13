import { supabase } from "/js/supabaseClient.js";

const MEDIA_BUCKET = "post_media";

/* Elements */
const elStatus = document.getElementById("feedStatus");
const elList = document.getElementById("feedList");

const elPostText = document.getElementById("postText");
const elPostBtn = document.getElementById("postBtn");
const elPostFile = document.getElementById("postFile");
const elFileBtn = document.getElementById("fileBtn");

const elFileInfo = document.getElementById("fileInfo");
const elFileName = document.getElementById("fileName");
const elClearFile = document.getElementById("clearFile");

const elProgressWrap = document.getElementById("progressWrap");
const elProgressFill = document.getElementById("progressFill");
const elProgressPct = document.getElementById("progressPct");
const elProgressLabel = document.getElementById("progressLabel");

const elToast = document.getElementById("toast");

const elMeAvatarBtn = document.getElementById("meAvatarBtn");
const elMeMenu = document.getElementById("meMenu");
const elMenuProfile = document.getElementById("menuProfile");
const elMenuLogout = document.getElementById("menuLogout");

const elSearchInput = document.getElementById("searchInput");
const elSearchDrop = document.getElementById("searchDrop");

/* Helpers */
function setStatus(t) { if (elStatus) elStatus.textContent = t || ""; }
function toast(text = "Done") {
  if (!elToast) return;
  elToast.textContent = text;
  elToast.classList.add("show");
  setTimeout(() => elToast.classList.remove("show"), 1100);
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
function setBusy(btn, busy) {
  if (!btn) return;
  btn.style.opacity = busy ? "0.55" : "1";
  btn.style.pointerEvents = busy ? "none" : "auto";
  btn.dataset.busy = busy ? "1" : "0";
}

/* Styles injected for posts/comments only */
function injectStyles() {
  const style = document.createElement("style");
  style.textContent = `
    .pv-post{padding:14px;border-radius:18px;background:rgba(255,255,255,.96);border:1px solid rgba(0,0,0,.06);margin:12px 0}
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
    .pv-reply{margin-left:14px;border-left:2px solid rgba(31,111,134,.2);padding-left:10px;margin-top:8px}
    .pv-loading-inline{display:inline-flex;align-items:center;gap:6px}
    .pv-dot{width:6px;height:6px;border-radius:999px;background:rgba(15,23,42,.55);animation: pvB 1s infinite}
    .pv-dot:nth-child(2){animation-delay:.15s}
    .pv-dot:nth-child(3){animation-delay:.3s}
    @keyframes pvB{0%,100%{transform:translateY(0);opacity:.4}50%{transform:translateY(-2px);opacity:1}}
  `;
  document.head.appendChild(style);
}
function inlineSpinner() {
  return `<span class="pv-loading-inline"><span class="pv-dot"></span><span class="pv-dot"></span><span class="pv-dot"></span></span>`;
}

/* Auth + profile */
let currentUserId = null;
let myProfileCache = null;

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
  if (!elMeAvatarBtn) return;
  const name = profile?.full_name || "Pepsval Member";
  const url = (profile?.avatar_url || "").trim();
  if (url) elMeAvatarBtn.innerHTML = `<img src="${escapeHtml(url)}" alt="${escapeHtml(name)}" />`;
  else elMeAvatarBtn.textContent = (name.trim()[0] || "P").toUpperCase();
}

/* Data helpers */
async function fetchProfilesMap(userIds) {
  if (!userIds?.length) return new Map();
  const { data } = await supabase
    .from("profiles")
    .select("id, full_name, avatar_url, rank, company")
    .in("id", userIds);
  const map = new Map();
  for (const p of data || []) map.set(p.id, p);
  return map;
}

function avatarFallback(name = "") {
  const letter = (name.trim()[0] || "P").toUpperCase();
  return `<div class="pv-avatar-fallback">${escapeHtml(letter)}</div>`;
}

/* Render post */
function renderPost(post, profile, likeCount, likedByMe, commentCount) {
  const name = profile?.full_name || "Pepsval Member";
  const rank = profile?.rank || "";
  const company = profile?.company || "";
  const avatarUrl = (profile?.avatar_url || "").trim();
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
        ${isMine ? `<button class="pv-mini" type="button" data-action="delete-post">Delete</button>` : ""}
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

      <section class="pv-comments" hidden data-loaded="0">
        <div class="pv-comments-list"></div>
        <div class="pv-comments-box">
          <input class="pv-comment-input" type="text" placeholder="Write a comment…" maxlength="300" />
          <button class="pv-mini" type="button" data-action="send-comment">Send</button>
        </div>
      </section>
    </article>
  `;
}

/* Upload */
async function uploadMedia(file) {
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

/* Create post */
async function createPost() {
  await initAuth();
  if (!currentUserId) return toast("Please login");

  const text = (elPostText?.value || "").trim();
  const file = elPostFile?.files?.[0] || null;
  if (!text && !file) return toast("Write something");

  elPostBtn.disabled = true;

  try {
    let image_url = null, video_url = null;
    if (file) {
      const url = await uploadMedia(file);
      if ((file.type || "").startsWith("video/")) video_url = url;
      else image_url = url;
    }

    const { error } = await supabase.from("posts").insert({
      content: text || null,
      image_url,
      video_url
    });

    if (error) throw new Error(error.message);

    elPostText.value = "";
    clearSelectedFileUI();
    toast("Posted");
    await loadFeed();
  } catch {
    toast("Post failed");
  } finally {
    elPostBtn.disabled = false;
  }
}

/* Feed loading */
async function loadFeed() {
  setStatus("Loading…");
  await initAuth();

  if (!currentUserId) {
    setStatus("Login required");
    elList.innerHTML = "";
    elPostBtn.disabled = true;
    return;
  }

  elPostBtn.disabled = false;

  myProfileCache = await getMyProfile();
  setTopAvatar(myProfileCache);

  const { data: posts, error } = await supabase
    .from("posts")
    .select("id, user_id, content, image_url, video_url, created_at")
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    setStatus("Feed error");
    elList.innerHTML = `<div style="padding:12px">Feed failed.</div>`;
    return;
  }

  const list = posts || [];
  if (!list.length) {
    setStatus("");
    elList.innerHTML = `<div style="padding:12px;opacity:.7">No posts yet.</div>`;
    return;
  }

  const postIds = list.map(p => p.id);
  const userIds = [...new Set(list.map(p => p.user_id).filter(Boolean))];

  const [profilesMap, likesRows, commentsRows] = await Promise.all([
    fetchProfilesMap(userIds),
    supabase.from("post_likes").select("post_id, user_id").in("post_id", postIds),
    supabase.from("post_comments").select("post_id").in("post_id", postIds)
  ]);

  const likeCounts = new Map();
  const likedMine = new Set();
  for (const r of likesRows.data || []) {
    likeCounts.set(r.post_id, (likeCounts.get(r.post_id) || 0) + 1);
    if (r.user_id === currentUserId) likedMine.add(r.post_id);
  }

  const commentCounts = new Map();
  for (const r of commentsRows.data || []) {
    commentCounts.set(r.post_id, (commentCounts.get(r.post_id) || 0) + 1);
  }

  setStatus("");

  elList.innerHTML = list.map(p => {
    return renderPost(
      p,
      profilesMap.get(p.user_id),
      likeCounts.get(p.id) || 0,
      likedMine.has(p.id),
      commentCounts.get(p.id) || 0
    );
  }).join("");
}

/* Comments (load once only; after that update DOM only) */
const replyState = new Map(); // postId -> parentCommentId

async function ensureCommentsLoaded(postEl) {
  const box = postEl.querySelector(".pv-comments");
  const list = postEl.querySelector(".pv-comments-list");
  if (!box || !list) return;

  if (box.dataset.loaded === "1") return;

  list.innerHTML = `<div style="opacity:.7;font-size:12px">Loading…</div>`;

  const postId = postEl.dataset.postId;

  const { data: comments, error } = await supabase
    .from("post_comments")
    .select("id, post_id, user_id, content, created_at, parent_id")
    .eq("post_id", postId)
    .order("created_at", { ascending: true })
    .limit(200);

  if (error) {
    list.innerHTML = `<div style="opacity:.7;font-size:12px">Could not load.</div>`;
    return;
  }

  const rows = comments || [];
  if (!rows.length) {
    list.innerHTML = `<div style="opacity:.7;font-size:12px">No comments yet.</div>`;
    box.dataset.loaded = "1";
    return;
  }

  const userIds = [...new Set(rows.map(c => c.user_id).filter(Boolean))];
  const profilesMap = await fetchProfilesMap(userIds);

  const renderOne = (c) => {
    const name = profilesMap.get(c.user_id)?.full_name || "Member";
    const mine = c.user_id === currentUserId;
    const isReply = !!c.parent_id;
    return `
      <div class="pv-comment ${isReply ? "pv-reply" : ""}" data-comment-id="${escapeHtml(c.id)}" data-liked="0">
        <div><b>${escapeHtml(name)}</b> ${escapeHtml(c.content)}
          <span style="opacity:.6;font-size:12px">• ${escapeHtml(timeAgo(c.created_at))}</span>
        </div>
        <div class="pv-comment-actions">
          <button class="pv-mini" type="button" data-action="like-comment">🤍 <span data-c-like>(0)</span></button>
          <button class="pv-mini" type="button" data-action="reply-comment">Reply</button>
          ${mine ? `<button class="pv-mini" type="button" data-action="delete-comment">Delete</button>` : ""}
        </div>
      </div>
    `;
  };

  // We insert flat; replies will be appended under parent later
  list.innerHTML = rows.map(renderOne).join("");
  box.dataset.loaded = "1";
}

/* Like post (no refresh) */
async function togglePostLike(postEl, btn) {
  if (btn?.dataset?.busy === "1") return;

  const postId = postEl.dataset.postId;
  const liked = postEl.dataset.liked === "1";
  const countEl = postEl.querySelector("[data-like-count]");
  const heartEl = postEl.querySelector(".pv-heart");
  const currentCount = Number((countEl?.textContent || "0").replace(/[^\d]/g, "")) || 0;

  // optimistic
  postEl.dataset.liked = liked ? "0" : "1";
  if (heartEl) heartEl.textContent = liked ? "🤍" : "❤️";
  if (countEl) countEl.textContent = `(${liked ? Math.max(0, currentCount - 1) : currentCount + 1})`;

  const oldText = btn.innerHTML;
  btn.innerHTML = `${oldText} ${inlineSpinner()}`;
  setBusy(btn, true);

  try {
    if (!liked) {
      const { error } = await supabase.from("post_likes").insert({ post_id: postId });
      if (error) throw error;
    } else {
      const { error } = await supabase.from("post_likes")
        .delete()
        .eq("post_id", postId)
        .eq("user_id", currentUserId);
      if (error) throw error;
    }
  } catch {
    // revert
    postEl.dataset.liked = liked ? "1" : "0";
    if (heartEl) heartEl.textContent = liked ? "❤️" : "🤍";
    if (countEl) countEl.textContent = `(${currentCount})`;
    toast("Like failed");
  } finally {
    btn.innerHTML = oldText;
    setBusy(btn, false);
  }
}

/* Send comment/reply WITHOUT reloading list (smooth) */
function buildCommentHtml({ id, userName, text, created_at, mine, isReply }) {
  return `
    <div class="pv-comment ${isReply ? "pv-reply" : ""}" data-comment-id="${escapeHtml(id)}" data-liked="0">
      <div><b>${escapeHtml(userName)}</b> ${escapeHtml(text)}
        <span style="opacity:.6;font-size:12px">• ${escapeHtml(timeAgo(created_at))}</span>
      </div>
      <div class="pv-comment-actions">
        <button class="pv-mini" type="button" data-action="like-comment">🤍 <span data-c-like>(0)</span></button>
        <button class="pv-mini" type="button" data-action="reply-comment">Reply</button>
        ${mine ? `<button class="pv-mini" type="button" data-action="delete-comment">Delete</button>` : ""}
      </div>
    </div>
  `;
}

async function sendComment(postEl, btn) {
  if (btn?.dataset?.busy === "1") return;

  const postId = postEl.dataset.postId;
  const input = postEl.querySelector(".pv-comment-input");
  const list = postEl.querySelector(".pv-comments-list");
  const text = (input?.value || "").trim();
  if (!text) return;

  const parentId = replyState.get(postId) || null;

  const oldText = btn.innerHTML;
  btn.innerHTML = `${oldText} ${inlineSpinner()}`;
  setBusy(btn, true);

  try {
    const { data, error } = await supabase
      .from("post_comments")
      .insert({ post_id: postId, content: text, parent_id: parentId })
      .select("id, user_id, content, created_at, parent_id")
      .single();

    if (error) throw error;

    // Update count instantly
    const countEl = postEl.querySelector("[data-comment-count]");
    const cur = Number((countEl?.textContent || "0").replace(/[^\d]/g, "")) || 0;
    if (countEl) countEl.textContent = `(${cur + 1})`;

    // Insert into DOM instantly (no reload)
    const myName = myProfileCache?.full_name || "You";
    const html = buildCommentHtml({
      id: data.id,
      userName: myName,
      text: data.content,
      created_at: data.created_at,
      mine: true,
      isReply: !!data.parent_id
    });

    if (!parentId) {
      // root comment: append at end
      list.insertAdjacentHTML("beforeend", html);
    } else {
      // reply: insert after parent comment
      const parentEl = list.querySelector(`[data-comment-id="${CSS.escape(parentId)}"]`);
      if (parentEl) parentEl.insertAdjacentHTML("beforeend", html);
      else list.insertAdjacentHTML("beforeend", html); // fallback
      replyState.delete(postId);
      if (input) input.placeholder = "Write a comment…";
    }

    input.value = "";
    toast("Saved");
  } catch {
    toast("Comment failed");
  } finally {
    btn.innerHTML = oldText;
    setBusy(btn, false);
  }
}

/* Like comment WITHOUT reloading list */
async function toggleCommentLike(btn) {
  if (btn?.dataset?.busy === "1") return;

  const commentEl = btn.closest(".pv-comment");
  const commentId = commentEl?.dataset?.commentId;
  if (!commentId) return;

  const liked = commentEl.dataset.liked === "1";
  const countSpan = btn.querySelector("[data-c-like]");
  const cur = Number((countSpan?.textContent || "0").replace(/[^\d]/g, "")) || 0;

  // optimistic
  commentEl.dataset.liked = liked ? "0" : "1";
  btn.innerHTML = `${liked ? "🤍" : "❤️"} <span data-c-like>(${liked ? Math.max(0, cur - 1) : cur + 1})</span>`;

  const oldHtml = btn.innerHTML;
  btn.innerHTML = `${oldHtml} ${inlineSpinner()}`;
  setBusy(btn, true);

  try {
    if (!liked) {
      const { error } = await supabase.from("comment_likes").insert({ comment_id: commentId });
      if (error) throw error;
    } else {
      const { error } = await supabase.from("comment_likes")
        .delete()
        .eq("comment_id", commentId)
        .eq("user_id", currentUserId);
      if (error) throw error;
    }
  } catch {
    // revert
    commentEl.dataset.liked = liked ? "1" : "0";
    btn.innerHTML = `${liked ? "❤️" : "🤍"} <span data-c-like>(${cur})</span>`;
    toast("Failed");
  } finally {
    setBusy(btn, false);
  }
}

/* Reply mode (no refresh) */
function setReplyMode(postEl, commentId) {
  const postId = postEl.dataset.postId;
  const input = postEl.querySelector(".pv-comment-input");
  replyState.set(postId, commentId);
  if (input) {
    input.placeholder = "Write a reply…";
    input.focus();
  }
}

/* Delete post */
async function deletePost(postId) {
  if (!confirm("Delete this post?")) return;
  const { error } = await supabase.from("posts")
    .delete()
    .eq("id", postId)
    .eq("user_id", currentUserId);
  if (error) return toast("Delete failed");
  toast("Deleted");
  await loadFeed();
}

/* Share */
async function sharePost(postId) {
  const url = `${location.origin}/feed/?post=${encodeURIComponent(postId)}`;
  if (navigator.share) {
    try { await navigator.share({ title: "Pepsval Post", url }); return; } catch {}
  }
  try { await navigator.clipboard.writeText(url); toast("Link copied"); }
  catch { prompt("Copy this link:", url); }
}

/* Avatar menu */
function toggleMenu(show) {
  if (!elMeMenu) return;
  elMeMenu.style.display = show ? "block" : "none";
}
function isMenuOpen() {
  return elMeMenu && elMeMenu.style.display === "block";
}
function closeMenuOnOutside(e) {
  if (!elMeMenu || !elMeAvatarBtn) return;
  if (elMeMenu.contains(e.target) || elMeAvatarBtn.contains(e.target)) return;
  toggleMenu(false);
}

/* Search */
let searchTimer = null;

function showSearchDrop(show) {
  if (!elSearchDrop) return;
  elSearchDrop.style.display = show ? "block" : "none";
}
function clearSearchDrop() {
  if (!elSearchDrop) return;
  elSearchDrop.innerHTML = "";
  showSearchDrop(false);
}

async function runSearch(q) {
  const query = (q || "").trim();
  if (!query || query.length < 2) return clearSearchDrop();

  // Show immediate "Searching..." so user sees it works
  elSearchDrop.innerHTML = `<div style="padding:10px 12px;opacity:.7;font-size:13px">Searching…</div>`;
  showSearchDrop(true);

  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name, avatar_url, rank, company")
    .or(`full_name.ilike.%${query}%,company.ilike.%${query}%,rank.ilike.%${query}%`)
    .limit(8);

  if (error) {
    elSearchDrop.innerHTML = `<div style="padding:10px 12px;opacity:.7;font-size:13px">Search failed</div>`;
    showSearchDrop(true);
    return;
  }

  const rows = data || [];
  if (!rows.length) {
    elSearchDrop.innerHTML = `<div style="padding:10px 12px;opacity:.7;font-size:13px">No results</div>`;
    showSearchDrop(true);
    return;
  }

  elSearchDrop.innerHTML = rows.map(p => {
    const name = p.full_name || "Member";
    const meta = [p.rank, p.company].filter(Boolean).join(" • ");
    const av = (p.avatar_url || "").trim();
    return `
      <div class="searchItem" data-id="${escapeHtml(p.id)}">
        <div class="sAvatar">${av ? `<img src="${escapeHtml(av)}" alt="${escapeHtml(name)}" />` : escapeHtml((name[0]||"P").toUpperCase())}</div>
        <div class="sText">
          <div class="sName">${escapeHtml(name)}</div>
          <div class="sMeta">${escapeHtml(meta)}</div>
        </div>
      </div>
    `;
  }).join("");

  showSearchDrop(true);
}

function wireSearchClicks() {
  if (!elSearchDrop) return;
  elSearchDrop.addEventListener("mousedown", (e) => {
    // prevent blur clearing before click (mobile/desktop)
    e.preventDefault();
  });

  elSearchDrop.addEventListener("click", (e) => {
    const item = e.target.closest(".searchItem");
    if (!item) return;
    const id = item.dataset.id;
    clearSearchDrop();
    elSearchInput.blur();
    window.location.href = `/profile/user.html?id=${encodeURIComponent(id)}`;
  });
}

/* File attached UI */
function humanSize(bytes) {
  const b = Number(bytes || 0);
  if (b < 1024) return `${b} B`;
  const kb = b / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  const mb = kb / 1024;
  return `${mb.toFixed(1)} MB`;
}
function updateSelectedFileUI() {
  const file = elPostFile?.files?.[0] || null;
  if (!file) return clearSelectedFileUI();
  if (elFileInfo) elFileInfo.style.display = "flex";
  if (elFileName) elFileName.textContent = `${file.name} • ${humanSize(file.size)}`;
}
function clearSelectedFileUI() {
  if (elPostFile) elPostFile.value = "";
  if (elFileInfo) elFileInfo.style.display = "none";
  if (elFileName) elFileName.textContent = "";
}

/* Main */
document.addEventListener("DOMContentLoaded", async () => {
  injectStyles();
  await initAuth();

  // File picker
  if (elFileBtn && elPostFile) {
    elFileBtn.addEventListener("click", () => elPostFile.click());
    elPostFile.addEventListener("change", updateSelectedFileUI);
  }
  if (elClearFile) elClearFile.addEventListener("click", clearSelectedFileUI);

  // Post
  if (elPostBtn) elPostBtn.addEventListener("click", createPost);

  // Avatar menu (add touchstart too for mobile)
  const openCloseMenu = (e) => {
    e.preventDefault();
    e.stopPropagation();
    toggleMenu(!isMenuOpen());
  };
  if (elMeAvatarBtn) {
    elMeAvatarBtn.addEventListener("click", openCloseMenu);
    elMeAvatarBtn.addEventListener("touchstart", openCloseMenu, { passive: false });
  }
  document.addEventListener("click", closeMenuOnOutside);

  if (elMenuProfile) elMenuProfile.addEventListener("click", () => window.location.href = "/profile/home.html");
  if (elMenuLogout) elMenuLogout.addEventListener("click", async () => {
    await supabase.auth.signOut();
    window.location.href = "/auth/login.html";
  });

  // Search
  wireSearchClicks();

  if (elSearchInput) {
    // prevent Enter from moving focus to post textbox
    elSearchInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        e.stopPropagation();
        runSearch(elSearchInput.value);
      }
    });

    elSearchInput.addEventListener("input", () => {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(() => runSearch(elSearchInput.value), 220);
    });

    // keep dropdown while interacting
    elSearchInput.addEventListener("blur", () => setTimeout(clearSearchDrop, 250));
    elSearchInput.addEventListener("focus", () => {
      if (elSearchDrop.innerHTML.trim()) showSearchDrop(true);
    });
  }

  // Click actions inside posts
  elList.addEventListener("click", async (e) => {
    const btn = e.target.closest("button");
    if (!btn) return;

    const postEl = e.target.closest(".pv-post");
    const action = btn.dataset.action;

    if (action === "like-post" && postEl) return togglePostLike(postEl, btn);

    if (action === "toggle-comments" && postEl) {
      const box = postEl.querySelector(".pv-comments");
      if (!box) return;
      if (!box.hidden) { box.hidden = true; return; }
      box.hidden = false;
      await ensureCommentsLoaded(postEl);
      return;
    }

    if (action === "send-comment" && postEl) return sendComment(postEl, btn);

    if (action === "like-comment") return toggleCommentLike(btn);

    if (action === "reply-comment" && postEl) {
      const commentEl = e.target.closest(".pv-comment");
      const commentId = commentEl?.dataset?.commentId;
      if (commentId) return setReplyMode(postEl, commentId);
    }

    if (action === "share-post" && postEl) return sharePost(postEl.dataset.postId);

    if (action === "delete-post" && postEl) return deletePost(postEl.dataset.postId);
  });

  await loadFeed();
});