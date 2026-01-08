import { supabase } from "/js/supabase.js";

/**
 * Profile page rules:
 * - Loads header fast (profile row only)
 * - Tabs load content only when clicked
 * - Documents tab: issue/expiry/issued_by (no file upload)
 * - Sea Service tab: add/list/delete (basic); verified rows protected (no delete)
 */

const $ = (id) => document.getElementById(id);

// ---------- helpers ----------
const fmtMonthYear = (iso) => {
  if (!iso) return "—";
  try { return new Date(iso).toLocaleString(undefined, { month: "short", year: "numeric" }); }
  catch { return "—"; }
};
const fmtDate = (iso) => {
  if (!iso) return "—";
  try { return new Date(iso).toLocaleDateString(); }
  catch { return "—"; }
};
const isoOrNull = (v) => (v && String(v).trim() ? String(v) : null);

function daysFromToday(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return null;
  const today = new Date();
  today.setHours(0,0,0,0);
  d.setHours(0,0,0,0);
  return Math.round((d - today) / (1000 * 60 * 60 * 24));
}

function expiryBadge(expiry_date) {
  const diff = daysFromToday(expiry_date);
  if (diff === null) return { text: "No expiry", cls: "neutral" };
  if (diff < 0) return { text: "Expired", cls: "bad" };
  if (diff <= 60) return { text: "Expiring", cls: "warn" };
  return { text: "Valid", cls: "ok" };
}

function safeText(v) {
  return (v === null || v === undefined || v === "") ? "—" : String(v);
}

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

// documents
const docForm = $("docForm");
const docType = $("docType");
const docNumber = $("docNumber");
const docIssuedBy = $("docIssuedBy");
const docIssueDate = $("docIssueDate");
const docExpiryDate = $("docExpiryDate");
const docClearBtn = $("docClearBtn");
const docError = $("docError");
const docRows = $("docRows");
const docStatus = $("docStatus");

// sea service
const seaForm = $("seaForm");
const vesselName = $("vesselName");
const vesselType = $("vesselType");
const seaRank = $("seaRank");
const seaCompany = $("seaCompany");
const signOn = $("signOn");
const signOff = $("signOff");
const seaClearBtn = $("seaClearBtn");
const seaError = $("seaError");
const seaRows = $("seaRows");
const seaStatus = $("seaStatus");

// ---------- state ----------
let viewerUser = null;
let profileUserId = null;
let profileRow = null;
let isOwnProfile = false;
let activeTab = "about";

// posts paging (kept for later)
let postsInitialized = false;
let postsLoading = false;
let postsDone = false;
let postsCursor = null;
const POSTS_PAGE = 10;

// tab lazy flags
let docsLoadedOnce = false;
let seaLoadedOnce = false;

// ---------- routing ----------
function getRequestedUid() {
  const url = new URL(window.location.href);
  return url.searchParams.get("uid") || url.searchParams.get("id");
}

// ---------- UI ----------
function setActiveTab(tab) {
  activeTab = tab;

  document.querySelectorAll(".tab").forEach((b) => {
    b.classList.toggle("active", b.dataset.tab === tab);
  });

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
    msg.addEventListener("click", () => alert("Messages will open here (next build)."));

    const connect = document.createElement("button");
    connect.className = "btn btnGhost";
    connect.type = "button";
    connect.textContent = "Connect";
    connect.addEventListener("click", () => alert("Connect request will be added later."));

    headerButtons.appendChild(msg);
    headerButtons.appendChild(connect);
  }
}

function showTabsByAccountType(type) {
  tabDocuments.classList.add("hidden");
  tabSea.classList.add("hidden");
  tabJobs.classList.add("hidden");

  if (type === "seafarer") {
    tabDocuments.classList.remove("hidden");
    tabSea.classList.remove("hidden");
  }
  if (type === "employer") {
    tabJobs.classList.remove("hidden");
  }
}

// ---------- data ----------
async function loadViewer() {
  const { data } = await supabase.auth.getUser();
  viewerUser = data?.user || null;
}

