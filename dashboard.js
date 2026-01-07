(() => {
  // Basic UI elements
  const avatarBtn = document.getElementById("avatarBtn");
  const menu = document.getElementById("profileMenu");
  const logoutBtn = document.getElementById("logoutBtn");
  const avatarImg = document.getElementById("avatarImg");
  const avatarFallback = document.getElementById("avatarFallback");
  const menuName = document.getElementById("menuName");
  const menuEmail = document.getElementById("menuEmail");

  // Nav actions (for now)
  const navPlus = document.getElementById("navPlus");
  const navJobs = document.getElementById("navJobs");
  const navSearch = document.getElementById("navSearch");
  const navMessages = document.getElementById("navMessages");
  const navProfile = document.getElementById("navProfile");

  const menuProfile = document.getElementById("menuProfile");
  const menuSettings = document.getElementById("menuSettings");
  const menuPassword = document.getElementById("menuPassword");

  // ---------- Menu toggle ----------
  function openMenu() { menu.hidden = false; }
  function closeMenu() { menu.hidden = true; }

  avatarBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    if (menu.hidden) openMenu(); else closeMenu();
  });

  document.addEventListener("click", () => closeMenu());
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeMenu();
  });

  // ---------- Helpers ----------
  function setAvatar(url, fallbackLetter = "P") {
    avatarFallback.textContent = (fallbackLetter || "P").toUpperCase();
    if (url) {
      avatarImg.src = url;
      avatarImg.style.display = "block";
      avatarFallback.style.display = "none";
    } else {
      avatarImg.style.display = "none";
      avatarFallback.style.display = "grid";
    }
  }

  // ---------- Links (safe placeholders now) ----------
  // Change these later when you create the pages.
  menuProfile.addEventListener("click", (e) => { e.preventDefault(); alert("Profile page coming soon."); closeMenu(); });
  menuSettings.addEventListener("click", (e) => { e.preventDefault(); alert("Settings page coming soon."); closeMenu(); });
  menuPassword.addEventListener("click", (e) => { e.preventDefault(); alert("Change password page coming soon."); closeMenu(); });

  navPlus.addEventListener("click", () => alert("Create post (modal) coming next."));
  navJobs.addEventListener("click", (e) => { e.preventDefault(); alert("Jobs page coming next."); });
  navSearch.addEventListener("click", (e) => { e.preventDefault(); alert("Search page coming next."); });
  navMessages.addEventListener("click", (e) => { e.preventDefault(); alert("Messages page coming next."); });
  navProfile.addEventListener("click", (e) => { e.preventDefault(); alert("Profile page coming next."); });

  // ---------- Supabase (optional, but will work if your keys exist) ----------
  // We try multiple places so it works with your current setup:
  const SUPABASE_URL =
    window.SUPABASE_URL ||
    window.__SUPABASE_URL ||
    localStorage.getItem("SUPABASE_URL") ||
    localStorage.getItem("supabaseUrl") ||
    "";

  const SUPABASE_ANON_KEY =
    window.SUPABASE_ANON_KEY ||
    window.__SUPABASE_ANON_KEY ||
    localStorage.getItem("SUPABASE_ANON_KEY") ||
    localStorage.getItem("supabaseAnonKey") ||
    "";

  let sb = null;

  async function initSupabaseIfPossible() {
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return null;

    // Load supabase-js v2 from CDN if not already available
    if (!window.supabase) {
      await new Promise((resolve, reject) => {
        const s = document.createElement("script");
        s.src = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2";
        s.onload = resolve;
        s.onerror = reject;
        document.head.appendChild(s);
      });
    }

    return window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  }

  async function requireSessionAndLoadProfile() {
    sb = await initSupabaseIfPossible();

    // If Supabase not configured here, we still show dashboard UI
    if (!sb) {
      setAvatar("", "P");
      menuName.textContent = "Welcome";
      menuEmail.textContent = "";
      return;
    }

    const { data: { session } } = await sb.auth.getSession();

    // Not logged in -> go to login
    if (!session?.user) {
      window.location.href = "/login.html";
      return;
    }

    // Show name/email
    const email = session.user.email || "";
    menuEmail.textContent = email;

    // Try fetch profile (if you have public.profiles)
    // IMPORTANT: adjust column names here if your table uses different names.
    const { data: profile, error } = await sb
      .from("profiles")
      .select("full_name, avatar_url")
      .eq("id", session.user.id)
      .maybeSingle();

    const name =
      profile?.full_name ||
      (email ? email.split("@")[0] : "Welcome");

    menuName.textContent = name;

    // avatar_url should exist (you added this earlier)
    const avatarUrl = profile?.avatar_url || "";
    const fallback = (name?.trim()?.[0] || "P").toUpperCase();
    setAvatar(avatarUrl, fallback);
  }

  logoutBtn.addEventListener("click", async () => {
    closeMenu();

    try {
      if (sb) await sb.auth.signOut();
    } catch (e) {
      // ignore
    }

    // clear common stored keys if any
    localStorage.removeItem("sb-access-token");
    localStorage.removeItem("sb-refresh-token");

    window.location.href = "/login.html";
  });

  // Run
  requireSessionAndLoadProfile();
})();