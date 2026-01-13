import { supabase, getCurrentUser } from "/js/supabase.js";

const MEDIA_BUCKET = "post_media";

let me = null;
let selectedFile = null;
let cachedKeyset = null;

const elStatus = document.getElementById("feedStatus");
const elList = document.getElementById("feedList");

const elPostText = document.getElementById("postText");
const elPostBtn = document.getElementById("postBtn");
const elFileBtn = document.getElementById("fileBtn");
const elFile = document.getElementById("postFile");
const elFileInfo = document.getElementById("fileInfo");
const elFileName = document.getElementById("fileName");
const elClearFile = document.getElementById("clearFile");

const elProgressWrap = document.getElementById("progressWrap");
const elProgressFill = document.getElementById("progressFill");
const elProgressPct = document.getElementById("progressPct");
const elProgressLabel = document.getElementById("progressLabel");

const elMeAvatarBtn = document.getElementById("meAvatarBtn");
const elMeMenu = document.getElementById("meMenu");
const elMenuProfile = document.getElementById("menuProfile");
const elMenuSettings = document.getElementById("menuSettings");
const elMenuLogout = document.getElementById("menuLogout");

const elSearchInput = document.getElementById("searchInput");
const elSearchDrop = document.getElementById("searchDrop");

let searchTimer = null;

/* ---------------- UI helpers ---------------- */
function setStatus(msg) {
  if (!elStatus) return;
  elStatus.textContent = msg || "";
}
function toast(msg) {
  const el = document.getElementById("toast");
  if (!el) return alert(msg);
  el.textContent = msg;
  el.style.opacity = "1";
  el.style.transform = "translateY(0)";
  setTimeout(() => {
    el.style.opacity = "0";
    el.style.transform = "translateY(8px)";
  }, 2600);
}

function showFatal(err) {
  const msg = (err?.message || err || "").toString();
  console.error(err);
  setStatus(`❌ ${msg}`);
  toast(msg);
}

function showProgress(on, label = "", pct = 0) {
  if (!elProgressWrap) return;
  elProgressWrap.style.display = on ? "block" : "none";
  if (on) {
    if (elProgressLabel) elProgressLabel.textContent = label || "";
    if (elProgressFill) elProgressFill.style.width = `${pct}%`;
    if (elProgressPct) elProgressPct.textContent = `${pct}%`;
  }
}

function safeText(s) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function safeAttr(s) {
  return safeText(s).replaceAll("'", "&#039;");
}

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

/* Show ANY JS error directly on screen */
window.addEventListener("error", (e) => showFatal(e?.error || e?.message || "Script error"));
window.addEventListener("unhandledrejection", (e) => showFatal(e?.reason || "Unhandled promise rejection"));

/* ---------------- Auth ---------------- */
async function requireLogin() {
  me = await getCurrentUser();

  if (!me) {
    showFatal("Not logged in. Redirecting to login…");
    window.location.href = "/auth/login.html";
    return false;
  }
  return true;
}

/* ---------------- Key detection (robust) ---------------- */
function detectKeys(row) {
  const keys = row ? Object.keys(row) : [];
  const pick = (cands) => cands.find(k => keys.includes(k)) || null;
  return {
    idKey: pick(["id", "post_id"]),
    userKey: pick(["user_id", "author_id", "profile_id", "uid", "user"]),
    contentKey: pick(["content", "text", "body", "caption", "post_text", "message"]),
    mediaKey: pick(["media_url", "image_url", "image", "photo_url", "video_url", "media"]),
    createdKey: pick(["created_at", "created", "timestamp"])
  };
}

/* ---------------- Diagnostics ---------------- */
async function supabaseSelfTest() {
  setStatus("Checking database access…");

  const { data: sessionData, error: sessionErr } = await supabase.auth.getSession();
  if (sessionErr) throw sessionErr;
  if (!sessionData?.session) throw new Error("No Supabase session on this page (auth not loaded).");

  const t1 = await supabase.from("posts").select("*").limit(1);
  if (t1.error) throw new Error(`posts SELECT blocked: ${t1.error.message}`);

  const t2 = await supabase.from("post_comments").select("*").limit(1);
  if (t2.error) throw new Error(`post_comments SELECT blocked: ${t2.error.message}`);

  const t3 = await supabase.from("post_likes").select("*").limit(1);
  if (t3.error) throw new Error(`post_likes SELECT blocked: ${t3.error.message}`);

  // profiles select test (fallback safe)
  let t4 = await supabase.from("profiles").select("id, full_name, avatar_url, rank, country").limit(1);
  if (t4.error && /column .*country.* does not exist/i.test(t4.error.message)) {
    t4 = await supabase.from("profiles").select("id, full_name, avatar_url, rank").limit(1);
  }
  if (t4.error) throw new Error(`profiles SELECT blocked: ${t4.error.message}`);

  setStatus("");
}