async function loadProfileRow(uid) {
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

  const a = p?.avatar_url || p?.avatar || p?.photo_url || p?.profile_photo_url || "";
  if (a) avatarImg.src = a;

  miniNationality.textContent = nat || "—";
  miniSince.textContent = fmtMonthYear(p?.created_at);
  miniType.textContent = badgeText;

  aboutText.textContent =
    (p?.bio || "").trim() ||
    "Add a short bio to help others understand who you are (we’ll add edit bio soon).";

  aboutName.textContent = name;
  aboutDob.textContent = p?.dob ? fmtDate(p?.dob) : "—";
  aboutType.textContent = badgeText;

  if (isOwnProfile) {
    const dial = (p?.dial_code || p?.phone_code || p?.dial || "").toString().trim();
    const phone = (p?.phone || p?.mobile || "").toString().trim();
    aboutPhone.textContent = phone ? `${dial ? dial + " " : ""}${phone}` : "—";
  } else {
    aboutPhone.textContent = "Hidden";
  }

  showTabsByAccountType(type);
}

// ---------- POSTS (unchanged, safe if posts table not there) ----------
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
    let q = supabase
      .from("posts")
      .select("id,user_id,content,body,text,created_at")
      .eq("user_id", profileUserId)
      .order("created_at", { ascending: false })
      .limit(POSTS_PAGE);

    if (postsCursor) q = q.lt("created_at", postsCursor);

    const { data, error } = await q;

    if (error) {
      postsDone = true;
      postsStatus.textContent = "Posts will appear here once Posts system is enabled (next step).";
      return;
    }

    const rows = data || [];
    if (rows.length === 0) {
      postsDone = true;
      postsStatus.textContent = profileRow?.created_at
        ? `Member since: ${fmtMonthYear(profileRow.created_at)}`
        : "No more posts.";
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

  loadMorePosts();

  const onScroll = () => {
    if (postsDone || postsLoading) return;
    const scrolled = window.scrollY + window.innerHeight;
    const threshold = document.body.scrollHeight - 700;
    if (scrolled >= threshold) loadMorePosts();
  };
  window.addEventListener("scroll", onScroll, { passive: true });
}

// ---------- DOCUMENTS ----------
function showError(el, msg) {
  el.textContent = msg;
  el.classList.remove("hidden");
}
function clearError(el) {
  el.textContent = "";
  el.classList.add("hidden");
}

function docRowCard(r) {
  const badge = expiryBadge(r.expiry_date);

  const row = document.createElement("div");
  row.className = "row";

  // Desktop grid layout is controlled by CSS; we’ll insert cells as simple divs
  const c1 = document.createElement("div");
  c1.innerHTML = `<div class="cellLabel">Type</div><div class="cellVal">${safeText(r.doc_type)}</div>`;

  const c2 = document.createElement("div");
  c2.innerHTML = `<div class="cellLabel">Issued by</div><div class="cellVal">${safeText(r.issued_by)}</div>`;

  const c3 = document.createElement("div");
  c3.innerHTML = `<div class="cellLabel">Issue</div><div class="cellVal">${r.issue_date ? fmtDate(r.issue_date) : "—"}</div>`;

  const c4 = document.createElement("div");
  c4.innerHTML = `<div class="cellLabel">Expiry</div><div class="cellVal">${r.expiry_date ? fmtDate(r.expiry_date) : "—"}</div>`;

  const c5 = document.createElement("div");
  c5.innerHTML = `<div class="cellLabel">Status</div>`;
  const b = document.createElement("span");
  b.className = `badgeStatus ${badge.cls}`;
  b.textContent = badge.text;
  c5.appendChild(b);

  const c6 = document.createElement("div");
  c6.className = "rowActions";

  const del = document.createElement("button");
  del.className = "btnMini danger";
  del.type = "button";
  del.textContent = "Delete";
  del.addEventListener("click", async () => {
    if (!isOwnProfile) return;
    if (!confirm("Delete this document?")) return;

    const { error } = await supabase.from("documents").delete().eq("id", r.id);
    if (error) {
      showError(docError, `Delete failed: ${error.message}`);
      return;
    }
    await loadDocuments(true);
  });

  if (!isOwnProfile) del.disabled = true;
  c6.appendChild(del);

  row.appendChild(c1);
  row.appendChild(c2);
  row.appendChild(c3);
  row.appendChild(c4);
  row.appendChild(c5);
  row.appendChild(c6);

  // Match the table header columns for desktop
  row.style.gridTemplateColumns = "1.2fr 1.2fr .8fr .8fr .8fr 1fr";
  return row;
}

