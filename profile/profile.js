/* profile/profile.js (NO modules, simple stable)
   - Loads profile info (profiles table)
   - Loads sea service list (sea_service table)
   - Shows Coming soon for posts/docs/media
*/

(async function () {
  // ---------- Helpers ----------
  const $ = (id) => document.getElementById(id);
  const show = (el) => el && el.classList.remove("hidden");
  const hide = (el) => el && el.classList.add("hidden");
  const setText = (id, txt) => { const el = $(id); if (el) el.textContent = txt ?? "—"; };

  // Supabase client (your project already exposes this in /js/supabase.js)
  // If for any reason it isn't available, fail gracefully.
  const supabase = window.supabase || window.supabaseClient || window._supabase;
  if (!supabase) {
    console.warn("Supabase client not found on profile page.");
    setText("postsWrap", "System error: Supabase not loaded.");
    setText("documentsWrap", "System error: Supabase not loaded.");
    setText("seaWrap", "System error: Supabase not loaded.");
    setText("mediaWrap", "System error: Supabase not loaded.");
    return;
  }

  // ---------- Tabs ----------
  function activate(tabKey) {
    // buttons
    document.querySelectorAll(".tab").forEach((b) => {
      b.classList.toggle("active", b.dataset.tab === tabKey);
    });

    // panes
    const keys = ["about", "posts", "documents", "sea", "media"];
    keys.forEach((k) => {
      const pane = $("tab_" + k);
      if (!pane) return;
      pane.classList.toggle("hidden", k !== tabKey);
    });

    // Lazy load sections
    if (tabKey === "posts") loadPostsOnce();
    if (tabKey === "documents") loadDocumentsOnce();
    if (tabKey === "sea") loadSeaOnce();
    if (tabKey === "media") loadMediaOnce();
  }

  document.querySelectorAll(".tab").forEach((b) => {
    b.addEventListener("click", () => activate(b.dataset.tab));
  });

  // ---------- Auth ----------
  async function requireUser() {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data?.user) {
      window.location.href = "/auth/login.html";
      return null;
    }
    return data.user;
  }

  const user = await requireUser();
  if (!user) return;

  // ---------- Load Profile (profiles table) ----------
  async function loadProfile() {
    try {
      // Pull what we can. If some columns don't exist, we still show basics.
      const { data: prof, error } = await supabase
        .from("profiles")
        .select("id, full_name, avatar_url, rank, nationality, bio, last_vessel, availability, account_type")
        .eq("id", user.id)
        .single();

      if (error) {
        console.warn("Profile load error:", error);
      }

      const fullName = prof?.full_name || user.user_metadata?.full_name || user.email?.split("@")[0] || "User";
      const rank = prof?.rank || "—";
      const nationality = prof?.nationality || "—";
      const bio = prof?.bio || "—";
      const lastVessel = prof?.last_vessel || "—";
      const availability = prof?.availability || "—";
      const accType = prof?.account_type || user.user_metadata?.account_type || "";

      setText("profileName", fullName);
      setText("fullName", fullName);
      setText("email", user.email || "—");
      setText("rank", rank);
      setText("nationality", nationality);
      setText("bio", bio);
      setText("lastVessel", lastVessel);
      setText("availability", availability);

      setText("miniRank", rank);
      setText("miniNationality", nationality);

      // badge
      const badge = $("typeBadge");
      if (badge && accType) {
        badge.textContent = accType;
        show(badge);
      } else if (badge) {
        hide(badge);
      }

      // avatar
      const img = $("avatarImg");
      const fallback = $("avatarFallback");

      if (img && prof?.avatar_url) {
        img.src = prof.avatar_url;
        img.onerror = () => {
          hide(img);
          if (fallback) {
            fallback.textContent = (fullName || "P").trim().charAt(0).toUpperCase();
            show(fallback);
          }
        };
      } else {
        // no avatar_url
        if (img) hide(img);
        if (fallback) {
          fallback.textContent = (fullName || "P").trim().charAt(0).toUpperCase();
          show(fallback);
        }
      }
    } catch (e) {
      console.warn("loadProfile exception:", e);
    }
  }

  await loadProfile();

  // ---------- Posts/Documents/Media (placeholders for now) ----------
  let postsLoaded = false;
  let docsLoaded = false;
  let seaLoaded = false;
  let mediaLoaded = false;

  function loadPostsOnce() {
    if (postsLoaded) return;
    postsLoaded = true;
    const el = $("postsWrap");
    if (el) el.textContent = "Coming soon.";
  }

  function loadDocumentsOnce() {
    if (docsLoaded) return;
    docsLoaded = true;
    const el = $("documentsWrap");
    if (el) el.textContent = "Coming soon.";
  }

  function loadMediaOnce() {
    if (mediaLoaded) return;
    mediaLoaded = true;
    const el = $("mediaWrap");
    if (el) el.textContent = "Coming soon.";
  }

  // ---------- Sea Service (real data) ----------
  async function loadSeaOnce() {
    if (seaLoaded) return;
    seaLoaded = true;

    const wrap = $("seaWrap");
    if (!wrap) return;

    wrap.textContent = "Loading…";

    try {
      const { data, error } = await supabase
        .from("sea_service")
        .select("id, vessel_name, company_name, rank, vessel_type, sign_on_date, sign_off_date, status, verified_level")
        .eq("user_id", user.id)
        .order("sign_on_date", { ascending: false });

      if (error) {
        console.warn("Sea service load error:", error);
        wrap.textContent = "Could not load sea service right now.";
        return;
      }

      if (!data || data.length === 0) {
        wrap.textContent = "No sea service entries yet.";
        return;
      }

      // Render
      const list = document.createElement("div");
      list.className = "list";

      data.forEach((row) => {
        const card = document.createElement("div");
        card.className = "cardRow";

        const title = document.createElement("div");
        title.className = "cardTitle";
        title.textContent = `${row.vessel_name || "Vessel"}${row.rank ? " • " + row.rank : ""}`;

        const meta = document.createElement("div");
        meta.className = "cardMeta";
        meta.textContent =
          `${row.company_name || "Company"}${row.vessel_type ? " • " + row.vessel_type : ""}`;

        const dates = document.createElement("div");
        dates.className = "cardNote";
        dates.textContent =
          `Sign on: ${row.sign_on_date || "—"}  |  Sign off: ${row.sign_off_date || "—"}`;

        const verify = document.createElement("div");
        verify.className = "cardNote";
        const lvl = row.verified_level || row.status || "Self-declared";
        verify.textContent = `Verification: ${lvl}`;

        card.appendChild(title);
        card.appendChild(meta);
        card.appendChild(dates);
        card.appendChild(verify);

        list.appendChild(card);
      });

      wrap.innerHTML = "";
      wrap.appendChild(list);
    } catch (e) {
      console.warn("Sea service exception:", e);
      wrap.textContent = "Could not load sea service right now.";
    }
  }

  // Start on About
  activate("about");
})();