/* ---------------- Fetchers ---------------- */
async function fetchPostsRaw() {
  let res = await supabase.from("posts").select("*").order("created_at", { ascending: false }).limit(50);
  if (res.error) res = await supabase.from("posts").select("*").order("id", { ascending: false }).limit(50);

  if (res.error) throw new Error(`Feed load failed: ${res.error.message}`);
  return res.data || [];
}

async function fetchProfilesMap(userIds) {
  if (!userIds.length) return new Map();

  // try with country, fallback without if column missing
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

async function fetchLikesForPosts(postIds) {
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
    if (me && l.user_id === me.id) mine.add(l.post_id);
  }

  return { counts, mine };
}

async function fetchCommentsForPosts(postIds) {
  const counts = new Map();
  const latest = new Map();
  if (!postIds.length) return { counts, latest };

  const { data, error } = await supabase
    .from("post_comments")
    .select("id, post_id, user_id, author_id, body, content, created_at")
    .in("post_id", postIds)
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) throw new Error(`Comments load failed: ${error.message}`);

  for (const c of (data || [])) {
    counts.set(c.post_id, (counts.get(c.post_id) || 0) + 1);
    const arr = latest.get(c.post_id) || [];
    if (arr.length < 20) arr.push(c);
    latest.set(c.post_id, arr);
  }

  return { counts, latest };
}

