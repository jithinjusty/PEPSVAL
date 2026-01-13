// /feed/feed.js
import { supabase } from "/js/supabaseClient.js";

const elStatus = document.getElementById("feedStatus");
const elList = document.getElementById("feedList");

function setStatus(text) {
  if (elStatus) elStatus.textContent = text || "";
}

function escapeHtml(str = "") {
  return str
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
  return `
    <div class="pv-avatar-fallback" aria-hidden="true">${escapeHtml(letter)}</div>
  `;
}

function renderPost(post, profile) {
  const name = profile?.full_name || "Pepsval Member";
  const rank = profile?.rank || "";
  const company = profile?.company || "";
  const avatarUrl = profile?.avatar_url || "";

  const headerMeta = [rank, company].filter(Boolean).join(" • ");
  const created = post?.created_at ? timeAgo(post.created_at) : "";

  const content = (post?.content || "").trim();
  const imageUrl = (post?.image_url || "").trim();
  const videoUrl = (post?.video_url || "").trim();

  const media = videoUrl
    ? `<video class="pv-media" controls preload="metadata" src="${escapeHtml(videoUrl)}"></video>`
    : imageUrl
      ? `<img class="pv-media" src="${escapeHtml(imageUrl)}" alt="Post media" loading="lazy" />`
      : "";

  return `
    <article class="pv-post">
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
      </header>

      ${content ? `<div class="pv-content">${escapeHtml(content).replaceAll("\n", "<br/>")}</div>` : ""}

      ${media}

      <footer class="pv-post-ft">
        <button class="pv-btn" type="button" disabled title="Coming soon">❤️ Like</button>
        <button class="pv-btn" type="button" disabled title="Coming soon">💬 Comment</button>
        <button class="pv-btn" type="button" disabled title="Coming soon">↗️ Share</button>
      </footer>
    </article>
  `;
}

async function fetchProfilesMap(userIds) {
  // If you DON'T have a foreign key relationship set up,
  // this will still work by fetching profiles separately.
  if (!userIds || userIds.length === 0) return new Map();

  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name, avatar_url, rank, company")
    .in("id", userIds);

  if (error) {
    console.warn("Profiles fetch failed:", error.message);
    return new Map();
  }

  const map = new Map();
  for (const p of data || []) map.set(p.id, p);
  return map;
}

async function loadFeed() {
  if (!elList) {
    console.error("feedList element not found in /feed/index.html");
    return;
  }

  setStatus("Loading feed…");

  // 1) Ensure session exists (optional — if your app allows viewing feed only after login)
  const { data: authData, error: authErr } = await supabase.auth.getUser();
  if (authErr) {
    setStatus("Not logged in. Please login again.");
    elList.innerHTML = "";
    return;
  }
  // authData.user can be null if logged out
  // If you want feed public, remove this check.
  if (!authData?.user) {
    setStatus("Please login to view the feed.");
    elList.innerHTML = "";
    return;
  }

  // 2) Fetch posts
  const { data: posts, error } = await supabase
    .from("posts")
    .select("id, user_id, content, image_url, video_url, created_at")
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    console.error("Feed load error:", error.message);
    setStatus("Could not load feed (database error).");
    elList.innerHTML = `
      <div class="pv-error">
        <div><b>Feed failed to load.</b></div>
        <div class="pv-small">${escapeHtml(error.message)}</div>
      </div>
    `;
    return;
  }

  if (!posts || posts.length === 0) {
    setStatus("");
    elList.innerHTML = `<div class="pv-empty">No posts yet.</div>`;
    return;
  }

  // 3) Fetch profiles for those users (safe even without FK relationship)
  const ids = [...new Set(posts.map(p => p.user_id).filter(Boolean))];
  const profilesMap = await fetchProfilesMap(ids);

  // 4) Render
  setStatus("");
  elList.innerHTML = posts
    .map(p => renderPost(p, profilesMap.get(p.user_id)))
    .join("");
}

document.addEventListener("DOMContentLoaded", () => {
  // Minimal styling injected (so you don’t need a new CSS file)
  const style = document.createElement("style");
  style.textContent = `
    .pv-error,.pv-empty{padding:14px;border-radius:14px;background:rgba(0,0,0,.04);font-size:14px}
    .pv-small{opacity:.7;margin-top:6px;font-size:12px}
    .pv-post{padding:14px;border-radius:18px;background:rgba(255,255,255,.75);border:1px solid rgba(0,0,0,.06);margin:12px 0;backdrop-filter: blur(6px)}
    .pv-post-hd{display:flex;gap:10px;align-items:center;margin-bottom:10px}
    .pv-avatar{width:40px;height:40px;border-radius:999px;overflow:hidden;background:rgba(0,0,0,.06);display:flex;align-items:center;justify-content:center;flex:0 0 auto}
    .pv-avatar img{width:100%;height:100%;object-fit:cover}
    .pv-avatar-fallback{font-weight:700;opacity:.8}
    .pv-hd-text{flex:1}
    .pv-name-row{display:flex;justify-content:space-between;gap:10px;align-items:center}
    .pv-name{font-weight:700}
    .pv-time{font-size:12px;opacity:.6}
    .pv-meta{font-size:12px;opacity:.65;margin-top:2px}
    .pv-content{font-size:14px;line-height:1.4;margin:8px 0 10px}
    .pv-media{width:100%;border-radius:16px;border:1px solid rgba(0,0,0,.06);max-height:520px;object-fit:cover}
    .pv-post-ft{display:flex;gap:10px;margin-top:10px}
    .pv-btn{border:1px solid rgba(0,0,0,.08);background:rgba(255,255,255,.8);padding:8px 10px;border-radius:999px;font-size:13px}
    .pv-btn:disabled{opacity:.55}
  `;
  document.head.appendChild(style);

  loadFeed();
});