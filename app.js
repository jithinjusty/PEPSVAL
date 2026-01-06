/* =========================
   PEPSVAL — CLEAN SPA (GitHub Pages)
   - Hash routing
   - 3s underwater animated splash
   - Email + password auth
   - Username (unique) + basic profile
   ========================= */

/* 1) SUPABASE CONFIG */
const SUPABASE_URL = "https://czlmeehcxrslgfvqjfsb.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN6bG1lZWhjeHJzbGdmdnFqZnNiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc1MzU0NjgsImV4cCI6MjA4MzExMTQ2OH0.vHeIA2n6tm3F3IEoOPBsrIXQ1JXRlhe6bU4VP9b2lek";

/* 2) HELPERS */
const $ = (s, r = document) => r.querySelector(s);
const esc = (s) =>
  String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

function route() {
  const raw = (location.hash || "#/").slice(1);
  const [path, qs] = raw.split("?");
  return { path: path || "/", qs: new URLSearchParams(qs || "") };
}
function go(hashPath) {
  location.hash = `#${hashPath}`;
}

function showSplashFor(ms = 3000) {
  const splash = document.getElementById("splash");
  if (!splash) return;
  setTimeout(() => {
    splash.classList.add("hide");
    setTimeout(() => splash.remove(), 650);
  }, ms);
}

/* 3) INIT SUPABASE */
let sb = null;
function mustSupabase() {
  if (!window.supabase) {
    return {
      ok: false,
      msg:
        "Supabase library not loaded. Check index.html includes the supabase-js CDN script ABOVE app.js.",
    };
  }
  sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  return { ok: true };
}

/* 4) APP STATE */
const state = {
  session: null,
  user: null,
  profile: null,
  activeTab: "feed",
};

/* 5) DB: PROFILES */
async function fetchMyProfile() {
  if (!state.user) return null;

  // Select only columns we expect (safe)
  const { data, error } = await sb
    .from("profiles")
    .select("id, username, full_name, nationality, rank, dob, avatar_url, updated_at, created_at")
    .eq("id", state.user.id)
    .maybeSingle();

  if (error) throw error;
  return data || null;
}

function profileComplete(p) {
  // require username + basics
  return Boolean(p?.username && p?.full_name && p?.nationality && p?.rank && p?.dob);
}

function normalizeUsername(u) {
  return (u || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[^a-z0-9._]/g, "");
}

async function usernameAvailable(username) {
  const u = normalizeUsername(username);
  if (!u) return { ok: false, msg: "Enter a username." };
  if (!/^[a-z][a-z0-9._]{2,19}$/.test(u)) {
    return { ok: false, msg: "Use 3–20 chars. Start with a letter. Only a-z 0-9 . _" };
  }

  const { data, error } = await sb
    .from("profiles")
    .select("id, username")
    .eq("username", u)
    .limit(1);

  if (error) throw error;

  // If username exists but belongs to me, it's fine
  if (data?.length && data[0].id !== state.user.id) {
    return { ok: false, msg: "Username already taken." };
  }
  return { ok: true, msg: "Username available ✅", username: u };
}

async function saveMyProfile(payload) {
  // payload must include id
  const { data, error } = await sb
    .from("profiles")
    .upsert(payload, { onConflict: "id" })
    .select()
    .maybeSingle();
  if (error) throw error;
  return data;
}

/* 6) DB: FEED POSTS (authenticated users only) */
async function fetchFeed(limit = 30) {
  const { data, error } = await sb
    .from("feed_posts")
    .select("id, user_id, content, created_at")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data || [];
}

async function createPost(text) {
  const content = (text || "").trim();
  if (!content) throw new Error("Write something first.");
  const { error } = await sb.from("feed_posts").insert({ user_id: state.user.id, content });
  if (error) throw error;
}

/* 7) AUTH */
async function loadSession() {
  const { data, error } = await sb.auth.getSession();
  if (error) throw error;
  state.session = data.session || null;
  state.user = data.session?.user || null;
}

async function signUp(email, password) {
  const emailRedirectTo = location.origin + location.pathname;
  const { data, error } = await sb.auth.signUp({
    email,
    password,
    options: { emailRedirectTo },
  });
  if (error) throw error;
  return data;
}

