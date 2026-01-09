// /dashboard/dashboard.js
let supabase = null;

async function getSupabaseSafe() {
  // Try module import first
  try {
    const mod = await import("/js/supabase.js");
    if (mod?.supabase) return mod.supabase;
  } catch (e) {
    // ignore
  }

  // Try window fallback (if your project exposes it somewhere)
  if (window.supabase) return window.supabase;
  if (window.supabaseClient) return window.supabaseClient;
  if (window._supabase) return window._supabase;

  return null;
}

const $ = (id) => document.getElementById(id);

document.addEventListener("DOMContentLoaded", async () => {
  supabase = await getSupabaseSafe();

  // If Supabase not available, still show dashboard (no white page)
  if (!supabase) {
    $("userName").textContent = "PEPSVAL User";
    $("profileStatus").textContent = "Supabase not loaded";
    $("seaCount").textContent = "—";
    setupMenu(false);
    return;
  }

  // Auth guard
  const { data } = await supabase.auth.getUser();
  const user = data?.user;

  if (!user) {
    window.location.href = "/auth/login.html";
    return;
  }

  // Render basic
  const name = user.user_metadata?.full_name || (user.email || "User").split("@")[0];
  $("userName").textContent = name;
  $("avatarLetter").textContent = name.trim().charAt(0).toUpperCase();

  await loadProfileStatus(user);
  await loadSeaCount(user);

  setupMenu(true);
});

async function loadProfileStatus(user) {
  try {
    const { data: prof } = await supabase
      .from("profiles")
      .select("full_name, rank, nationality")
      .eq("id", user.id)
      .single();

    if (!prof) {
      $("profileStatus").textContent = "Incomplete";
      return;
    }

    const ok = (prof.full_name || prof.rank || prof.nationality) ? "Active" : "Incomplete";
    $("profileStatus").textContent = ok;
  } catch {
    $("profileStatus").textContent = "Active";
  }
}

async function loadSeaCount(user) {
  try {
    const { count, error } = await supabase
      .from("sea_service")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id);

    if (error) {
      $("seaCount").textContent = "—";
      return;
    }
    $("seaCount").textContent = String(count ?? 0);
  } catch {
    $("seaCount").textContent = "—";
  }
}

function setupMenu(canLogout) {
  const avatarBtn = $("avatarBtn");
  const menu = $("avatarMenu");
  if (!avatarBtn || !menu) return;

  avatarBtn.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();

    menu.classList.toggle("hidden");
    positionMenu(menu, avatarBtn);
  });

  menu.addEventListener("click", async (e) => {
    const btn = e.target.closest("button");
    if (!btn) return;
    const act = btn.dataset.act;

    if (act === "profile") window.location.href = "/profile/home.html";
    if (act === "settings") window.location.href = "/dashboard/settings.html";

    if (act === "logout") {
      if (canLogout && supabase) {
        try { await supabase.auth.signOut(); } catch {}
      }
      window.location.href = "/auth/login.html";
    }
  });

  document.addEventListener("click", () => menu.classList.add("hidden"));
}

function positionMenu(menu, btn) {
  const r = btn.getBoundingClientRect();
  menu.style.top = `${Math.round(r.bottom + 10)}px`;
  menu.style.left = `${Math.round(Math.min(window.innerWidth - 240, r.left))}px`;
}