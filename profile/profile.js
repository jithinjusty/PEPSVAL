// /profile/profile.js
import { supabase } from "/js/supabase.js";

const $ = (id) => document.getElementById(id);
const show = (el) => el && el.classList.remove("hidden");
const hide = (el) => el && el.classList.add("hidden");
const setText = (id, txt) => { const el = $(id); if (el) el.textContent = (txt ?? "—"); };

document.addEventListener("DOMContentLoaded", async () => {
  // ✅ Must be logged in
  const { data } = await supabase.auth.getUser();
  const user = data?.user;

  if (!user) {
    window.location.href = "/auth/login.html";
    return;
  }

  setupTabs();

  await loadProfile(user);
  // Load Sea only when tab clicked, but keep ready
});

function setupTabs() {
  const keys = ["about", "posts", "documents", "sea", "media"];

  function activate(key) {
    document.querySelectorAll(".tab").forEach((b) => {
      b.classList.toggle("active", b.dataset.tab === key);
    });
    keys.forEach((k) => {
      const pane = $("tab_" + k);
      if (!pane) return;
      pane.classList.toggle("hidden", k !== key);
    });

    if (key === "posts") setText("postsWrap", "Coming soon.");
    if (key === "documents") setText("documentsWrap", "Coming soon.");
    if (key === "media") setText("mediaWrap", "Coming soon.");
  }

  document.querySelectorAll(".tab").forEach((b) => {
    b.addEventListener("click", async () => {
      const key = b.dataset.tab;
      activate(key);

      if (key === "sea") {
        const { data } = await supabase.auth.getUser();
        if (data?.user) await loadSeaService(data.user);
      }
    });
  });

  activate("about");
}

async function loadProfile(user) {
  // Get profile row
  const { data: prof, error } = await supabase
    .from("profiles")
    .select("id, full_name, avatar_url, rank, nationality, bio, last_vessel, availability, account_type")
    .eq("id", user.id)
    .single();

  if (error) console.warn("profile load error", error);

  const fullName = prof?.full_name || user.user_metadata?.full_name || (user.email || "User").split("@")[0];
  const rank = prof?.rank || "—";
  const nationality = prof?.nationality || "—";

  setText("profileName", fullName);
  setText("fullName", fullName);
  setText("email", user.email || "—");
  setText("rank", rank);
  setText("nationality", nationality);
  setText("bio", prof?.bio || "—");
  setText("lastVessel", prof?.last_vessel || "—");
  setText("availability", prof?.availability || "—");
  setText("miniRank", rank);
  setText("miniNationality", nationality);

  // badge
  const badge = $("typeBadge");
  const accType = prof?.account_type || user.user_metadata?.account_type || "";
  if (badge && accType) {
    badge.textContent = accType;
    show(badge);
  } else if (badge) {
    hide(badge);
  }

  // avatar
  const img = $("avatarImg");
  const fallback = $("avatarFallback");

  if (prof?.avatar_url && img) {
    img.src = prof.avatar_url;
    img.onload = () => { show(img); hide(fallback); };
    img.onerror = () => { hide(img); useFallback(fullName); };
  } else {
    hide(img);
    useFallback(fullName);
  }

  function useFallback(name) {
    if (!fallback) return;
    fallback.textContent = (name || "P").trim().charAt(0).toUpperCase();
    show(fallback);
  }
}

async function loadSeaService(user) {
  const wrap = $("seaWrap");
  if (!wrap) return;

  wrap.textContent = "Loading…";

  const { data, error } = await supabase
    .from("sea_service")
    .select("id, vessel_name, company_name, rank, vessel_type, sign_on_date, sign_off_date, status, verified_level, user_id")
    .eq("user_id", user.id)
    .order("sign_on_date", { ascending: false });

  if (error) {
    console.warn("sea service error", error);
    wrap.textContent = "Could not load sea service.";
    return;
  }

  if (!data || data.length === 0) {
    wrap.textContent = "No sea service entries yet.";
    return;
  }

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
    meta.textContent = `${row.company_name || "Company"}${row.vessel_type ? " • " + row.vessel_type : ""}`;

    const dates = document.createElement("div");
    dates.className = "cardNote";
    dates.textContent = `Sign on: ${row.sign_on_date || "—"}  |  Sign off: ${row.sign_off_date || "—"}`;

    const verify = document.createElement("div");
    verify.className = "cardNote";
    verify.textContent = `Verification: ${row.verified_level || row.status || "Self-declared"}`;

    card.appendChild(title);
    card.appendChild(meta);
    card.appendChild(dates);
    card.appendChild(verify);
    list.appendChild(card);
  });

  wrap.innerHTML = "";
  wrap.appendChild(list);
}