async function signIn(email, password) {
  const { data, error } = await sb.auth.signInWithPassword({ email, password });
  if (error) throw error;
  state.session = data.session;
  state.user = data.user;
}

async function signOut() {
  await sb.auth.signOut();
  state.session = null;
  state.user = null;
  state.profile = null;
  state.activeTab = "feed";
  go("/"); // back home
  render();
}

/* 8) UI LAYOUT */
function shellHTML() {
  return `
  <div class="shell">
    <header class="topbar">
      <div class="topbar-inner">
        <div class="brand" role="button" tabindex="0" onclick="location.hash='#/'">
          <img src="logo.webp" alt="logo" />
          <div>
            <span class="name">PEPSVAL</span>
            <span class="badge">BETA</span>
          </div>
        </div>

        <div class="actions" id="actions"></div>
      </div>
    </header>

    <main class="container" id="view"></main>

    <footer class="footer">
      © ${new Date().getFullYear()} Pepsval •
      Founder <a href="https://www.linkedin.com/in/jithinilip?utm_source=share&utm_campaign=share_via&utm_content=profile&utm_medium=android_app" target="_blank" rel="noreferrer">JITHIN PHILIP</a>
    </footer>
  </div>`;
}

function setActions() {
  const host = $("#actions");
  if (!host) return;

  if (!state.user) {
    host.innerHTML = `
      <button class="btn ghost" id="aSignIn">Sign in</button>
      <button class="btn primary" id="aJoin">Join</button>
    `;
    $("#aSignIn").onclick = () => go("/auth?mode=login");
    $("#aJoin").onclick = () => go("/auth?mode=signup");
  } else {
    host.innerHTML = `
      <button class="btn ghost" id="aLogout">Logout</button>
    `;
    $("#aLogout").onclick = signOut;
  }
}

function viewHome() {
  const v = $("#view");
  v.innerHTML = `
    <div class="grid">
      <div class="card">
        <div class="pad">
          <h1 class="h1">A private-by-login<br/>maritime network</h1>
          <p class="p">
            Connect with seafarers, employers and shore professionals — jobs, updates and messages in one place.
          </p>

          <div class="divider"></div>

          <div class="row">
            <button class="btn primary" id="homeJoin">Join</button>
            <button class="btn" id="homeSignIn">Sign in</button>
          </div>

          <div class="note">
            Content is visible only after login.
          </div>
        </div>
      </div>

      <div class="card">
        <div class="pad">
          <div class="tabs">
            <div class="tab active">What’s inside</div>
          </div>

          <div class="divider"></div>

          <div class="note">• Feed (text posts now, media later)</div>
          <div class="note">• Jobs (sea + shore)</div>
          <div class="note">• Network + Messaging (next)</div>
          <div class="note">• Verified sea service (planned)</div>

          <div class="divider"></div>

          <div class="note">
            Note: Sea service entries become locked (not editable) once any peer/employer verification is approved.
          </div>
        </div>
      </div>
    </div>
  `;

  $("#homeJoin").onclick = () => go("/auth?mode=signup");
  $("#homeSignIn").onclick = () => go("/auth?mode=login");
}

