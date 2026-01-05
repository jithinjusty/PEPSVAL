/* =========================
   PEPSVAL — app.js (SPA)
   Works on GitHub Pages (hash routing)
   Requires supabase-js loaded in index.html:
   <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
   ========================= */

/* 1) CONFIG — set these */
const SUPABASE_URL = "https://czlmeehcxrslgfvqjfsb.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN6bG1lZWhjeHJzbGdmdnFqZnNiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc1MzU0NjgsImV4cCI6MjA4MzExMTQ2OH0.vHeIA2n6tm3F3IEoOPBsrIXQ1JXRlhe6bU4VP9b2lek";

/* 2) OPTIONAL: bucket name for profile pics */
const AVATAR_BUCKET = "avatars";

/* ------------------------------------------ */

if (!window.supabase) {
  alert("Supabase library not loaded. Add supabase-js CDN script in index.html.");
}
const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/* UI helpers */
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
const esc = (s) =>
  String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

function setStatus(msg = "", type = "info") {
  const el = $("#status");
  if (!el) return;
  el.textContent = msg;
  el.className = `status ${type}`;
  el.style.display = msg ? "block" : "none";
}

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
  }, 2800);
}

/* Theme */
function getTheme() {
  return localStorage.getItem("pepsval_theme") || "light";
}
function setTheme(theme) {
  localStorage.setItem("pepsval_theme", theme);
  document.documentElement.dataset.theme = theme;
  const btn = $("#themeToggle");
  if (btn) btn.textContent = theme === "dark" ? "Light" : "Dark";
}
function toggleTheme() {
  setTheme(getTheme() === "dark" ? "light" : "dark");
}

/* PWA install */
let deferredInstallPrompt = null;
window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  deferredInstallPrompt = e;
  showInstallCTA(true);
});
function showInstallCTA(show) {
  const btn = $("#installBtn");
  if (btn) btn.style.display = show ? "inline-flex" : "none";
}
async function handleInstall() {
  if (!deferredInstallPrompt) {
    toast("Install prompt not available on this device/browser.", "info");
    return;
  }
  deferredInstallPrompt.prompt();
  const res = await deferredInstallPrompt.userChoice;
  deferredInstallPrompt = null;
  showInstallCTA(false);
  if (res?.outcome === "accepted") toast("Installed!", "success");
}

/* App state */
const state = {
  session: null,
  user: null,
  profile: null,
  activeTab: "home", // dashboard tab
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
    .select("id, full_name, nationality, rank, dob, avatar_url, updated_at, created_at")
    .eq("id", state.user.id)
    .maybeSingle();

  if (error) {
    console.error("fetchMyProfile error:", error);
    return null;
  }
  return data || null;
}

