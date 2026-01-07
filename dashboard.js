import { supabase } from "/js/supabase.js";

document.addEventListener("DOMContentLoaded", async () => {
  const pageTitle = document.getElementById("pageTitle");

  const welcome = document.getElementById("welcome");
  const btnCompleteProfile = document.getElementById("btnCompleteProfile");
  const btnExplore = document.getElementById("btnExplore");

  const tabs = Array.from(document.querySelectorAll(".tab"));
  const pages = {
    feed: document.getElementById("pageFeed"),
    jobs: document.getElementById("pageJobs"),
    create: document.getElementById("pageCreate"),
    search: document.getElementById("pageSearch"),
    messages: document.getElementById("pageMessages"),
    profile: document.getElementById("pageProfile"),
  };

  const postText = document.getElementById("postText");
  const postFile = document.getElementById("postFile");
  const fileHint = document.getElementById("fileHint");
  const btnPublish = document.getElementById("btnPublish");

  const profileName = document.getElementById("profileName");
  const profileMeta = document.getElementById("profileMeta");

  // Require auth
  const { data: sessionData } = await supabase.auth.getSession();
  const session = sessionData?.session;
  if (!session) {
    window.location.href = "/auth/login.html";
    return;
  }

  // Load profile
  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, account_type, nationality, setup_complete, profile_completed, seen_welcome")
    .eq("id", session.user.id)
    .maybeSingle();

  // If setup not complete -> go setup
  if (!profile || profile.setup_complete !== true) {
    window.location.href = "/setup/profile-setup.html";
    return;
  }

  // Fill profile header (basic)
  profileName.textContent = profile.full_name || "Your name";
  const metaParts = [];
  if (profile.account_type) metaParts.push(niceType(profile.account_type));
  if (profile.nationality) metaParts.push(profile.nationality);
  profileMeta.textContent = metaParts.join(" • ") || "Profile";

  // Decide where to land:
  // - If NOT profile_completed (or missing column), show welcome screen
  // - Otherwise go Feed
  const isProfileCompleted = profile?.profile_completed === true;
  const hasSeenWelcome = profile?.seen_welcome === true;

  if (!isProfileCompleted && !hasSeenWelcome) {
    welcome.classList.remove("hidden");
    // default title behind
    showTab("feed");
  } else {
    showTab("feed");
  }

  // Welcome buttons
  btnCompleteProfile.addEventListener("click", async () => {
    await markSeenWelcome(session.user.id);
    welcome.classList.add("hidden");
    showTab("profile");
  });

  btnExplore.addEventListener("click", async () => {
    await markSeenWelcome(session.user.id);
    welcome.classList.add("hidden");
    showTab("feed");
  });

  // Bottom nav
  tabs.forEach(btn => {
    btn.addEventListener("click", () => {
      const t = btn.getAttribute("data-tab");
      showTab(t);
    });
  });

  function showTab(tabName) {
    // hide all pages
    Object.values(pages).forEach(p => p.classList.add("hidden"));
    // show one
    pages[tabName]?.classList.remove("hidden");

    // set title
    const titleMap = {
      feed: "Feed",
      jobs: "Jobs",
      create: "Create",
      search: "Search",
      messages: "Messages",
      profile: "Profile",
    };
    pageTitle.textContent = titleMap[tabName] || "PEPSVAL";

    // active tab highlight
    tabs.forEach(t => t.classList.remove("active"));
    const active = tabs.find(t => t.getAttribute("data-tab") === tabName);
    active?.classList.add("active");
  }

  // Create post MVP controls (only UI)
  function updatePublishBtn() {
    const hasText = (postText.value || "").trim().length > 0;
    const hasFile = !!postFile.files?.[0];
    btnPublish.disabled = !(hasText || hasFile);
  }
  postText?.addEventListener("input", updatePublishBtn);
  postFile?.addEventListener("change", () => {
    const f = postFile.files?.[0];
    fileHint.textContent = f ? `Selected: ${f.name}` : "No file selected";
    updatePublishBtn();
  });
  updatePublishBtn();

  btnPublish?.addEventListener("click", () => {
    alert("Next step: connect posts to Supabase (storage + posts table).");
  });
});

function niceType(t) {
  if (!t) return "";
  if (t === "seafarer") return "Seafarer";
  if (t === "employer") return "Employer";
  if (t === "shore") return "Shore Staff";
  if (t === "other") return "Other";
  return t;
}

async function markSeenWelcome(userId) {
  // This will work only after we add columns. If not present, silently ignore.
  try {
    const { error } = await supabase
      .from("profiles")
      .update({ seen_welcome: true, updated_at: new Date().toISOString() })
      .eq("id", userId);
    if (error) {
      // ignore (we will add columns in DB next)
    }
  } catch {
    // ignore
  }
}