/* ---------------- Rendering ---------------- */
function renderPosts(rows, profMap, likeInfo, commentInfo, keyset) {
  if (!elList) return;

  if (!rows.length) {
    elList.innerHTML = `<div style="opacity:.7;font-size:13px;padding:14px;">No posts yet</div>`;
    return;
  }

  elList.innerHTML = rows.map((r) => {
    const pid = keyset.idKey ? r[keyset.idKey] : "";
    const uid = keyset.userKey ? r[keyset.userKey] : null;
    const prof = uid ? (profMap.get(uid) || {}) : {};

    const name = prof.full_name || "Seafarer";
    const avatar = prof.avatar_url || "";
    const rank = prof.rank ? ` • ${safeText(prof.rank)}` : "";
    const country = prof.country ? ` • ${safeText(prof.country)}` : "";

    const content = keyset.contentKey ? (r[keyset.contentKey] || "") : "";
    const media = keyset.mediaKey ? (r[keyset.mediaKey] || null) : null;
    const created = keyset.createdKey ? r[keyset.createdKey] : null;

    const likes = likeInfo.counts.get(pid) || 0;
    const iLiked = likeInfo.mine.has(pid);
    const commentsCount = commentInfo.counts.get(pid) || 0;
    const comments = commentInfo.latest.get(pid) || [];

    const isMine = (me && (r.user_id === me.id || r.author_id === me.id));

    const mediaHtml = media ? `
      <div style="margin-top:10px;border-radius:14px;overflow:hidden;border:1px solid rgba(0,0,0,.08);background:#fff;">
        ${String(media).match(/\.(mp4|mov|webm)(\?|$)/i)
          ? `<video src="${safeAttr(media)}" controls style="width:100%;display:block"></video>`
          : `<img src="${safeAttr(media)}" alt="media" style="width:100%;display:block" />`}
      </div>` : "";

    const commentsHtml = comments.map(c => {
      const commenterId = c.user_id || c.author_id;
      const cp = commenterId ? (profMap.get(commenterId) || {}) : {};
      const cName = cp.full_name || "Seafarer";
      const cAvatar = cp.avatar_url || "";
      const mine = (me && commenterId === me.id);

      const text = (c.content || c.body || "");

      return `
        <div class="pv-commentRow">
          <div class="pv-commentAvatar">
            ${cAvatar ? `<img src="${safeAttr(cAvatar)}" alt="" />` : `<span>${safeText((cName||"S").slice(0,1))}</span>`}
          </div>
          <div class="pv-commentBody">
            <div class="pv-commentTop">
              <div class="pv-commentName">${safeText(cName)}</div>
              <div class="pv-commentMeta">${c.created_at ? new Date(c.created_at).toLocaleString() : ""}</div>
            </div>
            <div class="pv-commentText">${safeText(text)}</div>
          </div>
          ${mine ? `<button type="button" class="pv-linkBtn" data-action="deleteComment" data-comment-id="${safeAttr(c.id)}">Delete</button>` : ``}
        </div>
      `;
    }).join("");

    return `
      <article class="pv-post" data-post-id="${safeAttr(pid)}">
        <header class="pv-postHead">
          <div class="pv-user">
            <div class="pv-userAvatar">
              ${avatar ? `<img src="${safeAttr(avatar)}" alt="${safeAttr(name)}"/>` : `<span>${safeText(name.slice(0,1))}</span>`}
            </div>
            <div class="pv-userMeta">
              <div class="pv-userName">${safeText(name)}</div>
              <div class="pv-userSub">${safeText(rank)}${safeText(country)}</div>
            </div>
          </div>

          <div class="pv-postRight">
            <div class="pv-time">${created ? new Date(created).toLocaleString() : ""}</div>
            <div>
              ${isMine ? `<button class="pv-linkBtn" type="button" data-action="deletePost">Delete</button>` : ``}
            </div>
          </div>
        </header>

        <div class="pv-postText">${safeText(content)}</div>
        ${mediaHtml}

        <div class="pv-actions">
          <button class="pv-pillBtn" type="button" data-action="like">${iLiked ? "Unlike" : "Like"} (${likes})</button>
          <button class="pv-pillBtn" type="button" data-action="toggleComments">Comments (${commentsCount})</button>
        </div>

        <div class="pv-commentsWrap" data-comments-wrap style="display:none;">
          <div class="pv-commentsTitle">Comments</div>
          <div class="pv-commentsList">
            ${commentsHtml || `<div style="opacity:.7;font-size:13px;padding:8px 0;">No comments yet</div>`}
          </div>

          <div class="pv-commentComposer">
            <input data-comment-input placeholder="Write a comment…" />
            <button class="pv-btn" type="button" data-action="sendComment">Send</button>
          </div>
        </div>
      </article>
    `;
  }).join("");
}

/* ---------------- Mutations ---------------- */
async function uploadMedia(file) {
  if (!file) return null;

  const ext = (file.name.split(".").pop() || "bin").toLowerCase();
  const path = `${me.id}/${Date.now()}_${Math.random().toString(16).slice(2)}.${ext}`;

  let pct = 1;
  showProgress(true, "Uploading…", pct);
  const timer = setInterval(() => {
    pct = Math.min(95, pct + Math.ceil(Math.random() * 7));
    showProgress(true, "Uploading…", pct);
  }, 220);

  const { error } = await supabase.storage.from(MEDIA_BUCKET).upload(path, file, {
    cacheControl: "3600",
    upsert: false
  });

  clearInterval(timer);

  if (error) throw new Error(`Upload blocked: ${error.message}`);

  showProgress(true, "Finalizing…", 100);
  setTimeout(() => showProgress(false), 400);

  const { data } = supabase.storage.from(MEDIA_BUCKET).getPublicUrl(path);
  return data?.publicUrl || null;
}

async function insertPost(content, mediaUrl) {
  // Always write BOTH columns so all your mixed policies pass
  const authorName =
    me?.full_name ||
    me?.profile?.full_name ||
    me?.user_metadata?.full_name ||
    me?.user_metadata?.name ||
    null;

  const payload = {
    user_id: me.id,
    author_id: me.id,
    author_name: authorName,
    content: content || ""
  };

  if (mediaUrl) payload.media_url = mediaUrl;

  const { error } = await supabase.from("posts").insert([payload]);
  if (error) throw new Error(`Post blocked: ${error.message}`);
}

