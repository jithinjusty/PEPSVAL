// --- SPLASH CONTROL (3 seconds) ---
(function splashBoot() {
  const splash = document.getElementById("splash");
  // Always remove splash even if JS later errors
  setTimeout(() => {
    if (!splash) return;
    splash.classList.add("hide");
    setTimeout(() => splash.remove(), 650);
  }, 3000);
})();
/* =========================
   PEPSVAL — app.js (SPA)
   GitHub Pages friendly (hash routing)
   Requires supabase-js loaded in index.html
   ========================= */

/* 1) CONFIG */
const SUPABASE_URL = "https://czlmeehcxrslgfvqjfsb.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN6bG1lZWhjeHJzbGdmdnFqZnNiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc1MzU0NjgsImV4cCI6MjA4MzExMTQ2OH0.vHeIA2n6tm3F3IEoOPBsrIXQ1JXRlhe6bU4VP9b2lek";

if (!window.supabase) {
  alert("Supabase library not loaded. Add supabase-js CDN script in index.html.");
}

const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/* Helpers */
const $ = (sel, root = document) => root.querySelector(sel);
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

function setStatus(msg = "", type = "info") {
  const el = $("#status");
  if (!el) return;
  el.textContent = msg;
  el.className = `status ${type}`;
  el.style.display = msg ? "block" : "none";
}

/* Theme */
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

/* Splash (Instagram-style) */
async function runSplash() {
  const splash = $("#splash");
  if (!splash) return;

  // Show once per browser session
  const seen = sessionStorage.getItem("pepsval_splash_seen");
  if (seen === "1") {
    splash.classList.add("hidden");
    setTimeout(() => splash.remove(), 260);
    return;
  }

  sessionStorage.setItem("pepsval_splash_seen", "1");

  // Keep it visible for 1.2s then fade out quickly
  await new Promise((r) => setTimeout(r, 1200));
  splash.classList.add("hidden");
  setTimeout(() => splash.remove(), 260);
}

/* Routing */
function getRoute() {
  const h = (window.location.hash || "#").replace("#", "");
  const [path, query] = h.split("?");
  const params = new URLSearchParams(query || "");
  return { path: path || "", params };
}
function goto(hash) {
  window.location.hash = hash;
}

/* App state */
const state = {
  session: null,
  user: null,
  profile: null,
};

function profileIsComplete(p) {
  if (!p) return false;
  // For now basic identity
  return Boolean(p.full_name && p.nationality && p.rank && p.dob);
}