function viewAuth() {
  const v = $("#view");
  const r = route();
  const mode = r.qs.get("mode") === "signup" ? "signup" : "login";

  v.innerHTML = `
    <div class="grid">
      <div class="card">
        <div class="pad">
          <h1 class="h1">${mode === "signup" ? "Create account" : "Welcome back"}</h1>
          <p class="p">Email + password only. Clean & fast.</p>
          <div id="authStatus" class="status" style="display:none;"></div>

          <div class="field">
            <label>Email</label>
            <input class="input" id="email" type="email" placeholder="you@example.com" autocomplete="email" />
          </div>

          <div class="field">
            <label>Password</label>
            <input class="input" id="password" type="password" placeholder="••••••••" autocomplete="current-password" />
          </div>

          <div class="row">
            <button class="btn primary" id="doAuth">${mode === "signup" ? "Join" : "Sign in"}</button>
            <button class="btn" id="backHome">Back</button>
          </div>

          <div class="row">
            <button class="btn ghost" id="switchMode">
              ${mode === "signup" ? "Already have an account? Sign in" : "New here? Create an account"}
            </button>
          </div>

          <div class="note">
            If email confirmation is enabled in Supabase, you must confirm email before login.
          </div>
        </div>
      </div>

      <div class="card">
        <div class="pad">
          <div class="tabs"><div class="tab active">Quick rules</div></div>
          <div class="divider"></div>
          <div class="note">• Username is unique (like Instagram).</div>
          <div class="note">• You can change username later.</div>
          <div class="note">• Non-logged users should not see posts (RLS).</div>
        </div>
      </div>
    </div>
  `;

  const status = $("#authStatus");
  const setStatus = (msg, type = "") => {
    status.style.display = msg ? "block" : "none";
    status.className = `status ${type}`;
    status.textContent = msg || "";
  };

  $("#backHome").onclick = () => go("/");
  $("#switchMode").onclick = () => go(`/auth?mode=${mode === "signup" ? "login" : "signup"}`);

  $("#doAuth").onclick = async () => {
    const email = ($("#email").value || "").trim();
    const password = $("#password").value || "";
    if (!email || !password) return setStatus("Enter email and password.", "warn");

    try {
      setStatus(mode === "signup" ? "Creating account…" : "Signing in…");
      if (mode === "signup") {
        const res = await signUp(email, password);
        // session may be null when email confirmation is required
        setStatus(
          res?.session
            ? "Account created and logged in ✅"
            : "Account created ✅ Check email and confirm, then sign in.",
          "ok"
        );
     } else {
        await signIn(email, password);
        state.profile = await fetchMyProfile();
        if (profileComplete(state.profile)) go("/app");
        else go("/setup");
        render();
      }
    } catch (e) {
      setStatus(e?.message || "Auth failed.", "err");
    }
  };
}

function viewSetup() {
  const v = $("#view");
  const p = state.profile || {};

  v.innerHTML = `
    <div class="card">
      <div class="pad">
        <h1 class="h1">Profile setup</h1>
        <p class="p">Set your username + basics. You can update later.</p>

        <div id="setupStatus" class="status" style="display:none;"></div>

        <div class="field">
          <label>Username (unique)</label>
          <input class="input" id="username" placeholder="e.g. jithinphilip" value="${esc(p.username || "")}" />
          <div class="row">
            <button class="btn" id="checkU">Check availability</button>
            <span class="note" id="uHint">3–20 chars • start with letter • a-z 0-9 . _</span>
          </div>
        </div>

        <div class="field">
          <label>Full name</label>
          <input class="input" id="full_name" placeholder="e.g. Jithin Philip" value="${esc(p.full_name || "")}" />
        </div>

        <div class="field">
          <label>Country / Nationality</label>
          <input class="input" id="nationality" placeholder="e.g. India" value="${esc(p.nationality || "")}" />
        </div>

        <div class="field">
          <label>Rank</label>
          <input class="input" id="rank" placeholder="e.g. Second Officer" value="${esc(p.rank || "")}" />
        </div>

        <div class="field">
          <label>Date of birth</label>
          <input class="input" id="dob" type="date" value="${esc(p.dob || "")}" />
        </div>

        <div class="row">
          <button class="btn primary" id="saveSetup">Save & continue</button>
          <button class="btn" id="logoutSetup">Logout</button>
        </div>

        <div class="note">
          Note: Sea service entries become locked (not editable) once any peer/employer verification is approved.
        </div>
      </div>
    </div>
  `;

  const status = $("#setupStatus");
  const uHint = $("#uHint");

  const setStatus = (msg, type = "") => {
    status.style.display = msg ? "block" : "none";
    status.className = `status ${type}`;
    status.textContent = msg || "";
  };

  $("#logoutSetup").onclick = signOut;

  $("#checkU").onclick = async () => {
    try {
      setStatus("Checking username…");
      const res = await usernameAvailable($("#username").value);
      if (!res.ok) {
        setStatus(res.msg, "warn");
        uHint.textContent = res.msg;
      } else {
        setStatus(res.msg, "ok");
        uHint.textContent = `✅ ${res.username} is available`;
        $("#username").value = res.username;
      }
    } catch (e) {
      setStatus(e?.message || "Could not check username.", "err");
    }
  };

  $("#saveSetup").onclick = async () => {
    try {
      const username = normalizeUsername($("#username").value);
      const full_name = ($("#full_name").value || "").trim();
      const nationality = ($("#nationality").value || "").trim();
      const rank = ($("#rank").value || "").trim();
      const dob = $("#dob").value || null;

      if (!username || !full_name || !nationality || !rank || !dob) {
        return setStatus("Fill username, full name, nationality, rank, and DOB.", "warn");
      }

      // validate username + uniqueness
      setStatus("Validating username…");
      const check = await usernameAvailable(username);
      if (!check.ok) return setStatus(check.msg, "warn");

      setStatus("Saving…");
      const saved = await saveMyProfile({
        id: state.user.id,
        username: check.username,
        full_name,
        nationality,
        rank,
        dob,
        updated_at: new Date().toISOString(),
      });

      state.profile = saved;
      setStatus("Saved ✅", "ok");
      go("/app");
      render();
    } catch (e) {
      // If unique constraint hits, show clean message
      const msg = (e?.message || "").includes("duplicate key")
        ? "Username already taken. Try another."
        : (e?.message || "Save failed.");
      setStatus(msg, "err");
    }
  };
}

