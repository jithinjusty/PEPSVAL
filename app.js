/* =========================
   PEPSVAL — app.js (Premium SPA)
   - GitHub Pages compatible (hash routing)
   - Premium splash (1 second min) + smooth fade
   - Premium login page (Instagram-like)
   Requires:
     <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
   ========================= */

/* 1) CONFIG */
const SUPABASE_URL = "https://czlmeehcxrslgfvqjfsb.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN6bG1lZWhjeHJzbGdmdnFqZnNiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc1MzU0NjgsImV4cCI6MjA4MzExMTQ2OH0.vHeIA2n6tm3F3IEoOPBsrIXQ1JXRlhe6bU4VP9b2lek";

const AVATAR_BUCKET = "avatars"; // optional

if (!window.supabase) {
  alert("Supabase library not loaded. Add supabase-js CDN script in index.html.");
}
const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/* Helpers */
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

const esc = (s) =>
  String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

function toast(msg, type = "info") {
  const host = $("#toastHost");
  if (!host) return;
  const t = document.createElement("div");
  t.className = `toast ${type}`;
  t.textContent = msg;
  host.appendChild(t);
  setTimeout(() => t.classList.add("show"), 10);
  setTimeout(() => {
    t.classList.remove("show");
    setTimeout(() => t.remove(), 250);
  }, 2600);
}

/* Splash control (1 second min) */
const splash = $("#splash");
const splashStart = Date.now();
let splashReady = false;

function hideSplashWhenReady() {
  if (!splash || splash.classList.contains("hide")) return;

  const minMs = 950;
  const elapsed = Date.now() - splashStart;
  const wait = Math.max(0, minMs - elapsed);

  if (!splashReady) return; // do nothing until app marks ready
  setTimeout(() => {
    splash.classList.add("hide");
  }, wait);
}

/* Theme (optional; default light) */
function getTheme() {
  return localStorage.getItem("pepsval_theme") || "light";
}
function setTheme(theme) {
  localStorage.setItem("pepsval_theme", theme);
  document.documentElement.dataset.theme = theme;
}
function toggleTheme() {
  setTheme(getTheme() === "dark" ? "light" : "dark");
}

/* State */
const state = {
  session: null,
  user: null,
  profile: null,
  activeTab: "feed",
};

/* Profile logic */
function profileIsComplete(p) {
  if (!p) return false;
  return Boolean(p.full_name && p.nationality && p.rank && p.dob);
}

async function fetchMyProfile() {
  if (!state.user) return null;
  const { data, error } = await sb
    .from("profiles")
    .select("id, username, full_name, nationality, rank, company, dob, avatar_url, updated_at, created_at")
    .eq("id", state.user.id)
    .maybeSingle();

  if (error) {
    console.error("fetchMyProfile error:", error);
    return null;
  }
  return data || null;
}

async function upsertMyProfile(payload) {
  const { data, error } = await sb
    .from("profiles")
    .upsert(payload, { onConflict: "id" })
    .select()
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function tryUploadAvatar(file, userId) {
  if (!file) return null;
  const ext = (file.name.split(".").pop() || "png").toLowerCase();
  const path = `${userId}/avatar.${ext}`;

  const { error: upErr } = await sb.storage
    .from(AVATAR_BUCKET)
    .upload(path, file, { upsert: true, cacheControl: "3600" });

  if (upErr) {
    console.warn("Avatar upload skipped:", upErr.message);
    return null;
  }
  const { data } = sb.storage.from(AVATAR_BUCKET).getPublicUrl(path);
  return data?.publicUrl || null;
}

/* Auth */
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

  if (!data.session) toast("Account created. Confirm email, then sign in.", "success");
  else toast("Account created and signed in.", "success");
}

async function signInEmail(email, password) {
  const { data, error } = await sb.auth.signInWithPassword({ email, password });
  if (error) throw error;
  state.session = data.session;
  state.user = data.user;
  toast("Welcome back ✅", "success");
}

async function signOut() {
  await sb.auth.signOut();
  state.session = null;
  state.user = null;
  state.profile = null;
  toast("Logged out.", "info");
  window.location.hash = "#/home";
  renderApp();
}

