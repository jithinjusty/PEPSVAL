/* =========================
   PEPSVAL — app.js (SPA)
   - GitHub Pages friendly (hash routing)
   - Supabase Auth (email + password)
   - Profiles (with unique username)
   - Feed posts (text + photo + video)
   - Storage bucket: post_media
   =========================

   REQUIREMENT in index.html:
   <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
   <script defer src="app.js"></script>
*/

const SUPABASE_URL = "https://czlmeehcxrslgfvqjfsb.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN6bG1lZWhjeHJzbGdmdnFqZnNiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc1MzU0NjgsImV4cCI6MjA4MzExMTQ2OH0.vHeIA2n6tm3F3IEoOPBsrIXQ1JXRlhe6bU4VP9b2lek";

const TAGLINE = "connect, hire and grow";
const POST_MEDIA_BUCKET = "post_media"; // ✅ your bucket

/* ------------------------------------------ */

if (!window.supabase) {
  alert("Supabase library not loaded. Add supabase-js CDN script in index.html.");
}
const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/* -------------------------
   Helpers
------------------------- */
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

const esc = (s) =>
  String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

function setHash(hash) {
  window.location.hash = hash;
}

function getRoute() {
  const raw = (window.location.hash || "#splash").slice(1);
  const [path, qs] = raw.split("?");
  const params = new URLSearchParams(qs || "");
  return { path: path || "splash", params };
}

function nowISO() {
  return new Date().toISOString();
}

function toast(msg, type = "info") {
  const host = $("#toastHost");
  if (!host) return;
  const t = document.createElement("div");
  t.className = `pv-toast ${type}`;
  t.textContent = msg;
  host.appendChild(t);
  requestAnimationFrame(() => t.classList.add("show"));
  setTimeout(() => {
    t.classList.remove("show");
    setTimeout(() => t.remove(), 250);
  }, 2600);
}

function statusMsg(msg = "", type = "info") {
  const el = $("#pvStatus");
  if (!el) return;
  el.textContent = msg;
  el.className = `pv-status ${type}`;
  el.style.display = msg ? "block" : "none";
}

/* -------------------------
   App State
------------------------- */
const state = {
  session: null,
  user: null,
  profile: null,
  tab: "feed", // feed | post | network | jobs | profile | messages
};

