// dashboard/dashboard.js
// ✅ FULL FILE (paste полностью)
// Goal: keep existing dashboard working, fix Profile 404 by always routing to /profile/home.html
// Works even if some DOM elements are missing (no crashes).

import { supabase } from "../js/supabase.js";

(function () {
  const qs = (s, root = document) => root.querySelector(s);

  // --- Paths (single source of truth) ---
  const PATHS = {
    dashboard: "/dashboard/index.html",
    settings: "/dashboard/settings.html",
    profileHome: "/profile/home.html", // ✅ FIXED: never use /profile/ (needs index.html)
    setupBasic: "/profile-setup.html", // your basic profile setup page (root)
    login: "/auth/login.html",
    messages: "/messages/index.html", // if not present, we still won't crash
  };

  // --- Helpers ---
  const go = (url) => {
    // add cache-bust to avoid github pages caching old js/html
    const u = new URL(url, window.location.origin);
    u.searchParams.set("v", Date.now().toString());
    window.location.href = u.toString();
  };

  const safeText = (el, text) => {
    if (el) el.textContent = text;
  };

  const safeShow = (el, show) => {
    if (!el) return;
    el.style.display = show ? "" : "none";
  };

  const setAvatar = (opts) => {
    const {
      imgEl,
      fallbackEl,
      fullName = "",
      email = "",
      avatarUrl = "",
    } = opts;

    const letter = (fullName || email || "P").trim().charAt(0).toUpperCase() || "P";

    if (imgEl && avatarUrl) {
      imgEl.src = avatarUrl;
      imgEl.alt = fullName || "Profile photo";
      imgEl.style.display = "";
      if (fallbackEl) fallbackEl.style.display = "none";
      imgEl.onerror = () => {
        imgEl.style.display = "none";
        if (fallbackEl) {
          fallbackEl.textContent = letter;
          fallbackEl.style.display = "";
        }
      };
    } else {
      if (imgEl) imgEl.style.display = "none";
      if (fallbackEl) {
        fallbackEl.textContent = letter;
        fallbackEl.style.display = "";
      }
    }
  };

  async function requireAuth() {
    const { data, error } = await supabase.auth.getSession();
    if (error) console.warn("getSession error:", error);
    const session = data?.session;
    if (!session) {
      go(PATHS.login);
      return null;
    }
    return session;
  }

  async function loadMyProfile(userId) {
    // We try multiple common column names to avoid breaking if schema changed.
    const { data, error } = await supabase
      .from("profiles")
      .select("id, full_name, name, email, avatar_url, avatar, photo_url, image_url, created_at")
      .eq("id", userId)
      .maybeSingle();

    if (error) {
      console.warn("profiles select error:", error);
      return null;
    }
    return data || null;
  }

  async function loadCounts(userId) {
    // Optional: messages + notifications counts (only if tables exist)
    // If not, return zeros.
    const result = { messages: 0, notifications: 0 };

    // messages table (if exists)
    try {
      const { count, error } = await supabase
        .from("messages")
        .select("id", { count: "exact", head: true })
        .or(`to_user_id.eq.${userId},from_user_id.eq.${userId}`);
      if (!error && typeof count === "number") result.messages = count;
    } catch (e) {}

    // notifications table (if exists)
    try {
      const { count, error } = await supabase
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId);
      if (!error && typeof count === "number") result.notifications = count;
    } catch (e) {}

    return result;
  }

  function wireNavHandlers() {
    // Bottom nav buttons (works with many possible ids/classes)
    const btnProfile =
      qs("#navProfile") || qs("[data-nav='profile']") || qs("a[href*='profile']");
    const btnSettings =
      qs("#navSettings") || qs("[data-nav='settings']") || qs("a[href*='settings']");
    const btnMessages =
      qs("#navMessages") || qs("[data-nav='messages']") || qs("a[href*='messages']");
    const btnFeed = qs("#navFeed") || qs("[data-nav='feed']");
    const btnJobs = qs("#navJobs") || qs("[data-nav='jobs']");

    if (btnProfile) {
      btnProfile.addEventListener("click", (e) => {
        e.preventDefault();
        go(PATHS.profileHome); // ✅ FIXED
      });
    }

    if (btnSettings) {
      btnSettings.addEventListener("click", (e) => {
        e.preventDefault();
        go(PATHS.settings);
      });
    }

    if (btnMessages) {
      btnMessages.addEventListener("click", (e) => {
        e.preventDefault();
        go(PATHS.messages);
      });
    }

    // Optional placeholders (do nothing if you already handle tabs in HTML)
    if (btnFeed) {
      btnFeed.addEventListener("click", (e) => {
        // Keep existing behavior if it uses anchors
        // If you later want: go("/feed/index.html");
      });
    }
    if (btnJobs) {
      btnJobs.addEventListener("click", (e) => {});
    }
  }

  function wireAvatarMenu() {
    // Works whether your menu is a dropdown or a modal
    const avatarButton =
      qs("#avatarButton") ||
      qs("#topAvatar") ||
      qs(".top-avatar") ||
      qs("[data-avatar-button]");

    const menu =
      qs("#avatarMenu") ||
      qs(".avatar-menu") ||
      qs("[data-avatar-menu]");

    const menuProfile =
      qs("#menuProfile") ||
      qs("[data-menu='profile']") ||
      (menu ? qs("a[href*='profile']", menu) : null);

    const menuSettings =
      qs("#menuSettings") ||
      qs("[data-menu='settings']") ||
      (menu ? qs("a[href*='settings']", menu) : null);

    const menuLogout =
      qs("#menuLogout") ||
      qs("[data-menu='logout']") ||
      (menu ? qs("button[data-logout], a[data-logout]", menu) : null);

    const closeMenu = () => {
      if (!menu) return;
      menu.classList.remove("open");
      menu.style.display = "none";
      menu.setAttribute("aria-hidden", "true");
    };

    const openMenu = () => {
      if (!menu) return;
      menu.classList.add("open");
      menu.style.display = "";
      menu.setAttribute("aria-hidden", "false");
    };

    if (avatarButton && menu) {
      // Toggle menu
      avatarButton.addEventListener("click", (e) => {
        e.preventDefault();
        const isHidden = menu.getAttribute("aria-hidden") !== "false";
        if (isHidden) openMenu();
        else closeMenu();
      });

      // Click outside closes
      document.addEventListener("click", (e) => {
        if (!menu.classList.contains("open")) return;
        const clickedInside = menu.contains(e.target) || avatarButton.contains(e.target);
        if (!clickedInside) closeMenu();
      });

      // Esc closes
      document.addEventListener("keydown", (e) => {
        if (e.key === "Escape") closeMenu();
      });
    }

    // Menu actions
    if (menuProfile) {
      menuProfile.addEventListener("click", (e) => {
        e.preventDefault();
        // Avatar menu Profile should go to OLD basic profile page (your requirement)
        go(PATHS.setupBasic);
      });
    }

    if (menuSettings) {
      menuSettings.addEventListener("click", (e) => {
        e.preventDefault();
        go(PATHS.settings);
      });
    }

    if (menuLogout) {
      menuLogout.addEventListener("click", async (e) => {
        e.preventDefault();
        try {
          await supabase.auth.signOut();
        } catch (err) {}
        go(PATHS.login);
      });
    }
  }

  async function init() {
    // Wire UI first so taps work quickly
    wireNavHandlers();
    wireAvatarMenu();

    const session = await requireAuth();
    if (!session) return;

    const user = session.user;
    const userId = user?.id;
    const email = user?.email || "";

    // --- Elements (support multiple existing ids) ---
    const welcomeEl = qs("#welcomeName") || qs("#welcome") || qs("[data-welcome]");
    const avatarImg = qs("#avatarImg") || qs("#topAvatarImg") || qs("[data-avatar-img]");
    const avatarFallback =
      qs("#avatarFallback") || qs("#topAvatarFallback") || qs("[data-avatar-fallback]");

    const msgBadge =
      qs("#messagesBadge") || qs("[data-badge='messages']") || qs(".badge-messages");
    const notiBadge =
      qs("#notificationsBadge") || qs("[data-badge='notifications']") || qs(".badge-notifications");
    const totalMsgNotiBadge =
      qs("#messagesTabCount") || qs("[data-tabcount='messages']") || qs(".tabcount-messages");

    // Load profile (for real photo + name)
    const profile = await loadMyProfile(userId);
    const fullName =
      profile?.full_name || profile?.name || user?.user_metadata?.full_name || "";

    // Avatar URL columns (try multiple)
    const avatarUrl =
      profile?.avatar_url ||
      profile?.photo_url ||
      profile?.image_url ||
      profile?.avatar ||
      user?.user_metadata?.avatar_url ||
      "";

    setAvatar({ imgEl: avatarImg, fallbackEl: avatarFallback, fullName, email, avatarUrl });

    // Welcome text (you said: welcome message only for first-time users.
    // For now: show a welcome if localStorage flag is missing. This is safe & client-only.
    const key = `pepsval_welcomed_${userId}`;
    const alreadyWelcomed = localStorage.getItem(key) === "1";
    if (!alreadyWelcomed) {
      safeText(welcomeEl, fullName ? `Welcome, ${fullName}` : "Welcome to PEPSVAL");
      localStorage.setItem(key, "1");
    } else {
      // Keep existing if your HTML already shows something; otherwise show name.
      if (welcomeEl && !welcomeEl.textContent.trim()) {
        safeText(welcomeEl, fullName ? `Hi, ${fullName}` : "Hi");
      }
    }

    // Load counts (messages + notifications) without breaking if tables don't exist
    const counts = await loadCounts(userId);

    // Update badges
    const setBadge = (el, n) => {
      if (!el) return;
      if (!n) {
        el.textContent = "";
        el.style.display = "none";
      } else {
        el.textContent = n > 99 ? "99+" : String(n);
        el.style.display = "";
      }
    };

    setBadge(msgBadge, counts.messages);
    setBadge(notiBadge, counts.notifications);

    // If dashboard has a single Messages tab that should show total (msg + noti)
    setBadge(totalMsgNotiBadge, counts.messages + counts.notifications);

    // Keep session fresh (optional)
    supabase.auth.onAuthStateChange((_event, newSession) => {
      if (!newSession) go(PATHS.login);
    });
  }

  // Start
  document.addEventListener("DOMContentLoaded", init);
})();
```0