async function loadDocuments(force = false) {
  if (!isOwnProfile && profileUserId !== viewerUser?.id) {
    // viewing someone else: for now we keep documents private
    docRows.innerHTML = "";
    docStatus.textContent = "Documents are private for now.";
    return;
  }

  if (docsLoadedOnce && !force) return;
  docsLoadedOnce = true;

  clearError(docError);
  docStatus.textContent = "Loading documents…";
  docRows.innerHTML = "";

  const { data, error } = await supabase
    .from("documents")
    .select("id,doc_type,doc_number,issued_by,issue_date,expiry_date,created_at")
    .eq("user_id", profileUserId)
    .order("expiry_date", { ascending: true, nullsFirst: false });

  if (error) {
    showError(docError, `Could not load documents: ${error.message}`);
    docStatus.textContent = "—";
    return;
  }

  const rows = data || [];
  if (rows.length === 0) {
    docStatus.textContent = "No documents yet.";
    return;
  }

  rows.forEach((r) => docRows.appendChild(docRowCard(r)));
  docStatus.textContent = `Showing ${rows.length} document(s).`;
}

function clearDocForm() {
  docType.value = "";
  docNumber.value = "";
  docIssuedBy.value = "";
  docIssueDate.value = "";
  docExpiryDate.value = "";
}

function bindDocuments() {
  docClearBtn.addEventListener("click", () => {
    clearError(docError);
    clearDocForm();
  });

  docForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    clearError(docError);

    if (!isOwnProfile) {
      showError(docError, "You can edit only your own documents.");
      return;
    }

    const type = docType.value.trim();
    if (!type) {
      showError(docError, "Document type is required.");
      return;
    }

    const payload = {
      user_id: profileUserId,
      doc_type: type,
      doc_number: isoOrNull(docNumber.value),
      issued_by: isoOrNull(docIssuedBy.value),
      issue_date: isoOrNull(docIssueDate.value),
      expiry_date: isoOrNull(docExpiryDate.value),
    };

    const { error } = await supabase.from("documents").insert(payload);
    if (error) {
      showError(docError, `Save failed: ${error.message}`);
      return;
    }

    clearDocForm();
    await loadDocuments(true);
  });
}

// ---------- SEA SERVICE ----------
function seaBadge(verified) {
  if (verified === true) return { text: "Verified", cls: "ok" };
  return { text: "Self-declared", cls: "neutral" };
}

function periodText(on, off) {
  const a = on ? fmtDate(on) : "—";
  const b = off ? fmtDate(off) : "—";
  return `${a} → ${b}`;
}

function seaRowCard(r) {
  const badge = seaBadge(r.verified);

  const row = document.createElement("div");
  row.className = "row";
  row.style.gridTemplateColumns = "1.2fr 1fr .8fr 1fr 1.1fr .8fr 1fr";

  const c1 = document.createElement("div");
  c1.innerHTML = `<div class="cellLabel">Vessel</div><div class="cellVal">${safeText(r.vessel_name)}</div>`;

  const c2 = document.createElement("div");
  c2.innerHTML = `<div class="cellLabel">Type</div><div class="cellVal">${safeText(r.vessel_type)}</div>`;

  const c3 = document.createElement("div");
  c3.innerHTML = `<div class="cellLabel">Rank</div><div class="cellVal">${safeText(r.rank)}</div>`;

  const c4 = document.createElement("div");
  c4.innerHTML = `<div class="cellLabel">Company</div><div class="cellVal">${safeText(r.company_name)}</div>`;

  const c5 = document.createElement("div");
  c5.innerHTML = `<div class="cellLabel">Period</div><div class="cellVal">${periodText(r.sign_on, r.sign_off)}</div>`;

  const c6 = document.createElement("div");
  c6.innerHTML = `<div class="cellLabel">Status</div>`;
  const b = document.createElement("span");
  b.className = `badgeStatus ${badge.cls}`;
  b.textContent = badge.text;
  c6.appendChild(b);

  const c7 = document.createElement("div");
  c7.className = "rowActions";

  const del = document.createElement("button");
  del.className = "btnMini danger";
  del.type = "button";
  del.textContent = "Delete";

  // If verified, treat as locked (no delete)
  if (r.verified === true) {
    del.disabled = true;
    del.title = "Locked because it is verified.";
  }

  del.addEventListener("click", async () => {
    if (!isOwnProfile) return;
    if (r.verified === true) return;
    if (!confirm("Delete this sea service entry?")) return;

    const { error } = await supabase.from("sea_service").delete().eq("id", r.id);
    if (error) {
      showError(seaError, `Delete failed: ${error.message}`);
      return;
    }
    await loadSeaService(true);
  });

  if (!isOwnProfile) del.disabled = true;

  c7.appendChild(del);

  row.appendChild(c1);
  row.appendChild(c2);
  row.appendChild(c3);
  row.appendChild(c4);
  row.appendChild(c5);
  row.appendChild(c6);
  row.appendChild(c7);

  return row;
}