/* -------------------------
   Minimal styles (so it looks clean even if CSS is empty)
------------------------- */
function injectBaseStyles() {
  const css = `
  :root{
    --pv-bg:#0b1220;
    --pv-card:#0f1a2f;
    --pv-line:rgba(255,255,255,.08);
    --pv-text:#eaf1ff;
    --pv-muted:rgba(234,241,255,.65);
    --pv-accent:#1F6F86;
    --pv-accent2:#2aa8c6;
    --pv-danger:#ff5a67;
    --pv-ok:#35d08a;
    --pv-warn:#ffcc66;
    --pv-radius:18px;
    --pv-shadow: 0 12px 30px rgba(0,0,0,.35);
    font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif;
  }
  body{ margin:0; background:var(--pv-bg); color:var(--pv-text); }
  a{ color:var(--pv-accent2); text-decoration:none; }
  .pv-wrap{ min-height:100vh; display:flex; flex-direction:column; }
  .pv-topbar{
    position:sticky; top:0; z-index:5;
    display:flex; align-items:center; justify-content:space-between;
    padding:14px 14px; border-bottom:1px solid var(--pv-line);
    background:rgba(11,18,32,.85); backdrop-filter: blur(12px);
  }
  .pv-brand{ display:flex; gap:12px; align-items:center; }
  .pv-logo{ width:38px; height:38px; border-radius:12px; overflow:hidden; background:rgba(255,255,255,.06); display:grid; place-items:center; }
  .pv-logo img{ width:100%; height:100%; object-fit:cover; }
  .pv-brand h1{ font-size:14px; margin:0; letter-spacing:.14em; }
  .pv-brand .sub{ font-size:12px; color:var(--pv-muted); margin-top:2px; }
  .pv-actions{ display:flex; gap:10px; align-items:center; }
  .pv-btn{
    border:1px solid var(--pv-line);
    background:rgba(255,255,255,.04);
    color:var(--pv-text);
    padding:10px 12px;
    border-radius:14px;
    cursor:pointer;
    font-weight:600;
  }
  .pv-btn.primary{
    border-color: transparent;
    background: linear-gradient(135deg, var(--pv-accent), var(--pv-accent2));
  }
  .pv-btn.danger{ border-color: rgba(255,90,103,.35); color:#ffd2d6; }
  .pv-view{ flex:1; padding:16px; max-width:980px; width:100%; margin:0 auto; }
  .pv-card{
    background:var(--pv-card);
    border:1px solid var(--pv-line);
    border-radius:var(--pv-radius);
    box-shadow:var(--pv-shadow);
    padding:16px;
  }
  .pv-center{ min-height:70vh; display:grid; place-items:center; }
  .pv-title{ margin:0 0 10px; font-size:20px; }
  .pv-muted{ color:var(--pv-muted); font-size:13px; line-height:1.5; }
  .pv-field{ display:flex; flex-direction:column; gap:6px; margin:12px 0; }
  .pv-field label{ font-size:12px; color:var(--pv-muted); }
  .pv-input, .pv-select, .pv-textarea{
    border:1px solid var(--pv-line);
    background:rgba(255,255,255,.03);
    color:var(--pv-text);
    padding:12px 12px;
    border-radius:14px;
    outline:none;
  }
  .pv-textarea{ min-height:110px; resize:vertical; }
  .pv-row{ display:flex; gap:10px; align-items:center; flex-wrap:wrap; }
  .pv-status{
    display:none; margin:10px 0; padding:10px 12px; border-radius:14px;
    border:1px solid var(--pv-line);
    background:rgba(255,255,255,.04);
    font-size:13px;
  }
  .pv-status.error{ border-color: rgba(255,90,103,.45); }
  .pv-status.success{ border-color: rgba(53,208,138,.45); }
  .pv-status.warn{ border-color: rgba(255,204,102,.45); }
  .pv-splash{
    min-height:100vh; display:grid; place-items:center;
    background: radial-gradient(circle at 30% 10%, rgba(31,111,134,.28), transparent 55%),
                radial-gradient(circle at 70% 40%, rgba(42,168,198,.18), transparent 60%),
                var(--pv-bg);
  }
  .pv-splash-inner{ text-align:center; padding:20px; }
  .pv-splash-logo{
    width:84px; height:84px; border-radius:26px;
    background:rgba(255,255,255,.06);
    border:1px solid var(--pv-line);
    margin:0 auto 14px;
    display:grid; place-items:center;
    overflow:hidden;
  }
  .pv-splash-logo img{ width:100%; height:100%; object-fit:cover; }
  .pv-splash-name{ font-weight:800; letter-spacing:.22em; font-size:14px; }
  .pv-splash-tag{ margin-top:10px; color:var(--pv-muted); font-size:13px; }
  .pv-splash-bottom{ margin-top:24px; color:rgba(234,241,255,.45); font-size:12px; }
  .pv-tabs{
    position:sticky; bottom:0; z-index:5;
    display:flex; justify-content:space-between;
    padding:10px 10px;
    border-top:1px solid var(--pv-line);
    background:rgba(11,18,32,.9); backdrop-filter: blur(12px);
    max-width:980px; margin:0 auto;
  }
  .pv-tab{
    flex:1; text-align:center;
    padding:10px 6px; border-radius:14px; cursor:pointer;
    color:var(--pv-muted);
    font-weight:700; font-size:12px;
  }
  .pv-tab.active{ color:var(--pv-text); background:rgba(255,255,255,.05); }
  .pv-feed{ display:flex; flex-direction:column; gap:12px; }
  .pv-post{
    background:rgba(255,255,255,.03);
    border:1px solid var(--pv-line);
    border-radius:var(--pv-radius);
    padding:14px;
  }
  .pv-post-top{ display:flex; gap:10px; align-items:center; }
  .pv-avatar{
    width:38px; height:38px; border-radius:14px;
    background:rgba(255,255,255,.06);
    border:1px solid var(--pv-line);
    overflow:hidden;
    display:grid; place-items:center;
    font-weight:900;
  }
  .pv-avatar img{ width:100%; height:100%; object-fit:cover; }
  .pv-post-name{ font-weight:900; font-size:14px; }
  .pv-post-sub{ font-size:12px; color:var(--pv-muted); margin-top:2px; }
  .pv-post-body{ margin-top:10px; white-space:pre-wrap; line-height:1.5; }
  .pv-media{
    margin-top:10px;
    border-radius:16px;
    overflow:hidden;
    border:1px solid var(--pv-line);
    background:#000;
  }
  .pv-media img, .pv-media video{ width:100%; height:auto; display:block; }
  .pv-toast-host{
    position:fixed; z-index:99;
    left:50%; transform:translateX(-50%);
    bottom:76px;
    display:flex; flex-direction:column; gap:10px;
    width:min(520px, 92vw);
    pointer-events:none;
  }
  .pv-toast{
    pointer-events:none;
    opacity:0; transform: translateY(10px);
    transition:.22s ease;
    padding:12px 14px;
    border-radius:16px;
    border:1px solid var(--pv-line);
    background: rgba(15,26,47,.92);
    box-shadow: var(--pv-shadow);
    font-weight:700;
  }
  .pv-toast.show{ opacity:1; transform: translateY(0); }
  .pv-toast.success{ border-color: rgba(53,208,138,.45); }
  .pv-toast.error{ border-color: rgba(255,90,103,.45); }
  @media (min-width: 900px){
    .pv-tabs{ display:none; }
    .pv-toast-host{ bottom:20px; }
  }
  `;
  const style = document.createElement("style");
  style.id = "pv-style";
  style.textContent = css;
  document.head.appendChild(style);
}