/* Routing (hash) */
function getRoute() {
  // we use "#/home", "#/auth?mode=login"
  const raw = window.location.hash || "#/home";
  const h = raw.startsWith("#/") ? raw.slice(2) : raw.replace("#", "");
  const [path, query] = h.split("?");
  const params = new URLSearchParams(query || "");
  return { path: path || "home", params };
}
function goto(path) {
  window.location.hash = `#/${path}`;
}

/* UI Shell */
function mountBase() {
  const root = $("#app");
  if (!root) return;

  root.innerHTML = `
    <div id="toastHost" class="toast-host"></div>

    <header class="topbar">
      <div class="brand">
        <img class="brand-logo" src="logo.webp" alt="PEPSVAL logo" />
        <div class="brand-text">
          <div class="brand-row">
            <span class="brand-name">PEPSVAL</span>
            <span class="badge">BETA</span>
          </div>
          <div class="brand-sub">Connect, hire and grow</div>
        </div>
      </div>

      <div class="topbar-actions">
        <button class="btn btn-ghost" id="themeBtn">Theme</button>
        <div id="authButtons"></div>
      </div>
    </header>

    <main id="view" class="view"></main>

    <nav id="mobileNav" class="mobile-nav" style="display:none;"></nav>

    <footer class="footer">
      <div>© ${new Date().getFullYear()} Pepsval</div>
      <div>
        Founder
        <a href="https://www.linkedin.com/in/jithinilip?utm_source=share&utm_campaign=share_via&utm_content=profile&utm_medium=android_app"
           target="_blank" rel="noreferrer">JITHIN PHILIP</a>
      </div>
    </footer>
  `;

  $("#themeBtn")?.addEventListener("click", toggleTheme);
}

function renderAuthButtons() {
  const host = $("#authButtons");
  if (!host) return;

  if (!state.user) {
    host.innerHTML = `
      <button class="btn btn-ghost" id="btnLogin">Sign in</button>
      <button class="btn btn-primary" id="btnJoin">Join</button>
    `;
    $("#btnLogin")?.addEventListener("click", () => goto("auth?mode=login"));
    $("#btnJoin")?.addEventListener("click", () => goto("auth?mode=signup"));
  } else {
    host.innerHTML = `
      <button class="btn btn-ghost" id="btnLogout">Logout</button>
    `;
    $("#btnLogout")?.addEventListener("click", signOut);
  }
}

function renderMobileNav() {
  const nav = $("#mobileNav");
  if (!nav) return;

  nav.innerHTML = `
    <button class="mnav-btn ${state.activeTab === "feed" ? "active" : ""}" data-tab="feed">Feed</button>
    <button class="mnav-btn ${state.activeTab === "jobs" ? "active" : ""}" data-tab="jobs">Jobs</button>
    <button class="mnav-btn ${state.activeTab === "post" ? "active" : ""}" data-tab="post">Post</button>
    <button class="mnav-btn ${state.activeTab === "network" ? "active" : ""}" data-tab="network">Network</button>
    <button class="mnav-btn ${state.activeTab === "messages" ? "active" : ""}" data-tab="messages">Messages</button>
    <button class="mnav-btn ${state.activeTab === "profile" ? "active" : ""}" data-tab="profile">Profile</button>
  `;

  nav.addEventListener("click", (e) => {
    const b = e.target.closest("button[data-tab]");
    if (!b) return;
    state.activeTab = b.dataset.tab;
    renderApp();
  });
}