async function loadSeaService(force = false) {
  if (!isOwnProfile && profileUserId !== viewerUser?.id) {
    seaRows.innerHTML = "";
    seaStatus.textContent = "Sea service is private for now.";
    return;
  }

  if (seaLoadedOnce && !force) return;
  seaLoadedOnce = true;

  clearError(seaError);
  seaStatus.textContent = "Loading sea service…";
  seaRows.innerHTML = "";

  // Your sea_service table likely exists already. We use the common columns.
  const { data, error } = await supabase
    .from("sea_service")
    .select("id,vessel_name,vessel_type,rank,company_name,sign_on,sign_off,verified,verified_by,created_at")
    .eq("user_id", profileUserId)
    .order("sign_on", { ascending: false, nullsFirst: false });

  if (error) {
    showError(seaError, `Could not load sea service: ${error.message}`);
    seaStatus.textContent = "—";
    return;
  }

  const rows = data || [];
  if (rows.length === 0) {
    seaStatus.textContent = "No sea service entries yet.";
    return;
  }

  rows.forEach((r) => seaRows.appendChild(seaRowCard(r)));
  seaStatus.textContent = `Showing ${rows.length} entr${rows.length === 1 ? "y" : "ies"}.`;
}

function clearSeaForm() {
  vesselName.value = "";
  vesselType.value = "";
  seaRank.value = "";
  seaCompany.value = "";
  signOn.value = "";
  signOff.value = "";
}

function bindSeaService() {
  seaClearBtn.addEventListener("click", () => {
    clearError(seaError);
    clearSeaForm();
  });

  seaForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    clearError(seaError);

    if (!isOwnProfile) {
      showError(seaError, "You can edit only your own sea service.");
      return;
    }

    const v = vesselName.value.trim();
    if (!v) {
      showError(seaError, "Vessel name is required.");
      return;
    }

    const payload = {
      user_id: profileUserId,
      vessel_name: v,
      vessel_type: isoOrNull(vesselType.value),
      rank: isoOrNull(seaRank.value),
      company_name: isoOrNull(seaCompany.value),
      sign_on: isoOrNull(signOn.value),
      sign_off: isoOrNull(signOff.value),
    };

    const { error } = await supabase.from("sea_service").insert(payload);
    if (error) {
      showError(seaError, `Save failed: ${error.message}`);
      return;
    }

    clearSeaForm();
    await loadSeaService(true);
  });
}

// ---------- init ----------
async function init() {
  const requested = getRequestedUid();
  await loadViewer();

  profileUserId = requested || viewerUser?.id || null;

  if (!profileUserId) {
    window.location.href = "/auth/login.html";
    return;
  }

  isOwnProfile = !!(viewerUser?.id && viewerUser.id === profileUserId);
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

  // Bind forms once
  bindDocuments();
  bindSeaService();

  // Tabs
  document.querySelectorAll(".tab").forEach((b) => {
    b.addEventListener("click", async () => {
      const tab = b.dataset.tab;
      setActiveTab(tab);

      // Lazy-load on open
      if (tab === "posts") initPostsInfiniteScroll();
      if (tab === "documents") await loadDocuments(false);
      if (tab === "sea") await loadSeaService(false);
    });
  });

  setActiveTab("about");
}

init();