async function upsertMyProfile(payload) {
  // payload MUST include id = auth.uid()
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
  // Make a stable path per user
  const ext = (file.name.split(".").pop() || "png").toLowerCase();
  const path = `${userId}/avatar.${ext}`;

  const { error: upErr } = await sb.storage
    .from(AVATAR_BUCKET)
    .upload(path, file, { upsert: true, cacheControl: "3600" });

  if (upErr) {
    // If bucket not configured, ignore (don’t block)
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
  setStatus("", "info");
  const emailRedirectTo = window.location.origin + window.location.pathname; // GitHub Pages safe
  const { data, error } = await sb.auth.signUp({
    email,
    password,
    options: { emailRedirectTo },
  });
  if (error) throw error;

  // If email confirmation ON, session may be null until confirmed
  if (!data.session) {
    toast("Account created. Please check your email to confirm, then login.", "success");
  } else {
    toast("Signed up & logged in.", "success");
  }
}

async function signInEmail(email, password) {
  setStatus("", "info");
  const { data, error } = await sb.auth.signInWithPassword({ email, password });
  if (error) throw error;
  state.session = data.session;
  state.user = data.user;
  toast("Logged in successfully.", "success");
}

async function signOut() {
  await sb.auth.signOut();
  state.session = null;
  state.user = null;
  state.profile = null;
  toast("Logged out.", "info");
  window.location.hash = "#home";
  renderApp();
}

/* Routing */
function getRoute() {
  const h = (window.location.hash || "#home").replace("#", "");
  const [path, query] = h.split("?");
  const params = new URLSearchParams(query || "");
  return { path: path || "home", params };
}

function goto(hash) {
  window.location.hash = hash;
}

/* Layout */
function mountBase() {
  // One-time base shell
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
          <div class="brand-sub">Maritime network for careers and jobs</div>
        </div>
      </div>

      <div class="topbar-actions">
        <button id="installBtn" class="btn btn-ghost" style="display:none;">Install</button>
        <button id="themeToggle" class="btn btn-ghost">Dark</button>
        <div id="authButtons"></div>
      </div>
    </header>

    <main id="view" class="view"></main>

    <nav id="mobileNav" class="mobile-nav" style="display:none;">
      <button data-tab="home" class="mnav-btn">
        <span class="mnav-ico">🏠</span><span>Home</span>
      </button>
      <button data-tab="jobs" class="mnav-btn">
        <span class="mnav-ico">🧭</span><span>Jobs</span>
      </button>
      <button data-tab="post" class="mnav-btn">
        <span class="mnav-ico">➕</span><span>Post</span>
      </button>
      <button data-tab="network" class="mnav-btn">
        <span class="mnav-ico">👥</span><span>Network</span>
      </button>
      <button data-tab="me" class="mnav-btn">
        <span class="mnav-ico">🙂</span><span>Me</span>
      </button>
    </nav>

    <footer class="footer">
      <div>© ${new Date().getFullYear()} Pepsval. All rights reserved.</div>
      <div class="footer-right">Founder <a href="https://www.linkedin.com/in/jithinilip?utm_source=share&utm_campaign=share_via&utm_content=profile&utm_medium=android_app" target="_blank" rel="noreferrer">JITHIN PHILIP</a></div>
    </footer>
  `;

  $("#themeToggle")?.addEventListener("click", toggleTheme);
  $("#installBtn")?.addEventListener("click", handleInstall);

  $("#mobileNav")?.addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-tab]");
    if (!btn) return;
    state.activeTab = btn.dataset.tab;
    renderApp();
  });
}

function renderAuthButtons() {
  const host = $("#authButtons");
  if (!host) return;

  if (!state.user) {
    host.innerHTML = `
      <button class="btn btn-ghost" id="btnLogin">Sign in</button>
      <button class="btn btn-primary" id="btnJoin">Join</button>
    `;
    $("#btnLogin")?.addEventListener("click", () => goto("#auth&mode=login"));
    $("#btnJoin")?.addEventListener("click", () => goto("#auth&mode=signup"));
  } else {
    host.innerHTML = `
      <button class="btn btn-ghost" id="btnLogout">Logout</button>
    `;
    $("#btnLogout")?.addEventListener("click", signOut);
  }
}

/* Views */
function renderLanding() {
  const view = $("#view");
  view.innerHTML = `
    <section class="hero">
      <div class="hero-left">
        <h1>Explore maritime jobs<br/>and grow your professional network</h1>
        <p class="hero-sub">
          Sea jobs • Shore jobs • Companies • Agencies • Training • Marine services — all in one place.
        </p>

        <div class="auth-card">
          <div class="auth-card-tabs">
            <button class="tab-btn active">Sign in</button>
            <button class="tab-btn" id="goJoin">Join</button>
          </div>

          <div class="auth-card-body">
            <button class="btn btn-wide btn-muted" disabled>Continue with Google (coming later)</button>
            <button class="btn btn-wide btn-muted" disabled>Continue with Microsoft (coming later)</button>
            <button class="btn btn-wide btn-primary" id="goEmail">Sign in with email</button>

            <div class="auth-legal">
              By continuing, you agree to our <a href="#terms">Terms</a> and <a href="#privacy">Privacy Policy</a>.
            </div>
          </div>
        </div>

        <div class="chips">
          <span class="chip">SEA JOBS</span>
          <span class="chip">SHORE JOBS</span>
          <span class="chip">COMPANIES</span>
          <span class="chip">AGENCIES</span>
          <span class="chip">MARINE SERVICES</span>
        </div>

        <div class="feature-cards">
          <div class="card">
            <div class="card-title">Find the right role</div>
            <div class="card-sub">2/O • 3/O • C/E • Master • ETO • Shore Ops</div>
          </div>
          <div class="card">
            <div class="card-title">Hire with confidence</div>
            <div class="card-sub">Better profiles — hiring tools come next</div>
          </div>
          <div class="card">
            <div class="card-title">Build your network</div>
            <div class="card-sub">Connect across the maritime industry</div>
          </div>
        </div>
      </div>

      <div class="hero-right">
        <div class="hero-art">
          <div class="glow"></div>
          <div class="hero-art-inner">
            <div class="art-title">Maritime Trust Layer</div>
            <div class="art-sub">A friendly network for sea & shore careers.</div>
            <div class="art-grid">
              <div class="art-box">Jobs</div>
              <div class="art-box">People</div>
              <div class="art-box">Companies</div>
              <div class="art-box">Posts</div>
            </div>
            <div class="art-note">Install PEPSVAL as an app for a faster experience.</div>
          </div>
        </div>
      </div>
    </section>

    <section class="below">
      <div class="below-grid">
        <div class="below-card">
          <div class="below-title">Maritime Jobs</div>
          <div class="below-sub">Browse sea & shore roles posted by companies and agencies.</div>
          <button class="btn btn-ghost" onclick="location.hash='#auth&mode=login'">Explore jobs</button>
        </div>

        <div class="below-card">
          <div class="below-title">Professional Network</div>
          <div class="below-sub">Connect with seafarers, recruiters, training centers & service providers.</div>
          <button class="btn btn-ghost" onclick="location.hash='#auth&mode=signup'">Discover people</button>
        </div>

        <div class="below-card">
          <div class="below-title">Install the App</div>
          <div class="below-sub">Add PEPSVAL to your home screen for faster access.</div>
          <div class="below-sub small">On iPhone: Share → “Add to Home Screen”.</div>
        </div>
      </div>
    </section>
  `;

  $("#goEmail")?.addEventListener("click", () => goto("#auth&mode=login"));
  $("#goJoin")?.addEventListener("click", () => goto("#auth&mode=signup"));

  // If install prompt already captured
  showInstallCTA(Boolean(deferredInstallPrompt));
}

function renderAuth() {
  const view = $("#view");
  const route = getRoute();
  const mode = route.params.get("mode") || "login";

  view.innerHTML = `
    <section class="center">
      <div class="panel">
        <h2>${mode === "signup" ? "Create your PEPSVAL account" : "Sign in to PEPSVAL"}</h2>
        <p class="muted">
          Email + password only. Email confirmation is ON (production style).
        </p>

        <div id="status" class="status" style="display:none;"></div>

        <label class="field">
          <span>Email</span>
          <input id="email" type="email" placeholder="you@example.com" autocomplete="email" />
        </label>

        <label class="field">
          <span>Password</span>
          <input id="password" type="password" placeholder="••••••••" autocomplete="current-password" />
        </label>

        <div class="row">
          <button class="btn btn-primary" id="btnSubmit">
            ${mode === "signup" ? "Create account" : "Login"}
          </button>
          <button class="btn btn-ghost" id="btnBack">Back</button>
        </div>

        <div class="row small">
          <button class="link" id="switchMode">
            ${mode === "signup" ? "Already have an account? Sign in" : "New here? Create an account"}
          </button>
        </div>

        <div class="row small">
          <button class="link" id="forgot">Forgot password?</button>
        </div>
      </div>
    </section>
  `;

  $("#btnBack")?.addEventListener("click", () => goto("#home"));
  $("#switchMode")?.addEventListener("click", () =>
    goto(mode === "signup" ? "#auth&mode=login" : "#auth&mode=signup")
  );

  $("#btnSubmit")?.addEventListener("click", async () => {
    const email = ($("#email")?.value || "").trim();
    const password = $("#password")?.value || "";

    if (!email || !password) {
      setStatus("Please enter email and password.", "warn");
      return;
    }

    try {
      if (mode === "signup") {
        setStatus("Creating account…", "info");
        await signUpEmail(email, password);
        setStatus("If email confirmation is enabled, check your inbox and confirm. Then login.", "success");
      } else {
        setStatus("Signing in…", "info");
        await signInEmail(email, password);

        // after login, decide route
        state.profile = await fetchMyProfile();
        if (profileIsComplete(state.profile)) {
          goto("#dashboard");
        } else {
          goto("#setup");
        }
        renderApp();
      }
    } catch (e) {
      console.error(e);
      setStatus(e.message || "Something went wrong.", "error");
    }
  });

  $("#forgot")?.addEventListener("click", async () => {
    const email = ($("#email")?.value || "").trim();
    if (!email) return setStatus("Enter your email first, then tap Forgot password.", "warn");
    try {
      const redirectTo = window.location.origin + window.location.pathname;
      const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo });
      if (error) throw error;
      setStatus("Password reset email sent (check inbox/spam).", "success");
    } catch (e) {
      setStatus(e.message || "Could not send reset email.", "error");
    }
  });
}

function renderSetup() {
  const view = $("#view");
  const p = state.profile || {};

  view.innerHTML = `
    <section class="center">
      <div class="panel wide">
        <h2>Profile setup</h2>
        <p class="muted">Fill your basic details once. After saving, you’ll enter your dashboard.</p>

        <div id="status" class="status" style="display:none;"></div>

        <div class="grid2">
          <label class="field">
            <span>Full name</span>
            <input id="full_name" type="text" placeholder="e.g., Jithin Philip" value="${esc(p.full_name)}" />
          </label>

          <label class="field">
            <span>Nationality</span>
            <input id="nationality" type="text" placeholder="e.g., Indian" value="${esc(p.nationality)}" />
          </label>

          <label class="field">
            <span>Rank</span>
            <input id="rank" type="text" placeholder="e.g., Second Officer" value="${esc(p.rank)}" />
          </label>

          <label class="field">
            <span>Date of birth</span>
            <input id="dob" type="date" value="${esc(p.dob)}" />
          </label>
        </div>

        <label class="field">
          <span>Profile picture (optional)</span>
          <input id="avatar" type="file" accept="image/*" />
          <div class="muted small">
            If avatar upload is not configured yet, your details still save and you can add photo later.
          </div>
        </label>

        <div class="row">
          <button class="btn btn-primary" id="saveContinue">Save & Continue</button>
          <button class="btn btn-ghost" id="logout2">Logout</button>
        </div>
      </div>
    </section>
  `;

  $("#logout2")?.addEventListener("click", signOut);

  $("#saveContinue")?.addEventListener("click", async () => {
    try {
      setStatus("", "info");
      const full_name = ($("#full_name")?.value || "").trim();
      const nationality = ($("#nationality")?.value || "").trim();
      const rank = ($("#rank")?.value || "").trim();
      const dob = $("#dob")?.value || null;

      if (!full_name || !nationality || !rank || !dob) {
        setStatus("Please fill full name, nationality, rank and date of birth.", "warn");
        return;
      }

      setStatus("Saving…", "info");

      // Upload avatar if possible
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

      const saved = await upsertMyProfile(payload);
      state.profile = saved;

      setStatus("Saved successfully.", "success");

      // ✅ IMPORTANT: redirect to dashboard
      window.location.hash = "#dashboard";
      state.activeTab = "home";
      renderApp();
    } catch (e) {
      console.error(e);
      setStatus(e.message || "Save failed.", "error");
    }
  });
}

function renderDashboard() {
  const view = $("#view");
  const p = state.profile || {};
  const tab = state.activeTab || "home";

  // show mobile nav only for dashboard
  $("#mobileNav").style.display = "flex";
  highlightMobileTab(tab);

  view.innerHTML = `
    <section class="dash">
      <aside class="dash-left">
        <div class="profile-card">
          <div class="avatar">
            ${
              p.avatar_url
                ? `<img src="${esc(p.avatar_url)}" alt="avatar" />`
                : `<div class="avatar-fallback">${esc((p.full_name || "P")[0] || "P")}</div>`
            }
          </div>
          <div class="pc-name">${esc(p.full_name || "Your name")}</div>
          <div class="pc-sub">${esc(p.rank || "")}${p.rank && p.nationality ? " • " : ""}${esc(p.nationality || "")}</div>
          <div class="pc-sub small">${p.dob ? `DOB: ${esc(p.dob)}` : ""}</div>

          <div class="pc-actions">
            <button class="btn btn-ghost" id="editProfileBtn">Edit profile</button>
            <button class="btn btn-ghost" id="logoutDash">Logout</button>
          </div>
        </div>

        <div class="side-nav">
          <button class="side-btn ${tab === "home" ? "active" : ""}" data-tab="home">Home feed</button>
          <button class="side-btn ${tab === "jobs" ? "active" : ""}" data-tab="jobs">Jobs</button>
          <button class="side-btn ${tab === "post" ? "active" : ""}" data-tab="post">Create post</button>
          <button class="side-btn ${tab === "network" ? "active" : ""}" data-tab="network">Network</button>
          <button class="side-btn ${tab === "me" ? "active" : ""}" data-tab="me">Me</button>
        </div>
      </aside>

      <section class="dash-main">
        ${renderDashTab(tab, p)}
      </section>

      <aside class="dash-right">
        <div class="mini-card">
          <div class="mini-title">Install PEPSVAL</div>
          <div class="mini-sub">Use it like an app — faster and cleaner on mobile.</div>
          <button class="btn btn-primary" id="installBtn2">Install</button>
          <div class="mini-sub small">On iPhone: Share → “Add to Home Screen”.</div>
        </div>

        <div class="mini-card">
          <div class="mini-title">What’s next</div>
          <div class="mini-sub">Documents, sea service, and hiring tools will be added step-by-step.</div>
        </div>
      </aside>
    </section>
  `;

  $("#logoutDash")?.addEventListener("click", signOut);
  $("#editProfileBtn")?.addEventListener("click", () => {
    state.activeTab = "me";
    renderApp();
  });

  $("#installBtn2")?.addEventListener("click", handleInstall);

  $$(".side-btn").forEach((b) => {
    b.addEventListener("click", () => {
      state.activeTab = b.dataset.tab;
      renderApp();
    });
  });

  showInstallCTA(Boolean(deferredInstallPrompt));
}

function renderDashTab(tab, p) {
  if (tab === "home") {
    return `
      <div class="panel-lite">
        <h2>Home feed</h2>
        <p class="muted">
          This is a clean feed layout. Next step will be real posts (photos/videos) saved to database.
        </p>

        <div class="feed">
          ${fakePost("Maritime life", "Share moments from sea & shore.")}
          ${fakePost("New opportunities", "Companies and agencies will post jobs here.")}
          ${fakePost("Connections", "Build your professional maritime network.")}
        </div>
      </div>
    `;
  }

  if (tab === "jobs") {
    return `
      <div class="panel-lite">
        <h2>Jobs</h2>
        <p class="muted">Jobs database will be wired next. For now the UI is ready.</p>
        <div class="jobs">
          ${fakeJob("Second Officer — Container", "Singapore • 4 months • ASAP")}
          ${fakeJob("Chief Engineer — Bulk", "Middle East • 6 months")}
          ${fakeJob("Shore Ops — Port Captain", "Dublin • Full time")}
        </div>
      </div>
    `;
  }

  if (tab === "post") {
    return `
      <div class="panel-lite">
        <h2>Create a post</h2>
        <p class="muted">Posting will be enabled after we add the posts table + storage bucket.</p>

        <div class="post-box">
          <textarea placeholder="Share an update…" disabled></textarea>
          <div class="row">
            <button class="btn btn-muted" disabled>Add photo/video</button>
            <button class="btn btn-muted" disabled>Post</button>
          </div>
        </div>

        <div class="muted small">
          We will not show non-working features in the final version. We’ll enable this only when database is ready.
        </div>
      </div>
    `;
  }

  if (tab === "network") {
    return `
      <div class="panel-lite">
        <h2>Network</h2>
        <p class="muted">This is where people discovery and connections will live.</p>

        <div class="grid-cards">
          ${fakePerson("Recruiter • Agency", "Hiring for tankers")}
          ${fakePerson("Second Officer", "Looking for next contract")}
          ${fakePerson("Training Center", "Courses & certifications")}
        </div>
      </div>
    `;
  }

  // tab === "me"
  return `
    <div class="panel-lite">
      <h2>Your profile</h2>
      <p class="muted">Edit your basic profile now. Documents and sea service will be added later.</p>

      <div class="kv">
        <div><span>Name</span><b>${esc(p.full_name || "-")}</b></div>
        <div><span>Nationality</span><b>${esc(p.nationality || "-")}</b></div>
        <div><span>Rank</span><b>${esc(p.rank || "-")}</b></div>
        <div><span>DOB</span><b>${esc(p.dob || "-")}</b></div>
      </div>

      <div class="row">
        <button class="btn btn-primary" onclick="location.hash='#setup'">Edit basics</button>
      </div>
    </div>
  `;
}

/* fake UI blocks */
function fakePost(title, body) {
  return `
    <div class="feed-item">
      <div class="fi-top">
        <div class="fi-avatar">P</div>
        <div>
          <div class="fi-title">${esc(title)}</div>
          <div class="fi-sub">PEPSVAL • just now</div>
        </div>
      </div>
      <div class="fi-body">${esc(body)}</div>
      <div class="fi-actions">
        <button class="btn btn-ghost" disabled>Like</button>
        <button class="btn btn-ghost" disabled>Comment</button>
        <button class="btn btn-ghost" disabled>Share</button>
      </div>
    </div>
  `;
}
function fakeJob(role, meta) {
  return `
    <div class="job-item">
      <div class="job-role">${esc(role)}</div>
      <div class="job-meta">${esc(meta)}</div>
      <button class="btn btn-ghost" disabled>View</button>
    </div>
  `;
}
function fakePerson(title, sub) {
  return `
    <div class="p-card">
      <div class="p-ico">👤</div>
      <div class="p-title">${esc(title)}</div>
      <div class="p-sub">${esc(sub)}</div>
      <button class="btn btn-ghost" disabled>Connect</button>
    </div>
  `;
}

/* Mobile nav active */
function highlightMobileTab(tab) {
  $$("#mobileNav .mnav-btn").forEach((b) => {
    b.classList.toggle("active", b.dataset.tab === tab);
  });
}

/* Main render */
async function renderApp() {
  renderAuthButtons();

  // Theme
  setTheme(getTheme());

  const { path } = getRoute();

  // If not on dashboard, hide mobile nav
  if (path !== "dashboard") $("#mobileNav").style.display = "none";

  // Public routes
  if (path === "home" || path === "terms" || path === "privacy") {
    if (path === "home") return renderLanding();
    const view = $("#view");
    view.innerHTML = `
      <section class="center">
        <div class="panel">
          <h2>${path === "terms" ? "Terms" : "Privacy Policy"}</h2>
          <p class="muted">Draft page. We can write proper legal text later.</p>
          <button class="btn btn-ghost" onclick="location.hash='#home'">Back</button>
        </div>
      </section>
    `;
    return;
  }

  // Auth route
  if (path.startsWith("auth")) {
    return renderAuth();
  }

  // Protected routes
  if (!state.user) {
    goto("#home");
    return renderLanding();
  }

  // Load profile once (or refresh if missing)
  if (!state.profile) {
    state.profile = await fetchMyProfile();
  }

  if (path === "setup") {
    return renderSetup();
  }

  if (path === "dashboard") {
    // If profile not complete, force setup
    if (!profileIsComplete(state.profile)) {
      goto("#setup");
      return renderSetup();
    }
    return renderDashboard();
  }

  // Default protected: redirect
  if (profileIsComplete(state.profile)) {
    goto("#dashboard");
    return renderDashboard();
  } else {
    goto("#setup");
    return renderSetup();
  }
}

/* Init */
async function init() {
  mountBase();
  setTheme(getTheme());

  await loadSession();
  state.profile = state.user ? await fetchMyProfile() : null;

  // Auth state changes
  sb.auth.onAuthStateChange(async (_event, session) => {
    state.session = session;
    state.user = session?.user || null;
    state.profile = state.user ? await fetchMyProfile() : null;

    // If user just logged in from email confirm redirect, decide route
    if (state.user) {
      if (profileIsComplete(state.profile)) {
        goto("#dashboard");
      } else {
        goto("#setup");
      }
    } else {
      goto("#home");
    }
    renderApp();
  });

  window.addEventListener("hashchange", () => renderApp());

  renderApp();
}

init();