async function createPost() {
  if (!me) return;

  const content = (elPostText?.value || "").trim();
  if (!content && !selectedFile) return toast("Write something or add media");

  elPostBtn.disabled = true;
  setStatus("Posting…");

  try {
    if (!cachedKeyset) {
      const rows = await fetchPostsRaw();
      cachedKeyset = detectKeys(rows[0] || {});
    }

    let mediaUrl = null;
    if (selectedFile) mediaUrl = await uploadMedia(selectedFile);

    await insertPost(content, mediaUrl);

    if (elPostText) elPostText.value = "";
    setFileUI(null);

    await loadFeed();
    toast("Posted ✅");
    setStatus("");
  } catch (e) {
    showFatal(e);
  } finally {
    elPostBtn.disabled = false;
  }
}

async function deletePost(postId) {
  const { error } = await supabase.from("posts").delete().eq("id", postId);
  if (error) throw new Error(`Delete blocked: ${error.message}`);
  await loadFeed();
  toast("Deleted");
}

async function toggleLike(postId, liked) {
  if (liked) {
    const { error } = await supabase.from("post_likes").delete().eq("post_id", postId).eq("user_id", me.id);
    if (error) throw new Error(`Unlike blocked: ${error.message}`);
  } else {
    const { error } = await supabase.from("post_likes").insert([{ post_id: postId, user_id: me.id }]);
    if (error) throw new Error(`Like blocked: ${error.message}`);
  }
  await loadFeed();
}

async function sendComment(postId, inputEl) {
  const txt = (inputEl?.value || "").trim();
  if (!txt) return;

  // IMPORTANT: your table requires BOTH body + content, and your policies sometimes use author_id
  const payload = {
    post_id: postId,
    user_id: me.id,
    author_id: me.id,
    body: txt,
    content: txt
  };

  const { error } = await supabase.from("post_comments").insert([payload]);
  if (error) throw new Error(`Comment blocked: ${error.message}`);

  inputEl.value = "";
  await loadFeed();
}

async function deleteComment(commentId) {
  // Delete only by ID. Ownership is enforced by RLS.
  const { error } = await supabase.from("post_comments").delete().eq("id", commentId);
  if (error) throw new Error(`Delete comment blocked: ${error.message}`);
  await loadFeed();
  toast("Deleted");
}

/* ---------------- Search ---------------- */
async function runSearch(q) {
  const text = (q || "").trim();
  if (!text) {
    elSearchDrop.style.display = "none";
    elSearchDrop.innerHTML = "";
    return;
  }

  let res = await supabase
    .from("profiles")
    .select("id, full_name, avatar_url, rank, country")
    .ilike("full_name", `%${text}%`)
    .limit(10);

  if (res.error && /column .*country.* does not exist/i.test(res.error.message)) {
    res = await supabase
      .from("profiles")
      .select("id, full_name, avatar_url, rank")
      .ilike("full_name", `%${text}%`)
      .limit(10);
  }

  if (res.error) return showFatal(`Search blocked: ${res.error.message}`);

  const rows = res.data || [];
  if (!rows.length) {
    elSearchDrop.style.display = "none";
    elSearchDrop.innerHTML = "";
    return;
  }

  elSearchDrop.innerHTML = rows.map(r => `
    <div class="searchItem" data-uid="${safeAttr(r.id)}">
      <div class="sAv">
        ${r.avatar_url ? `<img src="${safeAttr(r.avatar_url)}" alt=""/>` : `<span>${safeText((r.full_name||"S").slice(0,1))}</span>`}
      </div>
      <div class="sMeta">
        <div class="sName">${safeText(r.full_name || "Seafarer")}</div>
        <div class="sSub">${safeText(r.rank || "")}${r.country ? " • " + safeText(r.country) : ""}</div>
      </div>
    </div>
  `).join("");

  elSearchDrop.style.display = "block";
}