function viewApp() {
  const v = $("#view");
  const p = state.profile || {};
  const tab = state.activeTab;

  v.innerHTML = `
    <div class="card">
      <div class="pad">
        <div class="tabs">
          <button class="tab ${tab==="feed"?"active":""}" data-tab="feed">Feed</button>
          <button class="tab ${tab==="jobs"?"active":""}" data-tab="jobs">Jobs</button>
          <button class="tab ${tab==="post"?"active":""}" data-tab="post">Post</button>
          <button class="tab ${tab==="profile"?"active":""}" data-tab="profile">Profile</button>
        </div>

        <div class="divider"></div>

        <div id="tabView"></div>
      </div>
    </div>
  `;

  document.querySelectorAll(".tab[data-tab]").forEach((b) => {
    b.onclick = () => {
      state.activeTab = b.dataset.tab;
      render();
    };
  });

  const tabView = $("#tabView");

  if (tab === "profile") {
    tabView.innerHTML = `
      <div class="note"><b>@${esc(p.username || "")}</b></div>
      <div class="divider"></div>
      <div class="note">Name: <b>${esc(p.full_name || "-")}</b></div>
      <div class="note">Nationality: <b>${esc(p.nationality || "-")}</b></div>
      <div class="note">Rank: <b>${esc(p.rank || "-")}</b></div>
      <div class="note">DOB: <b>${esc(p.dob || "-")}</b></div>
      <div class="row">
        <button class="btn primary" id="editBasics">Edit basics</button>
      </div>
      <div class="note" style="margin-top:10px;">
        Note: Sea service entries become locked (not editable) once any peer/employer verification is approved.
      </div>
    `;
    $("#editBasics").onclick = () => go("/setup");
    return;
  }

  if (tab === "jobs") {
    tabView.innerHTML = `
      <div class="note">Jobs UI is ready. We will connect real jobs next.</div>
      <div class="divider"></div>
      <div class="post"><div class="meta">Dublin • Shore</div><div class="txt">Port Captain — Full time</div></div>
      <div class="post"><div class="meta">Singapore • Sea</div><div class="txt">2/O — Container — 4 months</div></div>
      <div class="post"><div class="meta">Middle East • Sea</div><div class="txt">C/E — Bulk — 6 months</div></div>
    `;
    return;
  }

  if (tab === "post") {
    tabView.innerHTML = `
      <div class="field">
        <label>Write a post</label>
        <input class="input" id="postText" placeholder="Share an update…" />
      </div>
      <div class="row">
        <button class="btn primary" id="sendPost">Post</button>
      </div>
      <div id="postStatus" class="status" style="display:none;"></div>
      <div class="note">Media posts later (storage rules).</div>
    `;

    const st = $("#postStatus");
    const setSt = (m, t="") => {
      st.style.display = m ? "block" : "none";
      st.className = `status ${t}`;
      st.textContent = m || "";
    };

    $("#sendPost").onclick = async () => {
      try {
        setSt("Posting…");
        await createPost($("#postText").value);
        $("#postText").value = "";
        setSt("Posted ✅", "ok");
        state.activeTab = "feed";
        render();
      } catch (e) {
        setSt(e?.message || "Post failed.", "err");
      }
    };
    return;
  }

  // FEED tab
  tabView.innerHTML = `
    <div class="note">Private feed (only logged users).</div>
    <div id="feedStatus" class="status" style="display:none;"></div>
    <div class="divider"></div>
    <div id="feedList" class="feed"></div>
  `;

  loadFeedUI();
}

