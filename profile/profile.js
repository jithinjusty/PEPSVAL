import { supabase } from "/js/supabase.js";

/**
 * Profile page rules:
 * - Loads header fast (profile row only)
 * - Tabs load content only when clicked
 * - Posts tab uses infinite scroll and never crashes if posts table doesn't exist yet
 */

// ---------- helpers ----------
const $ = (id) => document.getElementById(id);
const fmtMonthYear = (iso) => {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    return d.toLocaleString(undefined, { month: "short", year: "numeric" });
  } catch { return "—"; }
};
const fmtDate = (iso) => {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    return d.toLocaleDateString();
  } catch { return "—"; }
};

// ---------- DOM refs ----------
const avatarImg = $("avatarImg");
const profileName = $("profileName");
const accountBadge = $("accountBadge");
const primaryLine = $("primaryLine");
const headerButtons = $("headerButtons");

const miniNationality = $("miniNationality");
const miniSince = $("miniSince");
const miniType = $("miniType");

const aboutText = $("aboutText");
const aboutName = $("aboutName");
const aboutDob = $("aboutDob");
const aboutPhone = $("aboutPhone");
const aboutType = $("aboutType");

const tabDocuments = $("tabDocuments");
const tabSea = $("tabSea");
const tabJobs = $("tabJobs");

const postsList = $("postsList");
const postsStatus = $("postsStatus");

// ---------- state ----------
let viewerUser = null;
let profileUserId = null;
let profileRow = null;
let isOwnProfile = false;

let activeTab = "about";

// posts paging
let postsInitialized = false;
let postsLoading = false;
let postsDone = false;
let postsCursor = null; // created_at cursor
const POSTS_PAGE = 10;

// ---------- routing ----------
function getRequestedUid() {
  const url = new URL(window.location.href);
  // support both ?uid= and ?id=
  return url.searchParams.get("uid") || url.searchParams.get("id");
}

// ---------- UI ----------
function setActiveTab(tab) {
  activeTab = tab;

  document.querySelectorAll(".tab").forEach((b) => {
    b.classList.toggle("active", b.dataset.tab === tab);
  });

  // panes
  const panes = ["about", "posts", "documents", "sea", "jobs", "media"];
  panes.forEach((p) => {
    const el = document.getElementById(`tab_${p}`);
    if (!el) return;
    el.classList.toggle("hidden", p !== tab);
  });
}

function setHeaderButtons() {
  headerButtons.innerHTML = "";

  if (isOwnProfile) {
    const edit = document.createElement("a");
    edit.className = "btn btnPrimary";
    edit.href = "/setup/profile-setup.html";
    edit.textContent = "Edit profile";
    headerButtons.appendChild(edit);

    const dash = document.createElement("a");
    dash.className = "btn btnGhost";
    dash.href = "/dashboard/index.html";
    dash.textContent = "Back to Dashboard";
    headerButtons.appendChild(dash);
  } else {
    const msg = document.createElement("button");
    msg.className = "btn btnPrimary";
    msg.type = "button";
    msg.textContent = "Message";
    msg.addEventListener("click", () => {
      alert("Messages will open here (next build).");
    });

    const connect = document.createElement("button");
    connect.className = "btn btnGhost";
    connect.type = "button";
    connect.textContent = "Connect";
    connect.addEventListener("click", () => {
      alert("Connect request will be added later.");
    });

    headerButtons.appendChild(msg);
    headerButtons.appendChild(connect);
  }
}

function showTabsByAccountType(type) {
  // Default hide
  tabDocuments.classList.add("hidden");
  tabSea.classList.add("hidden");
  tabJobs.classList.add("hidden");

  // Seafarer: documents + sea service
  if (type === "seafarer") {
    tabDocuments.classList.remove("hidden");
    tabSea.classList.remove("hidden");
  }

  // Employer: jobs
  if (type === "employer") {
    tabJobs.classList.remove("hidden");
  }

  // Shore: maybe documents later (keep off for now)
}

// ---------- data ----------
async function loadViewer() {
  const { data } = await supabase.auth.getUser();
  viewerUser = data?.user || null;
}

async function loadProfileRow(uid) {
  // profiles table should exist already
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", uid)
    .maybeSingle();

  if (error) throw error;
  return data || null;
}

function deriveDisplayName(p) {
  const full =
    (p?.full_name || "").trim() ||
    [p?.first_name, p?.last_name].filter(Boolean).join(" ").trim();
  return full || "Unnamed user";
}