/* -------------------------
   Profile & Username
------------------------- */
function profileIsComplete(p) {
  if (!p) return false;
  // username required + basic identity
  return Boolean(p.username && p.full_name && p.nationality && p.rank && p.dob);
}

async function fetchMyProfile() {
  if (!state.user) return null;
  const { data, error } = await sb
    .from("profiles")
    .select("id, username, full_name, nationality, rank, dob, avatar_url, created_at, updated_at")
    .eq("id", state.user.id)
    .maybeSingle();
  if (error) {
    console.error("fetchMyProfile:", error);
    return null;
  }
  return data || null;
}

async function upsertMyProfile(payload) {
  const { data, error } = await sb
    .from("profiles")
    .upsert(payload, { onConflict: "id" })
    .select("id, username, full_name, nationality, rank, dob, avatar_url, created_at, updated_at")
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function usernameAvailable(username) {
  const u = (username || "").trim().toLowerCase();
  if (!u) return false;
  const { data, error } = await sb
    .from("profiles")
    .select("id")
    .eq("username", u)
    .limit(1);
  if (error) throw error;
  // available if not used OR used by me
  if (!data || data.length === 0) return true;
  return data[0].id === state.user?.id;
}

function validUsername(u) {
  // same rule you were using in SQL:
  // starts with a-z, then a-z0-9._, length 3..20
  return /^[a-z][a-z0-9._]{2,19}$/.test(String(u || "").trim().toLowerCase());
}

async function tryUploadAvatar(file, userId) {
  if (!file) return null;
  const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
  const path = `${userId}/avatar_${Date.now()}.${ext}`;

  const { error: upErr } = await sb.storage
    .from(POST_MEDIA_BUCKET)
    .upload(path, file, { upsert: true, cacheControl: "3600" });

  if (upErr) {
    console.warn("Avatar upload error:", upErr.message);
    return null;
  }

  const { data } = sb.storage.from(POST_MEDIA_BUCKET).getPublicUrl(path);
  return data?.publicUrl || null;
}

/* -------------------------
   Feed (text + photo/video)
------------------------- */
async function fetchFeedPosts(limit = 30) {
  const { data, error } = await sb
    .from("feed_posts")
    .select("id, user_id, content, created_at, media_url, media_type")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data || [];
}

async function fetchProfilesByIds(ids) {
  if (!ids?.length) return [];
  const { data, error } = await sb
    .from("profiles")
    .select("id, username, full_name, avatar_url, rank, nationality")
    .in("id", ids);

  if (error) throw error;
  return data || [];
}

function renderPostItem(post, author) {
  const name = author?.full_name || author?.username || "PEPSVAL Member";
  const avatar = author?.avatar_url
    ? `<img src="${esc(author.avatar_url)}" alt="avatar" />`
    : `<div>${esc((name || "P")[0] || "P")}</div>`;

  const subParts = [];
  if (author?.rank) subParts.push(author.rank);
  if (author?.nationality) subParts.push(author.nationality);
  const when = post?.created_at ? new Date(post.created_at).toLocaleString() : "";
  if (when) subParts.push(when);

  let mediaHtml = "";
  if (post?.media_url) {
    const t = String(post.media_type || "").toLowerCase();
    if (t.startsWith("image")) {
      mediaHtml = `<div class="pv-media"><img src="${esc(post.media_url)}" alt="post media" /></div>`;
    } else if (t.startsWith("video")) {
      mediaHtml = `<div class="pv-media"><video src="${esc(post.media_url)}" controls playsinline></video></div>`;
    } else {
      // fallback
      mediaHtml = `<div class="pv-media"><a href="${esc(post.media_url)}" target="_blank" rel="noreferrer">Open file</a></div>`;
    }
  }

  return `
    <div class="pv-post">
      <div class="pv-post-top">
        <div class="pv-avatar">${avatar}</div>
        <div>
          <div class="pv-post-name">${esc(name)}</div>
          <div class="pv-post-sub">${esc(subParts.join(" • "))}</div>
        </div>
      </div>
      <div class="pv-post-body">${esc(post.content || "")}</div>
      ${mediaHtml}
    </div>
  `;
}

async function loadFeedInto(sel = "#feedList") {
  const host = $(sel);
  if (!host) return;
  host.innerHTML = `<div class="pv-muted">Loading feed…</div>`;

  try {
    const posts = await fetchFeedPosts(40);
    const ids = [...new Set(posts.map((p) => p.user_id).filter(Boolean))];
    const profs = await fetchProfilesByIds(ids);
    const map = new Map(profs.map((p) => [p.id, p]));

    if (!posts.length) {
      host.innerHTML = `<div class="pv-muted">No posts yet. Be the first to post.</div>`;
      return;
    }

    host.innerHTML = posts.map((p) => renderPostItem(p, map.get(p.user_id))).join("");
  } catch (e) {
    console.error("loadFeedInto:", e);
    host.innerHTML = `<div class="pv-status error" style="display:block;">Feed not loading: ${esc(
      e?.message || "Unknown error"
    )}</div>`;
  }
}

async function uploadPostMedia(file, userId) {
  if (!file) return { media_url: null, media_type: null };

  const type = String(file.type || "").toLowerCase();
  const ext = (file.name.split(".").pop() || "bin").toLowerCase();
  const path = `${userId}/post_${Date.now()}.${ext}`;

  const { error: upErr } = await sb.storage
    .from(POST_MEDIA_BUCKET)
    .upload(path, file, { upsert: true, cacheControl: "3600" });

  if (upErr) throw upErr;

  const { data } = sb.storage.from(POST_MEDIA_BUCKET).getPublicUrl(path);
  return { media_url: data?.publicUrl || null, media_type: type || null };
}

async function createFeedPost({ content, file }) {
  const text = (content || "").trim();
  if (!text && !file) throw new Error("Write something or attach a photo/video.");
  if (!state.user) throw new Error("Not logged in.");

  let media_url = null;
  let media_type = null;

  if (file) {
    const up = await uploadPostMedia(file, state.user.id);
    media_url = up.media_url;
    media_type = up.media_type;
  }

  const { error } = await sb.from("feed_posts").insert({
    user_id: state.user.id,
    content: text || "",
    media_url,
    media_type,
  });

  if (error) throw error;
}

/* -------------------------
   Auth
------------------------- */
async function loadSession() {
  const { data } = await sb.auth.getSession();
  state.session = data.session || null;
  state.user = data.session?.user || null;
}

async function signUpEmail(email, password) {
  const emailRedirectTo = window.location.origin + window.location.pathname;
  const { data, error } = await sb.auth.signUp({
    email,
    password,
    options: { emailRedirectTo },
  });
  if (error) throw error;

  // if confirmation enabled, no session
  if (!data.session) {
    toast("Account created. Check your email and confirm, then login.", "success");
  } else {
    toast("Signed up & logged in.", "success");
  }
}

async function signInEmail(email, password) {
  const { data, error } = await sb.auth.signInWithPassword({ email, password });
  if (error) throw error;
  state.session = data.session;
  state.user = data.user;
  toast("Logged in.", "success");
}

async function signOut() {
  await sb.auth.signOut();
  state.session = null;
  state.user = null;
  state.profile = null;
  toast("Logged out.", "info");
  setHash("#auth?mode=login");
  render();
}

/* -------------------------
   UI Shell
------------------------- */
function mountShell() {
  const root = $("#app");
  if (!root) {
    document.body.innerHTML = `<div id="app"></div>`;
  }

  const app = $("#app");
  app.innerHTML = `
    <div class="pv-wrap">
      <div id="toastHost" class="pv-toast-host"></div>

      <header class="pv-topbar">
        <div class="pv-brand" onclick="location.hash='#dashboard'">
          <div class="pv-logo"><img src="logo.webp" alt="PEPSVAL" onerror="this.style.display='none'"/></div>
          <div>
            <h1>PEPSVAL</h1>
            <div class="sub">${esc(TAGLINE)}</div>
          </div>
        </div>
        <div class="pv-actions" id="pvActions"></div>
      </header>

      <main class="pv-view" id="pvView"></main>

      <nav class="pv-tabs" id="pvTabs"></nav>
    </div>
  `;
}

function renderActions() {
  const host = $("#pvActions");
  if (!host) return;

  if (!state.user) {
    host.innerHTML = `
      <button class="pv-btn" id="btnLogin">Sign in</button>
      <button class="pv-btn primary" id="btnJoin">Join</button>
    `;
    $("#btnLogin")?.addEventListener("click", () => setHash("#auth?mode=login"));
    $("#btnJoin")?.addEventListener("click", () => setHash("#auth?mode=signup"));
  } else {
    host.innerHTML = `
      <button class="pv-btn" id="btnMe">${esc(state.profile?.username || "Me")}</button>
      <button class="pv-btn danger" id="btnLogout">Logout</button>
    `;
    $("#btnMe")?.addEventListener("click", () => {
      state.tab = "profile";
      setHash("#dashboard");
      render();
    });
    $("#btnLogout")?.addEventListener("click", signOut);
  }
}

function renderTabs() {
  const tabs = $("#pvTabs");
  if (!tabs) return;

  if (!state.user) {
    tabs.innerHTML = "";
    return;
  }

  const items = [
    ["feed", "Feed"],
    ["jobs", "Jobs"],
    ["post", "Post"],
    ["network", "Network"],
    ["messages", "Messages"],
    ["profile", "Profile"],
  ];

  tabs.innerHTML = items
    .map(
      ([k, label]) =>
        `<div class="pv-tab ${state.tab === k ? "active" : ""}" data-tab="${k}">${esc(label)}</div>`
    )
    .join("");

  tabs.onclick = (e) => {
    const el = e.target.closest("[data-tab]");
    if (!el) return;
    state.tab = el.dataset.tab;
    setHash("#dashboard");
    render();
  };
}

/* -------------------------
   Views
------------------------- */
function viewSplash() {
  const v = $("#pvView");
  v.innerHTML = `
    <div class="pv-splash">
      <div class="pv-splash-inner">
        <div class="pv-splash-logo">
          <img src="logo.webp" alt="PEPSVAL" onerror="this.style.display='none'"/>
        </div>
        <div class="pv-splash-name">PEPSVAL</div>
        <div class="pv-splash-tag">${esc(TAGLINE)}</div>
        <div class="pv-splash-bottom">Maritime network for careers and jobs</div>
      </div>
    </div>
  `;

  // after short splash, go to correct page
  setTimeout(async () => {
    await loadSession();
    state.profile = state.user ? await fetchMyProfile() : null;

    if (!state.user) {
      setHash("#auth?mode=login");
    } else if (!profileIsComplete(state.profile)) {
      setHash("#setup");
    } else {
      setHash("#dashboard");
    }
    render();
  }, 900);
}

function viewAuth() {
  const { params } = getRoute();
  const mode = params.get("mode") || "login";

  const v = $("#pvView");
  v.innerHTML = `
    <div class="pv-center">
      <div class="pv-card" style="width:min(520px,92vw);">
        <h2 class="pv-title">${mode === "signup" ? "Create your account" : "Sign in"}</h2>
        <div class="pv-muted">Email + password. Non-logged users cannot see anything.</div>

        <div id="pvStatus" class="pv-status"></div>

        <div class="pv-field">
          <label>Email</label>
          <input class="pv-input" id="email" type="email" autocomplete="email" placeholder="you@example.com" />
        </div>

        <div class="pv-field">
          <label>Password</label>
          <input class="pv-input" id="password" type="password" autocomplete="current-password" placeholder="••••••••" />
        </div>

        ${
          mode === "signup"
            ? `
          <div class="pv-field">
            <label>Confirm password</label>
            <input class="pv-input" id="password2" type="password" placeholder="••••••••" />
          </div>`
            : ``
        }

        <div class="pv-row" style="margin-top:10px;">
          <button class="pv-btn primary" id="submit">${mode === "signup" ? "Create account" : "Login"}</button>
          <button class="pv-btn" id="back">Back</button>
          <button class="pv-btn" id="switch">${mode === "signup" ? "I have an account" : "Create account"}</button>
        </div>

        <div class="pv-muted" style="margin-top:14px;">
          By continuing you agree to our <a href="#privacy">Privacy Policy</a> and <a href="#terms">Terms</a>.
        </div>
      </div>
    </div>
  `;

  $("#back")?.addEventListener("click", () => setHash("#splash"));
  $("#switch")?.addEventListener("click", () =>
    setHash(mode === "signup" ? "#auth?mode=login" : "#auth?mode=signup")
  );

  $("#submit")?.addEventListener("click", async () => {
    statusMsg("", "info");
    const email = ($("#email")?.value || "").trim();
    const pass = $("#password")?.value || "";

    if (!email || !pass) return statusMsg("Enter email and password.", "warn");

    try {
      if (mode === "signup") {
        const pass2 = $("#password2")?.value || "";
        if (pass !== pass2) return statusMsg("Passwords do not match.", "warn");

        statusMsg("Creating account…", "info");
        await signUpEmail(email, pass);

        // if user is not logged in yet (email confirmation), move to login
        await loadSession();
        if (!state.user) {
          statusMsg("Check your email and confirm. Then login.", "success");
          setTimeout(() => setHash("#auth?mode=login"), 900);
          return;
        }
      } else {
        statusMsg("Signing in…", "info");
        await signInEmail(email, pass);
      }

      state.profile = await fetchMyProfile();
      if (!profileIsComplete(state.profile)) {
        setHash("#setup");
      } else {
        setHash("#dashboard");
      }
      render();
    } catch (e) {
      console.error(e);
      statusMsg(e?.message || "Login failed.", "error");
    }
  });
}

function viewSetup() {
  const p = state.profile || {};
  const v = $("#pvView");

  v.innerHTML = `
    <div class="pv-center">
      <div class="pv-card" style="width:min(760px,92vw);">
        <h2 class="pv-title">Profile setup</h2>
        <div class="pv-muted">
          This is required once. You can skip later pages, but **this page opens first after login**.
        </div>

        <div id="pvStatus" class="pv-status"></div>

        <div class="pv-row" style="gap:14px; margin-top:10px; flex-wrap:wrap;">
          <div style="flex:1; min-width:240px;">
            <div class="pv-field">
              <label>Username (unique)</label>
              <input class="pv-input" id="username" placeholder="e.g. jithinphilip" value="${esc(
                p.username || ""
              )}" />
              <div class="pv-muted">
                Rule: starts with a letter. Use letters, numbers, dot or underscore. Length 3–20.
              </div>
            </div>
            <div class="pv-row">
              <button class="pv-btn" id="checkUser">Check availability</button>
              <div class="pv-muted" id="userCheckMsg"></div>
            </div>
          </div>

          <div style="flex:1; min-width:240px;">
            <div class="pv-field">
              <label>Full name</label>
              <input class="pv-input" id="full_name" value="${esc(p.full_name || "")}" />
            </div>

            <div class="pv-field">
              <label>Country / Nationality</label>
              <input class="pv-input" id="nationality" value="${esc(p.nationality || "")}" />
            </div>

            <div class="pv-field">
              <label>Rank</label>
              <input class="pv-input" id="rank" value="${esc(p.rank || "")}" />
            </div>

            <div class="pv-field">
              <label>Date of birth</label>
              <input class="pv-input" id="dob" type="date" value="${esc(p.dob || "")}" />
            </div>
          </div>
        </div>

        <div class="pv-field" style="margin-top:14px;">
          <label>Avatar (optional)</label>
          <input class="pv-input" id="avatar" type="file" accept="image/*" />
          <div class="pv-muted">Stored in your bucket <b>${esc(POST_MEDIA_BUCKET)}</b> for now.</div>
        </div>

        <div class="pv-row" style="margin-top:14px;">
          <button class="pv-btn primary" id="save">Save & Continue</button>
          <button class="pv-btn" id="skip">Skip for now</button>
          <button class="pv-btn danger" id="logout">Logout</button>
        </div>
      </div>
    </div>
  `;

  $("#logout")?.addEventListener("click", signOut);

  $("#checkUser")?.addEventListener("click", async () => {
    const msg = $("#userCheckMsg");
    if (msg) msg.textContent = "";
    try {
      const u = ($("#username")?.value || "").trim().toLowerCase();
      if (!validUsername(u)) {
        if (msg) msg.textContent = "Invalid username format.";
        return;
      }
      const ok = await usernameAvailable(u);
      if (msg) msg.textContent = ok ? "✅ Available" : "❌ Taken";
    } catch (e) {
      console.error(e);
      if (msg) msg.textContent = "Error checking username.";
    }
  });

  $("#skip")?.addEventListener("click", () => {
    // You wanted "skip exists", but this page opens first.
    // If skipped and still incomplete, dashboard will keep redirecting here.
    toast("You can skip, but you must complete later to use PEPSVAL.", "info");
    setHash("#dashboard");
    render();
  });

  $("#save")?.addEventListener("click", async () => {
    statusMsg("", "info");

    try {
      const username = ($("#username")?.value || "").trim().toLowerCase();
      const full_name = ($("#full_name")?.value || "").trim();
      const nationality = ($("#nationality")?.value || "").trim();
      const rank = ($("#rank")?.value || "").trim();
      const dob = $("#dob")?.value || null;

      if (!username || !full_name || !nationality || !rank || !dob) {
        return statusMsg("Fill all required fields (including username).", "warn");
      }

      if (!validUsername(username)) {
        return statusMsg("Username format is invalid.", "warn");
      }

      const ok = await usernameAvailable(username);
      if (!ok) return statusMsg("Username already taken. Try another.", "warn");

      statusMsg("Saving…", "info");

      const file = $("#avatar")?.files?.[0] || null;
      let avatar_url = p.avatar_url || null;

      if (file) {
        const up = await tryUploadAvatar(file, state.user.id);
        if (up) avatar_url = up;
      }

      const payload = {
        id: state.user.id,
        username,
        full_name,
        nationality,
        rank,
        dob,
        avatar_url,
        updated_at: nowISO(),
      };

      const saved = await upsertMyProfile(payload);
      state.profile = saved;

      statusMsg("Saved successfully.", "success");
      toast("Profile saved ✅", "success");

      setHash("#dashboard");
      render();
    } catch (e) {
      console.error(e);

      // common unique error
      if (String(e?.message || "").toLowerCase().includes("duplicate")) {
        statusMsg("Username already exists. Try another.", "error");
      } else {
        statusMsg(e?.message || "Save failed.", "error");
      }
    }
  });
}

function dashboardShell() {
  const v = $("#pvView");

  const p = state.profile || {};
  const name = p.full_name || p.username || "Member";

  v.innerHTML = `
    <div class="pv-card">
      <div class="pv-row" style="justify-content:space-between;">
        <div>
          <h2 class="pv-title" style="margin:0;">Welcome, ${esc(name)}</h2>
          <div class="pv-muted">
            ${esc(p.rank || "")}${p.rank && p.nationality ? " • " : ""}${esc(p.nationality || "")}
          </div>
          <div class="pv-muted" style="margin-top:8px;">
            NOTE: If any sea service entry is verified by peer or employer, it becomes locked and cannot be edited.
          </div>
        </div>
        <div class="pv-row">
          <button class="pv-btn" id="tabFeed">Feed</button>
          <button class="pv-btn" id="tabPost">Post</button>
          <button class="pv-btn" id="tabProfile">Profile</button>
        </div>
      </div>
    </div>

    <div style="height:14px;"></div>

    <div id="dashContent"></div>
  `;

  $("#tabFeed")?.addEventListener("click", () => {
    state.tab = "feed";
    render();
  });
  $("#tabPost")?.addEventListener("click", () => {
    state.tab = "post";
    render();
  });
  $("#tabProfile")?.addEventListener("click", () => {
    state.tab = "profile";
    render();
  });
}

function viewDashboard() {
  // SECURITY: non-logged users must never see feed
  if (!state.user) {
    setHash("#auth?mode=login");
    return viewAuth();
  }

  // if profile incomplete, force setup
  if (!profileIsComplete(state.profile)) {
    setHash("#setup");
    return viewSetup();
  }

  dashboardShell();
  renderTabs(); // mobile tabs

  // desktop: keep state.tab
  const content = $("#dashContent");
  if (!content) return;

  if (state.tab === "feed") return dashFeed(content);
  if (state.tab === "post") return dashPost(content);
  if (state.tab === "jobs") return dashPlaceholder(content, "Jobs", "Jobs will be wired next (filters + search + post a job).");
  if (state.tab === "network") return dashPlaceholder(content, "Network", "Search seafarers, companies and recruiters with filters (coming next).");
  if (state.tab === "messages") return dashPlaceholder(content, "Messages", "Instagram-style messaging (photos/videos + block/unblock) will be built next.");
  if (state.tab === "profile") return dashProfile(content);

  // fallback
  state.tab = "feed";
  return dashFeed(content);
}

function dashPlaceholder(host, title, sub) {
  host.innerHTML = `
    <div class="pv-card">
      <h3 style="margin:0 0 8px;">${esc(title)}</h3>
      <div class="pv-muted">${esc(sub)}</div>
    </div>
  `;
}

function dashFeed(host) {
  host.innerHTML = `
    <div class="pv-card">
      <h3 style="margin:0 0 8px;">Feed</h3>
      <div class="pv-muted">Only logged-in users can see posts.</div>
      <div style="height:10px;"></div>
      <div id="feedList" class="pv-feed"></div>
    </div>
  `;
  loadFeedInto("#feedList");
}

function dashPost(host) {
  host.innerHTML = `
    <div class="pv-card">
      <h3 style="margin:0 0 8px;">Create post</h3>
      <div class="pv-muted">Supports text, photos, videos.</div>

      <div id="pvStatus" class="pv-status"></div>

      <div class="pv-field" style="margin-top:12px;">
        <label>Text</label>
        <textarea class="pv-textarea" id="postText" placeholder="Write something…"></textarea>
      </div>

      <div class="pv-field">
        <label>Photo / Video (optional)</label>
        <input class="pv-input" id="postFile" type="file" accept="image/*,video/*" />
        <div class="pv-muted">Uploads to bucket: <b>${esc(POST_MEDIA_BUCKET)}</b></div>
      </div>

      <div class="pv-row" style="margin-top:10px;">
        <button class="pv-btn primary" id="btnPost">Post</button>
        <button class="pv-btn" id="btnRefresh">Refresh feed</button>
      </div>

      <div style="height:14px;"></div>
      <div class="pv-muted">Recent posts</div>
      <div style="height:10px;"></div>
      <div id="feedPreview" class="pv-feed"></div>
    </div>
  `;

  loadFeedInto("#feedPreview");

  $("#btnRefresh")?.addEventListener("click", () => loadFeedInto("#feedPreview"));

  $("#btnPost")?.addEventListener("click", async () => {
    statusMsg("", "info");
    const btn = $("#btnPost");
    if (btn) btn.disabled = true;

    try {
      const content = $("#postText")?.value || "";
      const file = $("#postFile")?.files?.[0] || null;

      statusMsg("Posting…", "info");
      await createFeedPost({ content, file });

      if ($("#postText")) $("#postText").value = "";
      if ($("#postFile")) $("#postFile").value = "";

      statusMsg("Posted ✅", "success");
      toast("Posted ✅", "success");

      // switch to feed
      state.tab = "feed";
      render();
    } catch (e) {
      console.error(e);
      statusMsg(e?.message || "Post failed.", "error");
      toast("Post failed", "error");
    } finally {
      if (btn) btn.disabled = false;
    }
  });
}

function dashProfile(host) {
  const p = state.profile || {};
  host.innerHTML = `
    <div class="pv-card">
      <h3 style="margin:0 0 8px;">Profile</h3>
      <div class="pv-muted">You can change username later (must stay unique).</div>

      <div style="height:14px;"></div>

      <div class="pv-row" style="align-items:flex-start;">
        <div class="pv-avatar" style="width:70px;height:70px;border-radius:22px;">
          ${
            p.avatar_url
              ? `<img src="${esc(p.avatar_url)}" alt="avatar" />`
              : `<div>${esc((p.username || "P")[0] || "P")}</div>`
          }
        </div>

        <div style="flex:1;">
          <div style="font-weight:900;font-size:16px;">${esc(p.full_name || "-")}</div>
          <div class="pv-muted">@${esc(p.username || "-")}</div>
          <div class="pv-muted" style="margin-top:6px;">
            ${esc(p.rank || "")}${p.rank && p.nationality ? " • " : ""}${esc(p.nationality || "")}
          </div>
          <div class="pv-muted">DOB: ${esc(p.dob || "-")}</div>
        </div>
      </div>

      <div class="pv-row" style="margin-top:14px;">
        <button class="pv-btn primary" id="editBasics">Edit basics</button>
        <button class="pv-btn" id="privacy">Privacy Policy</button>
        <button class="pv-btn" id="terms">Terms</button>
        <button class="pv-btn danger" id="logout3">Logout</button>
      </div>
    </div>
  `;

  $("#editBasics")?.addEventListener("click", () => setHash("#setup"));
  $("#privacy")?.addEventListener("click", () => setHash("#privacy"));
  $("#terms")?.addEventListener("click", () => setHash("#terms"));
  $("#logout3")?.addEventListener("click", signOut);
}

function viewStatic(type) {
  const title = type === "privacy" ? "Privacy Policy" : type === "terms" ? "Terms of Service" : "Page";

  // simple short text (your request: simple + understandable + short)
  let body = "";
  if (type === "privacy") {
    body = `
      <p><b>What we collect</b><br/>Account email, your profile details (name, username, rank, nationality, DOB) and posts you create.</p>
      <p><b>How we use data</b><br/>To run Pepsval features: login, profile, feed, jobs, network and messaging.</p>
      <p><b>Sharing</b><br/>We don’t sell your personal data. Data is visible only to logged-in users (as per Pepsval rules).</p>
      <p><b>Storage</b><br/>Images/videos you upload are stored in our Supabase storage bucket.</p>
      <p><b>Security</b><br/>We use authentication and database access rules (RLS) to protect data.</p>
      <p><b>Contact</b><br/>If you need help or want your account deleted, contact the Pepsval admin.</p>
    `;
  } else if (type === "terms") {
    body = `
      <p><b>Purpose</b><br/>Pepsval is a maritime network for careers and jobs.</p>
      <p><b>Account</b><br/>You are responsible for your account and activity.</p>
      <p><b>Content</b><br/>Do not post illegal, abusive, misleading or harmful content.</p>
      <p><b>Verification</b><br/>Verification tools help trust, but Pepsval does not guarantee employment or claims.</p>
      <p><b>Changes</b><br/>We may update features and these terms as Pepsval grows.</p>
    `;
  }

  const v = $("#pvView");
  v.innerHTML = `
    <div class="pv-center">
      <div class="pv-card" style="width:min(760px,92vw);">
        <h2 class="pv-title">${esc(title)}</h2>
        <div class="pv-muted">Simple draft. We can refine later.</div>
        <div style="height:14px;"></div>
        <div class="pv-muted" style="font-size:14px; line-height:1.7;">
          ${body}
          <p><b>Delete account</b><br/>If you want deletion, we will delete your profile and account records as required by law and platform rules.</p>
          <p><b>Data usage</b><br/>Data is used only to operate Pepsval features and improve the platform.</p>
        </div>
        <div class="pv-row" style="margin-top:14px;">
          <button class="pv-btn" onclick="location.hash='${state.user ? "#dashboard" : "#auth?mode=login"}'">Back</button>
        </div>
      </div>
    </div>
  `;
}

/* -------------------------
   Main Render
------------------------- */
async function render() {
  renderActions();

  const { path } = getRoute();

  // Always refresh session state when route changes (safe)
  await loadSession();
  state.user = state.session?.user || null;
  state.profile = state.user ? await fetchMyProfile() : null;

  renderActions();
  renderTabs();

  // ROUTES
  if (path === "splash") return viewSplash();

  if (path === "auth") return viewAuth();

  if (path === "privacy") return viewStatic("privacy");
  if (path === "terms") return viewStatic("terms");

  // From here, enforce login
  if (!state.user) {
    setHash("#auth?mode=login");
    return viewAuth();
  }

  if (path === "setup") return viewSetup();

  if (path === "dashboard") return viewDashboard();

  // default
  setHash("#dashboard");
  return viewDashboard();
}

/* -------------------------
   Init
------------------------- */
async function init() {
  injectBaseStyles();
  mountShell();

  await loadSession();
  state.profile = state.user ? await fetchMyProfile() : null;

  // Start with splash always (Instagram-style)
  if (!window.location.hash) {
    setHash("#splash");
  }

  sb.auth.onAuthStateChange(async (_event, session) => {
    state.session = session;
    state.user = session?.user || null;
    state.profile = state.user ? await fetchMyProfile() : null;

    if (!state.user) {
      setHash("#auth?mode=login");
    } else if (!profileIsComplete(state.profile)) {
      setHash("#setup");
    } else {
      setHash("#dashboard");
    }
    render();
  });

  window.addEventListener("hashchange", () => render());

  render();
}

init();