/* Premium views */
function renderHome() {
  const view = $("#view");
  view.innerHTML = `
    <div style="max-width:980px;margin:0 auto;">
      <div style="
        display:grid; gap:16px;
        grid-template-columns: 1.1fr .9fr;
        align-items:start;
      " class="homeGrid">
        <div style="
          border:1px solid var(--border);
          background: var(--card);
          border-radius: var(--r-xl);
          padding: 22px;
          box-shadow: var(--shadow);
        ">
          <div style="display:flex; align-items:center; gap:14px;">
            <img src="logo.webp" alt="PEPSVAL" style="width:56px;height:56px;object-fit:contain;filter:drop-shadow(0 18px 36px rgba(0,0,0,.12));" />
            <div>
              <div style="font-weight:950; letter-spacing:.18em;">PEPSVAL</div>
              <div style="color:var(--muted); font-weight:800; margin-top:2px;">Connect, hire and grow</div>
            </div>
          </div>

          <h1 style="margin:14px 0 6px; font-size:44px; line-height:1.06;">
            Maritime network for sea & shore careers
          </h1>
          <p style="margin:0; color:var(--muted); font-size:16px; line-height:1.7;">
            A private-by-login platform for seafarers, employers, agencies and shore professionals.
            Browse jobs, share updates, and message — all in one place.
          </p>

          <div style="display:flex; gap:10px; flex-wrap:wrap; margin-top:16px;">
            <button class="btn btn-primary" id="homeLogin">Sign in</button>
            <button class="btn btn-ghost" id="homeJoin">Create account</button>
          </div>

          <div style="margin-top:14px;color:var(--muted2); font-size:13px;">
            Note: Your content is only visible after login.
          </div>
        </div>

        <div style="
          border:1px solid var(--border);
          background: var(--card);
          border-radius: var(--r-xl);
          padding: 22px;
          box-shadow: var(--shadow2);
        ">
          <div style="font-weight:950;margin-bottom:6px;">What’s inside</div>
          <div style="color:var(--muted); line-height:1.7;">
            • Feed (posts, photos, videos later)<br/>
            • Jobs (sea & shore roles)<br/>
            • Network search (rank/country/company/keywords)<br/>
            • Messages (accept intro to continue chat)<br/>
            • Profile (documents expiry + sea service later)
          </div>

          <div style="margin-top:14px; padding:12px; border-radius:16px; border:1px solid var(--border); background: rgba(31,111,134,.08);">
            <div style="font-weight:900;">Partnerships</div>
            <div style="color:var(--muted); margin-top:6px;">
              Contact: <a href="mailto:jithinilip@gmail.com" style="font-weight:900; color:var(--brand2); text-decoration:none;">jithinilip@gmail.com</a>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;

  // responsive grid
  const grid = view.querySelector(".homeGrid");
  if (grid) {
    const mq = window.matchMedia("(max-width: 980px)");
    const apply = () => (grid.style.gridTemplateColumns = mq.matches ? "1fr" : "1.1fr .9fr");
    apply();
    mq.addEventListener?.("change", apply);
  }

  $("#homeLogin")?.addEventListener("click", () => goto("auth?mode=login"));
  $("#homeJoin")?.addEventListener("click", () => goto("auth?mode=signup"));
}

function renderAuth() {
  const view = $("#view");
  const { params } = getRoute();
  const mode = params.get("mode") || "login";

  view.innerHTML = `
    <div style="max-width:420px;margin:0 auto;">
      <div style="
        border:1px solid var(--border);
        background: var(--card);
        border-radius: var(--r-xl);
        padding: 22px;
        box-shadow: var(--shadow);
      ">
        <div style="text-align:center; padding: 6px 0 16px;">
          <img src="logo.webp" alt="PEPSVAL" style="width:68px;height:68px;object-fit:contain;filter:drop-shadow(0 18px 36px rgba(0,0,0,.12));" />
          <div style="margin-top:10px; font-weight:950; letter-spacing:.22em;">PEPSVAL</div>
          <div style="margin-top:6px; color:var(--muted); font-weight:800;">Connect, hire and grow</div>
        </div>

        <div style="display:flex; gap:8px; margin-bottom:14px;">
          <button class="btn ${mode === "login" ? "btn-primary" : "btn-ghost"}" id="tabLogin" style="width:100%;">Sign in</button>
          <button class="btn ${mode === "signup" ? "btn-primary" : "btn-ghost"}" id="tabJoin" style="width:100%;">Join</button>
        </div>

        <div id="status" style="display:none; padding:10px 12px; border-radius:14px; border:1px solid var(--border); background: rgba(31,111,134,.08); color: var(--muted); font-weight:800; margin-bottom:12px;"></div>

        <label style="display:block; font-size:12px; font-weight:900; color:var(--muted); margin-bottom:6px;">Email</label>
        <input id="email" type="email" autocomplete="email" placeholder="you@example.com"
          style="width:100%; padding:12px 12px; border-radius:16px; border:1px solid var(--border); background: rgba(255,255,255,.35); outline:none; font-size:14px; color: var(--ink);" />

        <div style="height:10px;"></div>

        <label style="display:block; font-size:12px; font-weight:900; color:var(--muted); margin-bottom:6px;">Password</label>
        <input id="password" type="password" autocomplete="current-password" placeholder="••••••••"
          style="width:100%; padding:12px 12px; border-radius:16px; border:1px solid var(--border); background: rgba(255,255,255,.35); outline:none; font-size:14px; color: var(--ink);" />

        <div id="confirmWrap" style="display:${mode === "signup" ? "block" : "none"}; margin-top:10px;">
          <label style="display:block; font-size:12px; font-weight:900; color:var(--muted); margin-bottom:6px;">Confirm password</label>
          <input id="password2" type="password" autocomplete="new-password" placeholder="••••••••"
            style="width:100%; padding:12px 12px; border-radius:16px; border:1px solid var(--border); background: rgba(255,255,255,.35); outline:none; font-size:14px; color: var(--ink);" />
        </div>

        <div style="display:flex; gap:10px; margin-top:14px;">
          <button class="btn btn-primary" id="submitBtn" style="width:100%;">${mode === "signup" ? "Create account" : "Sign in"}</button>
        </div>

        <button id="forgotBtn" class="btn btn-ghost" style="width:100%; margin-top:10px;">Forgot password</button>

        <div style="margin-top:12px; color:var(--muted2); font-size:12px; line-height:1.6; text-align:center;">
          By continuing, you agree to our <a href="#/terms" style="color:var(--brand2); font-weight:900; text-decoration:none;">Terms</a> and
          <a href="#/privacy" style="color:var(--brand2); font-weight:900; text-decoration:none;">Privacy Policy</a>.
        </div>
      </div>
    </div>
  `;

  const statusEl = $("#status");
  const setStatus = (msg = "") => {
    if (!statusEl) return;
    statusEl.style.display = msg ? "block" : "none";
    statusEl.textContent = msg;
  };

  $("#tabLogin")?.addEventListener("click", () => goto("auth?mode=login"));
  $("#tabJoin")?.addEventListener("click", () => goto("auth?mode=signup"));

  $("#submitBtn")?.addEventListener("click", async () => {
    const email = ($("#email")?.value || "").trim();
    const password = $("#password")?.value || "";
    const password2 = $("#password2")?.value || "";
    const btn = $("#submitBtn");

    if (!email || !password) return setStatus("Please enter email and password.");

    if (mode === "signup") {
      if (password.length < 6) return setStatus("Password must be at least 6 characters.");
      if (password !== password2) return setStatus("Passwords do not match.");
    }

    try {
      setStatus("");
      if (btn) { btn.disabled = true; btn.textContent = (mode === "signup") ? "Creating…" : "Signing in…"; }

      if (mode === "signup") {
        await signUpEmail(email, password);
        setStatus("Check your email to confirm your account, then sign in.");
      } else {
        await signInEmail(email, password);
        state.profile = await fetchMyProfile();
        if (profileIsComplete(state.profile)) goto("dashboard");
        else goto("setup");
      }
    } catch (e) {
      console.error(e);
      setStatus(e?.message || "Something went wrong.");
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = (mode === "signup") ? "Create account" : "Sign in"; }
      renderApp();
    }
  });

  $("#forgotBtn")?.addEventListener("click", async () => {
    const email = ($("#email")?.value || "").trim();
    if (!email) return setStatus("Enter your email first, then tap Forgot password.");
    try {
      setStatus("Sending reset email…");
      const redirectTo = window.location.origin + window.location.pathname;
      const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo });
      if (error) throw error;
      setStatus("Password reset email sent. Check inbox/spam.");
    } catch (e) {
      setStatus(e?.message || "Could not send reset email.");
    }
  });
}

function renderSetup() {
  const view = $("#view");
  const p = state.profile || {};

  // IMPORTANT: no example placeholders (as you requested)
  view.innerHTML = `
    <div style="max-width:760px;margin:0 auto;">
      <div style="
        border:1px solid var(--border);
        background: var(--card);
        border-radius: var(--r-xl);
        padding: 22px;
        box-shadow: var(--shadow);
      ">
        <div style="display:flex; align-items:center; justify-content:space-between; gap:12px; flex-wrap:wrap;">
          <div>
            <div style="font-weight:950; font-size:20px;">Profile setup</div>
            <div style="color:var(--muted); margin-top:6px; line-height:1.6;">
              Complete your profile to enter the platform. You can also skip and finish later.
            </div>
          </div>
          <div style="display:flex; gap:10px;">
            <button class="btn btn-ghost" id="skipSetup">Skip</button>
            <button class="btn btn-ghost" id="logoutSetup">Logout</button>
          </div>
        </div>

        <div id="status" style="display:none; margin-top:12px; padding:10px 12px; border-radius:14px; border:1px solid var(--border); background: rgba(31,111,134,.08); color: var(--muted); font-weight:800;"></div>

        <div style="display:grid; grid-template-columns: 1fr 1fr; gap:12px; margin-top:14px;" class="setupGrid">
          <div>
            <label style="display:block; font-size:12px; font-weight:900; color:var(--muted); margin-bottom:6px;">Full name</label>
            <input id="full_name" type="text" value="${esc(p.full_name)}"
              style="width:100%; padding:12px; border-radius:16px; border:1px solid var(--border); background: rgba(255,255,255,.35); outline:none; color:var(--ink);" />
          </div>

          <div>
            <label style="display:block; font-size:12px; font-weight:900; color:var(--muted); margin-bottom:6px;">Nationality</label>
            <input id="nationality" type="text" value="${esc(p.nationality)}"
              style="width:100%; padding:12px; border-radius:16px; border:1px solid var(--border); background: rgba(255,255,255,.35); outline:none; color:var(--ink);" />
          </div>

          <div>
            <label style="display:block; font-size:12px; font-weight:900; color:var(--muted); margin-bottom:6px;">Rank</label>
            <input id="rank" type="text" value="${esc(p.rank)}"
              style="width:100%; padding:12px; border-radius:16px; border:1px solid var(--border); background: rgba(255,255,255,.35); outline:none; color:var(--ink);" />
          </div>

          <div>
            <label style="display:block; font-size:12px; font-weight:900; color:var(--muted); margin-bottom:6px;">Date of birth</label>
            <input id="dob" type="date" value="${esc(p.dob)}"
              style="width:100%; padding:12px; border-radius:16px; border:1px solid var(--border); background: rgba(255,255,255,.35); outline:none; color:var(--ink);" />
          </div>

          <div style="grid-column:1 / -1;">
            <label style="display:block; font-size:12px; font-weight:900; color:var(--muted); margin-bottom:6px;">Profile picture (optional)</label>
            <input id="avatar" type="file" accept="image/*"
              style="width:100%; padding:12px; border-radius:16px; border:1px solid var(--border); background: rgba(255,255,255,.35); outline:none; color:var(--ink);" />
            <div style="margin-top:8px; color:var(--muted2); font-size:12px; line-height:1.6;">
              If avatar upload is not configured yet, your details still save. You can add photo later.
            </div>
          </div>
        </div>

        <div style="display:flex; gap:10px; margin-top:14px; flex-wrap:wrap;">
          <button class="btn btn-primary" id="saveContinue">Save & Continue</button>
        </div>
      </div>
    </div>
  `;

  // responsive columns
  const grid = view.querySelector(".setupGrid");
  if (grid) {
    const mq = window.matchMedia("(max-width: 860px)");
    const apply = () => (grid.style.gridTemplateColumns = mq.matches ? "1fr" : "1fr 1fr");
    apply();
    mq.addEventListener?.("change", apply);
  }

  const statusEl = $("#status");
  const setStatus = (msg = "") => {
    if (!statusEl) return;
    statusEl.style.display = msg ? "block" : "none";
    statusEl.textContent = msg;
  };

  $("#logoutSetup")?.addEventListener("click", signOut);
  $("#skipSetup")?.addEventListener("click", () => goto("dashboard"));

  $("#saveContinue")?.addEventListener("click", async () => {
    try {
      const full_name = ($("#full_name")?.value || "").trim();
      const nationality = ($("#nationality")?.value || "").trim();
      const rank = ($("#rank")?.value || "").trim();
      const dob = $("#dob")?.value || null;

      if (!full_name || !nationality || !rank || !dob) {
        setStatus("Please fill all required fields.");
        return;
      }

      setStatus("Saving…");

      const file = $("#avatar")?.files?.[0] || null;
      let avatar_url = p.avatar_url || null;
      const uploadedUrl = await tryUploadAvatar(file, state.user.id);
      if (uploadedUrl) avatar_url = uploadedUrl;

      const payload = {
        id: state.user.id,
        full_name,
        nationality,
        rank,
        dob,
        avatar_url,
        updated_at: new Date().toISOString(),
      };

      state.profile = await upsertMyProfile(payload);
      toast("Profile saved ✅", "success");
      goto("dashboard");
      renderApp();
    } catch (e) {
      console.error(e);
      setStatus(e?.message || "Save failed.");
    }
  });
}

function renderDashboard() {
  const view = $("#view");
  const p = state.profile || {};

  // show mobile nav
  const nav = $("#mobileNav");
  if (nav) nav.style.display = "flex";
  renderMobileNav();

  // Premium dashboard layout (LinkedIn-ish)
  view.innerHTML = `
    <div style="max-width:1120px;margin:0 auto;">
      <div style="
        display:grid; gap:14px;
        grid-template-columns: 340px 1fr 320px;
        align-items:start;
      " class="dashGrid">

        <!-- Left -->
        <aside style="
          border:1px solid var(--border);
          background: var(--card);
          border-radius: var(--r-xl);
          padding: 18px;
          box-shadow: var(--shadow2);
        ">
          <div style="display:flex; align-items:center; gap:12px;">
            <div style="width:64px; height:64px; border-radius:18px; overflow:hidden; border:1px solid var(--border); background: rgba(31,111,134,.10); display:grid; place-items:center; font-weight:950;">
              ${
                p.avatar_url
                  ? `<img src="${esc(p.avatar_url)}" alt="avatar" style="width:100%;height:100%;object-fit:cover;" />`
                  : `${esc((p.full_name || "P")[0] || "P")}`
              }
            </div>
            <div>
              <div style="font-weight:950; font-size:16px;">${esc(p.full_name || "Profile")}</div>
              <div style="color:var(--muted); font-weight:800; margin-top:4px;">
                ${esc(p.rank || "")}${p.rank && p.nationality ? " • " : ""}${esc(p.nationality || "")}
              </div>
            </div>
          </div>

          <div style="margin-top:14px; display:grid; gap:10px;">
            <button class="btn btn-ghost" id="goProfile">Edit profile</button>
            <button class="btn btn-ghost" id="goSetup">Profile setup</button>
            <button class="btn btn-ghost" id="logoutDash">Logout</button>
          </div>

          <div style="margin-top:14px; padding:12px; border-radius:16px; border:1px solid var(--border); background: rgba(31,111,134,.08);">
            <div style="font-weight:900;">Partnerships</div>
            <div style="color:var(--muted); margin-top:6px;">
              <a href="mailto:jithinilip@gmail.com" style="font-weight:900; color:var(--brand2); text-decoration:none;">jithinilip@gmail.com</a>
            </div>
          </div>
        </aside>

        <!-- Main -->
        <main style="
          border:1px solid var(--border);
          background: var(--card);
          border-radius: var(--r-xl);
          padding: 18px;
          box-shadow: var(--shadow);
        ">
          ${renderDashMain()}
        </main>

        <!-- Right -->
        <aside style="
          border:1px solid var(--border);
          background: var(--card);
          border-radius: var(--r-xl);
          padding: 18px;
          box-shadow: var(--shadow2);
        ">
          <div style="font-weight:950;">Quick actions</div>
          <div style="margin-top:10px; display:grid; gap:10px;">
            <button class="btn btn-primary" id="quickPost">Create a post</button>
            <button class="btn btn-ghost" id="quickJobs">Browse jobs</button>
            <button class="btn btn-ghost" id="quickNetwork">Search network</button>
          </div>

          <div style="margin-top:14px; color:var(--muted); line-height:1.7; font-size:13px;">
            Note: Sea time confirmation, peer “served with”, and employer appraisal will support hiring later — but we keep the platform friendly and professional.
          </div>
        </aside>
      </div>
    </div>
  `;

  // responsive grid
  const g = view.querySelector(".dashGrid");
  if (g) {
    const mq = window.matchMedia("(max-width: 1040px)");
    const apply = () => (g.style.gridTemplateColumns = mq.matches ? "1fr" : "340px 1fr 320px");
    apply();
    mq.addEventListener?.("change", apply);
  }

  $("#logoutDash")?.addEventListener("click", signOut);
  $("#goSetup")?.addEventListener("click", () => goto("setup"));
  $("#goProfile")?.addEventListener("click", () => { state.activeTab = "profile"; renderApp(); });

  $("#quickPost")?.addEventListener("click", () => { state.activeTab = "post"; renderApp(); });
  $("#quickJobs")?.addEventListener("click", () => { state.activeTab = "jobs"; renderApp(); });
  $("#quickNetwork")?.addEventListener("click", () => { state.activeTab = "network"; renderApp(); });
}

function renderDashMain() {
  const tab = state.activeTab;

  if (tab === "feed") {
    return `
      <div style="display:flex; align-items:flex-end; justify-content:space-between; gap:10px; flex-wrap:wrap;">
        <div>
          <div style="font-weight:950; font-size:18px;">Feed</div>
          <div style="color:var(--muted); font-size:13px; margin-top:4px;">Community updates</div>
        </div>
      </div>

      <div style="margin-top:14px; color:var(--muted);">
        Feed will show posts here. (You already created tables/policies — next step we connect it cleanly.)
      </div>
    `;
  }

  if (tab === "post") {
    return `
      <div style="font-weight:950; font-size:18px;">Create post</div>
      <div style="color:var(--muted); font-size:13px; margin-top:6px;">Text now. Photos/videos next.</div>

      <div style="margin-top:12px;">
        <textarea id="postText"
          style="width:100%; min-height:120px; padding:12px; border-radius:16px; border:1px solid var(--border); background: rgba(255,255,255,.35); outline:none; color: var(--ink); font-size:14px;"
          placeholder="Write something…"></textarea>

        <div style="display:flex; gap:10px; margin-top:10px; flex-wrap:wrap;">
          <button class="btn btn-ghost" disabled>Add media (next)</button>
          <button class="btn btn-primary" id="postSend">Post</button>
        </div>
      </div>
    `;
  }

  if (tab === "jobs") {
    return `
      <div style="font-weight:950; font-size:18px;">Jobs</div>
      <div style="color:var(--muted); font-size:13px; margin-top:6px;">
        Sea jobs and shore jobs. Filters + keyword search will be added.
      </div>

      <div style="margin-top:12px; padding:12px; border-radius:16px; border:1px solid var(--border); background: rgba(31,111,134,.08); color:var(--muted);">
        UI is ready — we’ll wire real job posting + search next.
      </div>
    `;
  }

  if (tab === "network") {
    return `
      <div style="font-weight:950; font-size:18px;">Network</div>
      <div style="color:var(--muted); font-size:13px; margin-top:6px;">
        Search people and companies by rank, country, company and keywords.
      </div>

      <div style="margin-top:12px; padding:12px; border-radius:16px; border:1px solid var(--border); background: rgba(31,111,134,.08); color:var(--muted);">
        Network search UI will be added next.
      </div>
    `;
  }

  if (tab === "messages") {
    return `
      <div style="font-weight:950; font-size:18px;">Messages</div>
      <div style="color:var(--muted); font-size:13px; margin-top:6px;">
        Fast chat like Instagram — with intro request accept/decline.
      </div>

      <div style="margin-top:12px; padding:12px; border-radius:16px; border:1px solid var(--border); background: rgba(31,111,134,.08); color:var(--muted);">
        Messages will be wired after feed and jobs.
      </div>
    `;
  }

  // profile
  return `
    <div style="font-weight:950; font-size:18px;">Profile</div>
    <div style="color:var(--muted); font-size:13px; margin-top:6px;">
      Documents expiry + sea service will be here (later). Sea service entries will lock after verification approval.
    </div>

    <div style="margin-top:12px; padding:12px; border-radius:16px; border:1px solid var(--border); background: rgba(31,111,134,.08); color:var(--muted);">
      Next step: build profile sections (Documents, Sea Service, Privacy settings).
    </div>
  `;
}

/* Legal pages (short placeholders; you asked simple) */
function renderLegal(kind) {
  const view = $("#view");
  const title =
    kind === "privacy" ? "Privacy Policy" :
    kind === "terms" ? "Terms of Service" :
    kind === "data" ? "Data Usage" :
    "Delete Account";

  const body =
    kind === "privacy" ? `
      We collect only the information you provide to run PEPSVAL (account email and profile details you enter).
      Your content is visible only after login. We do not sell your personal data.
    ` :
    kind === "terms" ? `
      Use PEPSVAL respectfully and professionally. Do not post harmful, illegal, or abusive content.
      You are responsible for what you share. We may suspend accounts that violate these rules.
    ` :
    kind === "data" ? `
      PEPSVAL uses your data to provide features like login, profile, jobs, feed, and messaging.
      We store only what is needed to operate the platform and improve the experience.
    ` :
    `
      You can request account deletion. When deleted, your profile and posts will be removed as required by our policy and applicable laws.
      Contact support to delete your account.
    `;

  view.innerHTML = `
    <div style="max-width:760px;margin:0 auto;">
      <div style="
        border:1px solid var(--border);
        background: var(--card);
        border-radius: var(--r-xl);
        padding: 22px;
        box-shadow: var(--shadow);
      ">
        <div style="font-weight:950; font-size:20px;">${esc(title)}</div>
        <div style="margin-top:10px; color:var(--muted); line-height:1.8;">${esc(body)}</div>

        <div style="margin-top:14px; display:flex; gap:10px; flex-wrap:wrap;">
          <button class="btn btn-ghost" id="backHome">Back</button>
        </div>
      </div>
    </div>
  `;
  $("#backHome")?.addEventListener("click", () => goto("home"));
}

/* Render main */
async function renderApp() {
  renderAuthButtons();
  setTheme(getTheme());

  const { path } = getRoute();
  const mobileNav = $("#mobileNav");

  // Public pages
  if (path === "home") {
    if (mobileNav) mobileNav.style.display = "none";
    return renderHome();
  }
  if (path === "privacy" || path === "terms" || path === "data" || path === "delete") {
    if (mobileNav) mobileNav.style.display = "none";
    return renderLegal(path);
  }
  if (path === "auth") {
    if (mobileNav) mobileNav.style.display = "none";
    return renderAuth();
  }

  // Protected: must be logged in
  if (!state.user) {
    goto("home");
    if (mobileNav) mobileNav.style.display = "none";
    return renderHome();
  }

  // Load profile if needed
  if (!state.profile) state.profile = await fetchMyProfile();

  if (path === "setup") {
    if (mobileNav) mobileNav.style.display = "none";
    return renderSetup();
  }

  // Dashboard
  if (path === "dashboard") {
    // If not complete, go setup (but allow skip)
    if (!profileIsComplete(state.profile)) {
      goto("setup");
      if (mobileNav) mobileNav.style.display = "none";
      return renderSetup();
    }
    return renderDashboard();
  }

  // default route
  if (profileIsComplete(state.profile)) {
    goto("dashboard");
    return renderDashboard();
  } else {
    goto("setup");
    return renderSetup();
  }
}

/* Init */
async function init() {
  mountBase();
  setTheme(getTheme());

  // Load session first
  await loadSession();
  state.profile = state.user ? await fetchMyProfile() : null;

  // Mark splash ready ONLY after we have session+first profile attempt
  splashReady = true;
  hideSplashWhenReady();

  // React to auth changes (including after email confirmation)
  sb.auth.onAuthStateChange(async (_event, session) => {
    state.session = session;
    state.user = session?.user || null;
    state.profile = state.user ? await fetchMyProfile() : null;

    if (state.user) {
      if (profileIsComplete(state.profile)) goto("dashboard");
      else goto("setup");
    } else {
      goto("home");
    }
    renderApp();
  });

  window.addEventListener("hashchange", () => renderApp());

  // Default: ensure route exists
  const { path } = getRoute();
  if (!path) goto("home");

  await renderApp();
}

init();