function setHeaderFromProfile(p) {
  const name = deriveDisplayName(p);

  profileName.textContent = name;

  const type = (p?.account_type || p?.accountType || "").toString().toLowerCase();
  const badgeText =
    type === "seafarer" ? "SEAFARER" :
    type === "employer" ? "EMPLOYER" :
    type === "shore" ? "SHORE" :
    type ? type.toUpperCase() : "USER";

  accountBadge.textContent = badgeText;
  accountBadge.classList.remove("hidden");

  // Primary line
  const nat = (p?.nationality || p?.country || p?.nationality_name || "").toString().trim();
  const rank = (p?.rank || "").toString().trim();
  const location = (p?.location || "").toString().trim();

  if (type === "seafarer") {
    primaryLine.textContent = [rank || "Rank not set", nat || "Nationality not set"].filter(Boolean).join(" • ");
  } else if (type === "employer") {
    primaryLine.textContent = [p?.company_name || "Company", location || nat || "—"].filter(Boolean).join(" • ");
  } else if (type === "shore") {
    primaryLine.textContent = [p?.role || "Shore staff", nat || "—"].filter(Boolean).join(" • ");
  } else {
    primaryLine.textContent = nat || "—";
  }

  // Avatar
  const a =
    p?.avatar_url ||
    p?.avatar ||
    p?.photo_url ||
    p?.profile_photo_url ||
    "";

  if (a) avatarImg.src = a;

  // left rail
  miniNationality.textContent = nat || "—";
  miniSince.textContent = fmtMonthYear(p?.created_at);
  miniType.textContent = badgeText;

  // About tab
  aboutText.textContent =
    (p?.bio || "").trim() ||
    "Add a short bio to help others understand who you are (we’ll add an edit bio section soon).";

  aboutName.textContent = name;
  aboutDob.textContent = p?.dob ? fmtDate(p?.dob) : "—";
  aboutType.textContent = badgeText;

  // Phone privacy:
  // show phone only for own profile; for others show "Hidden"
  if (isOwnProfile) {
    const dial = (p?.dial_code || p?.phone_code || p?.dial || "").toString().trim();
    const phone = (p?.phone || p?.mobile || "").toString().trim();
    aboutPhone.textContent = phone ? `${dial ? dial + " " : ""}${phone}` : "—";
  } else {
    aboutPhone.textContent = "Hidden";
  }

  showTabsByAccountType(type);
}

// ---------- posts ----------
function postCard({ body, created_at }) {
  const d = document.createElement("div");
  d.className = "post";

  const top = document.createElement("div");
  top.className = "postTop";

  const title = document.createElement("div");
  title.className = "postTitle";
  title.textContent = "Post";

  const time = document.createElement("div");
  time.className = "postTime";
  time.textContent = created_at ? new Date(created_at).toLocaleString() : "";

  top.appendChild(title);
  top.appendChild(time);

  const content = document.createElement("div");
  content.className = "postBody";
  content.textContent = body || "";

  d.appendChild(top);
  d.appendChild(content);
  return d;
}

async function loadMorePosts() {
  if (postsLoading || postsDone) return;
  postsLoading = true;
  postsStatus.textContent = "Loading posts…";

  try {
    // Try posts table (common structure)
    // Expected columns: id, user_id, content/body/text, created_at
    let q = supabase
      .from("posts")
      .select("id,user_id,content,body,text,created_at")
      .eq("user_id", profileUserId)
      .order("created_at", { ascending: false })
      .limit(POSTS_PAGE);

    if (postsCursor) {
      // pagination by created_at
      q = q.lt("created_at", postsCursor);
    }

    const { data, error } = await q;

    if (error) {
      // If table doesn't exist or RLS blocks, show friendly message once.
      postsDone = true;
      postsStatus.textContent =
        "Posts will appear here once the Posts system is enabled (next step).";
      postsLoading = false;
      return;
    }

    const rows = data || [];
    if (rows.length === 0) {
      postsDone = true;
      postsStatus.textContent = profileRow?.created_at
        ? `You joined Pepsval in ${fmtMonthYear(profileRow.created_at)}.`
        : "No more posts.";
      postsLoading = false;
      return;
    }

    rows.forEach((r) => {
      const body = (r.content || r.body || r.text || "").toString();
      postsList.appendChild(postCard({ body, created_at: r.created_at }));
    });

    postsCursor = rows[rows.length - 1]?.created_at || postsCursor;
    postsStatus.textContent = "Scroll to load more…";
  } finally {
    postsLoading = false;
  }
}

function initPostsInfiniteScroll() {
  if (postsInitialized) return;
  postsInitialized = true;

  // first load
  loadMorePosts();

  const onScroll = () => {
    if (postsDone || postsLoading) return;

    const scrolled = window.scrollY + window.innerHeight;
    const threshold = document.body.scrollHeight - 700;
    if (scrolled >= threshold) loadMorePosts();
  };

  window.addEventListener("scroll", onScroll, { passive: true });
}

// ---------- init ----------
async function init() {
  // Which profile are we viewing?
  const requested = getRequestedUid();

  await loadViewer();

  if (requested) {
    profileUserId = requested;
  } else {
    // default = self
    profileUserId = viewerUser?.id || null;
  }

  if (!profileUserId) {
    // not logged in and no uid: send to login
    window.location.href = "/auth/login.html";
    return;
  }

  isOwnProfile = viewerUser?.id && viewerUser.id === profileUserId;
  setHeaderButtons();

  try {
    profileRow = await loadProfileRow(profileUserId);

    if (!profileRow) {
      profileName.textContent = "Profile not found";
      primaryLine.textContent = "—";
      aboutText.textContent = "This profile does not exist.";
      return;
    }

    setHeaderFromProfile(profileRow);
  } catch (e) {
    profileName.textContent = "Could not load profile";
    primaryLine.textContent = "You can still browse.";
    aboutText.textContent = "Error loading profile. Please try again.";
  }

  // tabs
  document.querySelectorAll(".tab").forEach((b) => {
    b.addEventListener("click", () => {
      const tab = b.dataset.tab;
      setActiveTab(tab);

      // Lazy-load tab data
      if (tab === "posts") initPostsInfiniteScroll();
      // documents / sea / jobs / media will be implemented later
    });
  });

  setActiveTab("about");
}

init();