/* ---------------- Main ---------------- */
async function loadFeed() {
  try {
    setStatus("Loading feed…");

    const rows = await fetchPostsRaw();
    cachedKeyset = detectKeys(rows[0] || {});

    const postIds = [];
    const userIds = [];

    for (const r of rows) {
      if (cachedKeyset.idKey && r[cachedKeyset.idKey]) postIds.push(r[cachedKeyset.idKey]);

      // include both potential owner keys so profile map is always complete
      if (r.user_id) userIds.push(r.user_id);
      if (r.author_id) userIds.push(r.author_id);
      if (cachedKeyset.userKey && r[cachedKeyset.userKey]) userIds.push(r[cachedKeyset.userKey]);
    }

    const likeInfo = await fetchLikesForPosts(postIds);
    const commentInfo = await fetchCommentsForPosts(postIds);

    // include commenter ids so we can show who commented
    for (const arr of commentInfo.latest.values()) {
      for (const c of arr) {
        if (c.user_id) userIds.push(c.user_id);
        if (c.author_id) userIds.push(c.author_id);
      }
    }

    const uniqueUsers = [...new Set(userIds.filter(Boolean))];
    const profMap = await fetchProfilesMap(uniqueUsers);

    renderPosts(rows, profMap, likeInfo, commentInfo, cachedKeyset);
    setStatus("");
  } catch (e) {
    showFatal(e);
  }
}

document.addEventListener("DOMContentLoaded", async () => {
  try {
    const ok = await requireLogin();
    if (!ok) return;

    await supabaseSelfTest();

    // Avatar menu
    if (elMeAvatarBtn && elMeMenu) {
      elMeAvatarBtn.addEventListener("click", (e) => {
        e.preventDefault();
        elMeMenu.style.display = (elMeMenu.style.display === "block" ? "none" : "block");
      });

      document.addEventListener("click", (e) => {
        if (!elMeMenu.contains(e.target) && !elMeAvatarBtn.contains(e.target)) {
          elMeMenu.style.display = "none";
        }
      });
    }

    if (elMenuProfile) elMenuProfile.addEventListener("click", () => (window.location.href = "/profile/home.html"));
    if (elMenuSettings) elMenuSettings.addEventListener("click", () => (window.location.href = "/dashboard/settings.html"));

    if (elMenuLogout) elMenuLogout.addEventListener("click", async () => {
      await supabase.auth.signOut();
      window.location.href = "/auth/login.html";
    });

    // File choose
    if (elFileBtn && elFile) elFileBtn.addEventListener("click", () => elFile.click());
    if (elFile) elFile.addEventListener("change", () => setFileUI(elFile.files?.[0] || null));
    if (elClearFile) elClearFile.addEventListener("click", () => setFileUI(null));

    // Post
    if (elPostBtn) elPostBtn.addEventListener("click", createPost);

    // Feed actions
    if (elList) {
      elList.addEventListener("click", async (e) => {
        const btn = e.target.closest("[data-action]");
        if (!btn) return;

        const postEl = e.target.closest("[data-post-id]");
        if (!postEl) return;

        const postId = postEl.getAttribute("data-post-id");
        const action = btn.getAttribute("data-action");

        try {
          if (action === "deletePost") return await deletePost(postId);
          if (action === "like") {
            const liked = btn.textContent.trim().toLowerCase().startsWith("unlike");
            return await toggleLike(postId, liked);
          }
          if (action === "toggleComments") {
            const wrap = postEl.querySelector("[data-comments-wrap]");
            if (wrap) wrap.style.display = (wrap.style.display === "none" ? "block" : "none");
            return;
          }
          if (action === "sendComment") {
            const input = postEl.querySelector("[data-comment-input]");
            return await sendComment(postId, input);
          }
          if (action === "deleteComment") {
            const cid = btn.getAttribute("data-comment-id");
            return await deleteComment(cid);
          }
        } catch (err) {
          showFatal(err);
        }
      });
    }

    // Search
    if (elSearchInput && elSearchDrop) {
      elSearchInput.addEventListener("input", () => {
        clearTimeout(searchTimer);
        searchTimer = setTimeout(() => runSearch(elSearchInput.value), 250);
      });

      elSearchDrop.addEventListener("click", (e) => {
        const item = e.target.closest(".searchItem");
        if (!item) return;
        const uid = item.getAttribute("data-uid");
        elSearchDrop.style.display = "none";
        elSearchInput.value = "";
        window.location.href = `/profile/user.html?uid=${encodeURIComponent(uid)}`;
      });

      document.addEventListener("click", (e) => {
        if (!elSearchDrop.contains(e.target) && !elSearchInput.contains(e.target)) {
          elSearchDrop.style.display = "none";
        }
      });
    }

    await loadFeed();
  } catch (e) {
    showFatal(e);
  }
});