async function loadFeedUI() {
  const feedList = $("#feedList");
  const st = $("#feedStatus");

  const setSt = (m, t="") => {
    st.style.display = m ? "block" : "none";
    st.className = `status ${t}`;
    st.textContent = m || "";
  };

  try {
    feedList.innerHTML = "";
    setSt("Loading feed…");
    const posts = await fetchFeed(30);
    setSt("");

    if (!posts.length) {
      feedList.innerHTML = `<div class="note">No posts yet. Be the first ✨</div>`;
      return;
    }

    feedList.innerHTML = posts
      .map((p) => {
        const when = p.created_at ? new Date(p.created_at).toLocaleString() : "";
        return `
          <div class="post">
            <div class="meta">${esc(when)}</div>
            <div class="txt">${esc(p.content || "")}</div>
          </div>
        `;
      })
      .join("");
  } catch (e) {
    // Most common: RLS policy blocks SELECT for anon or auth
    setSt(
      `Feed not loading: ${e?.message || "error"}. (Check RLS policies: authenticated users must be allowed to SELECT on feed_posts.)`,
      "err"
    );
    feedList.innerHTML = "";
  }
}

/* 9) RENDER ROUTES */
function renderErrorBox(msg) {
  const v = $("#view");
  v.innerHTML = `
    <div class="card">
      <div class="pad">
        <h1 class="h1">Something went wrong</h1>
        <div class="status err" style="display:block;">${esc(msg)}</div>
        <div class="row">
          <button class="btn" onclick="location.hash='#/'">Go home</button>
        </div>
      </div>
    </div>
  `;
}

async function ensureProfileLoaded() {
  if (!state.user) return;
  if (!state.profile) state.profile = await fetchMyProfile();
}

function render() {
  const app = $("#app");
  app.innerHTML = shellHTML();
  setActions();

  const r = route();

  // Public routes
  if (r.path === "/" || r.path === "") return viewHome();
  if (r.path === "/auth") return viewAuth();

  // Protected routes
  if (!state.user) {
    go("/"); // private-by-login
    return viewHome();
  }

  // Setup route
  if (r.path === "/setup") return viewSetup();

  // Main app route
  if (r.path === "/app") return viewApp();

  // fallback
  go("/app");
  viewApp();
}

/* 10) BOOT */
(async function boot() {
  showSplashFor(3000);

  const ok = mustSupabase();
  if (!ok.ok) {
    // still render basic shell so you don't get blank page
    $("#app").innerHTML = shellHTML();
    setActions();
    renderErrorBox(ok.msg);
    return;
  }

  try {
    await loadSession();
    state.profile = state.user ? await fetchMyProfile() : null;

    sb.auth.onAuthStateChange(async (_event, session) => {
      state.session = session;
      state.user = session?.user || null;
      state.profile = state.user ? await fetchMyProfile() : null;

      if (!state.user) {
        go("/");
      } else if (!profileComplete(state.profile)) {
        go("/setup");
      } else {
        go("/app");
      }
      render();
    });

    window.addEventListener("hashchange", async () => {
      try {
        if (state.user) await ensureProfileLoaded();
        // if logged in but profile incomplete -> force setup
        const r = route();
        if (state.user && !profileComplete(state.profile) && r.path !== "/setup") go("/setup");
        render();
      } catch (e) {
        render();
      }
    });

    // initial routing decision
    const r = route();
    if (state.user) {
      if (!profileComplete(state.profile)) go("/setup");
      else if (r.path === "/auth" || r.path === "/" || r.path === "") go("/app");
    }

    render();
  } catch (e) {
    $("#app").innerHTML = shellHTML();
    setActions();
    renderErrorBox(e?.message || "Boot failed.");
  }
})();