/* DB */
async function fetchMyProfile() {
  if (!state.user) return null;
  const { data, error } = await sb
    .from("profiles")
    .select("id, full_name, nationality, rank, dob, avatar_url, updated_at, created_at")
    .eq("id", state.user.id)
    .maybeSingle();
  if (error) return null;
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

/* Auth */
async function loadSession() {
  const { data } = await sb.auth.getSession();
  state.session = data.session || null;
  state.user = data.session?.user || null;
}

async function signUpEmail(email, password) {
  const emailRedirectTo = window.location.origin + window.location.pathname; // GitHub Pages safe
  const { data, error } = await sb.auth.signUp({
    email,
    password,
    options: { emailRedirectTo },
  });
  if (error) throw error;

  if (!data.session) {
    toast("Account created. Check email to confirm, then sign in.", "success");
  } else {
    toast("Signed up & logged in.", "success");
  }
}

async function signInEmail(email, password) {
  const { data, error } = await sb.auth.signInWithPassword({ email, password });
  if (error) throw error;
  state.session = data.session;
  state.user = data.user;
  toast("Logged in ✅", "success");
}

async function signOut() {
  await sb.auth.signOut();
  state.session = null;
  state.user = null;
  state.profile = null;
  toast("Logged out.", "info");
  goto("#");
  renderApp();
}

/* Layout */
function mountBase() {
  const root = $("#app");
  root.innerHTML = `
    <header class="topbar">
      <div class="topbar-inner">
        <div class="brand">
          <img src="logo.webp" alt="PEPSVAL" />
          <div>
            <div class="title">PEPSVAL</div>
            <div class="sub">connect, hire and grow</div>
          </div>
        </div>

        <div class="actions">
          <button class="btn ghost" id="themeBtn">Theme</button>
          <div id="authArea"></div>
        </div>
      </div>
    </header>

    <main class="view" id="view"></main>

    <footer class="footer">
      <div>© ${new Date().getFullYear()} Pepsval</div>
      <div>
        Founder
        <a target="_blank" rel="noreferrer"
          href="https://www.linkedin.com/in/jithinilip?utm_source=share&utm_campaign=share_via&utm_content=profile&utm_medium=android_app">
          JITHIN PHILIP
        </a>
      </div>
    </footer>
  `;

  $("#themeBtn")?.addEventListener("click", () => toggleTheme());
}

function renderAuthArea() {
  const host = $("#authArea");
  if (!host) return;

  if (!state.user) {
    host.innerHTML = `
      <button class="btn ghost" id="goLogin">Sign in</button>
      <button class="btn primary" id="goJoin">Join</button>
    `;
    $("#goLogin")?.addEventListener("click", () => goto("#auth?mode=login"));
    $("#goJoin")?.addEventListener("click", () => goto("#auth?mode=signup"));
  } else {
    host.innerHTML = `
      <button class="btn ghost" id="logoutBtn">Logout</button>
    `;
    $("#logoutBtn")?.addEventListener("click", signOut);
  }
}

/* Views */
function renderLogin(mode = "login") {
  const view = $("#view");

  view.innerHTML = `
    <section class="center">
      <div class="auth-wrap">
        <div class="panel">
          <h1 class="h1">${mode === "signup" ? "Create your account" : "Sign in"}</h1>
          <p class="p">Email + password only. Private-by-login platform.</p>

          <div id="status" class="status"></div>

          <div class="field">
            <label>Email</label>
            <input id="email" class="input" type="email" placeholder="you@example.com" autocomplete="email" />
          </div>

          <div class="field">
            <label>Password</label>
            <input id="password" class="input" type="password" placeholder="••••••••" autocomplete="current-password" />
          </div>

          <div class="row">
            <button class="btn primary" id="submitBtn">
              ${mode === "signup" ? "Create account" : "Login"}
            </button>
            <button class="btn ghost" id="backBtn">Back</button>
          </div>

          <div class="mini">
            ${
              mode === "signup"
                ? `Already have an account? <button class="btn link" id="switchBtn">Sign in</button>`
                : `New to PEPSVAL? <button class="btn link" id="switchBtn">Create an account</button>`
            }
          </div>

          <div class="mini" style="margin-top:10px;">
            By continuing you agree to our
            <a href="#terms" style="color:inherit; font-weight:800;">Terms</a>
            and
            <a href="#privacy" style="color:inherit; font-weight:800;">Privacy Policy</a>.
          </div>
        </div>
      </div>
    </section>
  `;

  $("#backBtn")?.addEventListener("click", () => goto("#"));
  $("#switchBtn")?.addEventListener("click", () => {
    goto(mode === "signup" ? "#auth?mode=login" : "#auth?mode=signup");
    renderApp();
  });

  $("#submitBtn")?.addEventListener("click", async () => {
    const email = ($("#email")?.value || "").trim();
    const password = $("#password")?.value || "";

    if (!email || !password) return setStatus("Enter email and password.", "warn");

    try {
      if (mode === "signup") {
        setStatus("Creating account…", "info");
        await signUpEmail(email, password);
        setStatus("Check your email to confirm. Then sign in.", "success");
        return;
      }

      setStatus("Signing in…", "info");
      await signInEmail(email, password);

      state.profile = await fetchMyProfile();
      if (profileIsComplete(state.profile)) goto("#dashboard");
      else goto("#setup");

      renderApp();
    } catch (e) {
      setStatus(e?.message || "Login failed.", "error");
    }
  });
}

function renderSetup() {
  const view = $("#view");
  const p = state.profile || {};

  view.innerHTML = `
    <section class="center">
      <div class="auth-wrap">
        <div class="panel">
          <h1 class="h1">Profile setup</h1>
          <p class="p">This opens first after login. You can skip now, but profile is needed for full access.</p>

          <div id="status" class="status"></div>

          <div class="field">
            <label>Full name</label>
            <input id="full_name" class="input" type="text" placeholder="e.g., Jithin Philip" value="${esc(p.full_name)}" />
          </div>

          <div class="field">
            <label>Country / Nationality</label>
            <input id="nationality" class="input" type="text" placeholder="e.g., India" value="${esc(p.nationality)}" />
          </div>

          <div class="field">
            <label>Rank</label>
            <input id="rank" class="input" type="text" placeholder="e.g., Second Officer" value="${esc(p.rank)}" />
          </div>

          <div class="field">
            <label>Date of birth</label>
            <input id="dob" class="input" type="date" value="${esc(p.dob)}" />
          </div>

          <div class="row">
            <button class="btn primary" id="saveBtn">Save</button>
            <button class="btn ghost" id="skipBtn">Skip</button>
          </div>

          <div class="mini">
            Note: Sea service becomes locked once any peer/company verification is approved (not editable).
          </div>
        </div>
      </div>
    </section>
  `;

  $("#skipBtn")?.addEventListener("click", () => {
    // still allow dashboard UI, but later we can enforce restrictions
    goto("#dashboard");
    renderApp();
  });

  $("#saveBtn")?.addEventListener("click", async () => {
    try {
      const full_name = ($("#full_name")?.value || "").trim();
      const nationality = ($("#nationality")?.value || "").trim();
      const rank = ($("#rank")?.value || "").trim();
      const dob = $("#dob")?.value || null;

      if (!full_name || !nationality || !rank || !dob) {
        return setStatus("Fill name, nationality, rank, and DOB.", "warn");
      }

      setStatus("Saving…", "info");

      const payload = {
        id: state.user.id,
        full_name,
        nationality,
        rank,
        dob,
        updated_at: new Date().toISOString(),
      };

      state.profile = await upsertMyProfile(payload);

      setStatus("Saved ✅", "success");
      goto("#dashboard");
      renderApp();
    } catch (e) {
      setStatus(e?.message || "Save failed.", "error");
    }
  });
}

function renderDashboard() {
  const view = $("#view");
  const p = state.profile || {};

  view.innerHTML = `
    <div class="dash">
      <div class="panel">
        <h1 class="h1">Welcome</h1>
        <p class="p">
          You are logged in. Next we will build: Feed, Jobs, Network, Messages, Profile — premium UI step-by-step.
        </p>

        <div class="mini">
          <b>Your profile:</b><br/>
          Name: ${esc(p.full_name || "-")}<br/>
          Nationality: ${esc(p.nationality || "-")}<br/>
          Rank: ${esc(p.rank || "-")}<br/>
          DOB: ${esc(p.dob || "-")}
        </div>

        <div class="row" style="margin-top:16px;">
          <button class="btn primary" id="editProfile">Edit profile</button>
          <button class="btn ghost" id="logout2">Logout</button>
        </div>
      </div>
    </div>
  `;

  $("#editProfile")?.addEventListener("click", () => goto("#setup"));
  $("#logout2")?.addEventListener("click", signOut);
}

function renderLegal(kind) {
  const view = $("#view");
  const title = kind === "privacy" ? "Privacy Policy" : "Terms of Service";

  view.innerHTML = `
    <section class="center">
      <div class="auth-wrap">
        <div class="panel">
          <h1 class="h1">${title}</h1>
          <p class="p">Simple version (we can refine later).</p>

          ${
            kind === "privacy"
              ? `
                <div class="mini">
                  We collect only the data you provide (profile details, posts, messages) and account email for login.
                  We use it to run PEPSVAL and improve the service. We don’t sell your personal data.
                  You can request account deletion anytime.
                </div>
              `
              : `
                <div class="mini">
                  By using PEPSVAL, you agree to use it responsibly, provide accurate information, and respect others.
                  You are responsible for content you post. We may suspend accounts that abuse the platform.
                </div>
              `
          }

          <div class="row" style="margin-top:16px;">
            <button class="btn ghost" id="backHome">Back</button>
            <button class="btn primary" id="goAuth">Sign in</button>
          </div>
        </div>
      </div>
    </section>
  `;

  $("#backHome")?.addEventListener("click", () => goto("#"));
  $("#goAuth")?.addEventListener("click", () => goto("#auth?mode=login"));
}

/* Main render */
async function renderApp() {
  setTheme(getTheme());
  renderAuthArea();

  const { path, params } = getRoute();

  // Public pages allowed:
  if (path === "" || path === "privacy" || path === "terms" || path === "auth") {
    if (path === "privacy") return renderLegal("privacy");
    if (path === "terms") return renderLegal("terms");

    if (path === "auth") {
      const mode = params.get("mode") || "login";
      return renderLogin(mode);
    }

    // Home: if logged in, go forward immediately
    if (state.user) {
      state.profile = state.profile || (await fetchMyProfile());
      if (profileIsComplete(state.profile)) goto("#dashboard");
      else goto("#setup");
      return renderApp();
    }

    // If not logged in, show login directly (premium flow)
    return renderLogin("login");
  }

  // Everything else requires login
  if (!state.user) {
    goto("#auth?mode=login");
    return renderLogin("login");
  }

  // Load profile
  if (!state.profile) state.profile = await fetchMyProfile();

  if (path === "setup") return renderSetup();
  if (path === "dashboard") return renderDashboard();

  // Default after login: profile setup first (with skip)
  goto("#setup");
  return renderSetup();
}

/* Init */
async function init() {
  mountBase();
  await runSplash();

  await loadSession();
  state.profile = state.user ? await fetchMyProfile() : null;

  sb.auth.onAuthStateChange(async (_event, session) => {
    state.session = session;
    state.user = session?.user || null;
    state.profile = state.user ? await fetchMyProfile() : null;
    renderApp();
  });

  window.addEventListener("hashchange", () => renderApp());
  renderApp();
}

init();