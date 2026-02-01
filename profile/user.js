import { supabase, getMessagingStatus, sendNotification, getCurrentUser } from "/js/supabase.js";

// DOM Elements
const avatarImg = document.getElementById("avatarImg");
const avatarFallback = document.getElementById("avatarFallback");
const fullNameEl = document.getElementById("fullName");
const rankEl = document.getElementById("rank");
const typeBadge = document.getElementById("typeBadge");
const messageBtn = document.getElementById("messageBtn");
const tabsEl = document.getElementById("tabs");
const postsWrap = document.getElementById("postsWrap");
const postCounts = document.getElementById("postCounts");
const jobsWrap = document.getElementById("jobsWrap");

// Multi-email list in Company About
const cEmailsWrap = document.getElementById("c_emails");

// URL Params
const params = new URLSearchParams(window.location.search);
const profileId = params.get("id");

let profile = null;
let viewer = null;
let currentTab = "about";

function escapeHtml(str) {
    if (!str) return "";
    return str.replace(/[&<>"']/g, function (m) {
        return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m];
    });
}

function safeText(val, fallback = "") {
    if (val === null || val === undefined) return fallback;
    return String(val).trim() || fallback;
}

async function init() {
    const userWithProfile = await getCurrentUser();
    if (!userWithProfile) {
        window.location.href = "/auth/login.html";
        return;
    }
    viewer = userWithProfile;

    if (!profileId) {
        alert("No profile ID specified.");
        window.location.href = "/feed/index.html";
        return;
    }

    // Fetch full profile data
    const { data, error } = await supabase
        .from("profiles")
        .select("*, vision, mission, services, achievements, company_emails")
        .eq("id", profileId)
        .maybeSingle();

    if (error || !data) {
        alert("Profile not found.");
        window.location.href = "/feed/index.html";
        return;
    }
    profile = data;

    renderHeader();
    buildTabs();
    renderAbout();
    showPane("about");

    // Message Button Logic
    if (viewer.id === profileId) {
        messageBtn.style.display = "none";
    } else {
        updateMessageButton();
    }

    messageBtn.onclick = handleMessage;
}

async function updateMessageButton() {
    const { status } = await getMessagingStatus(viewer.id, profileId);
    if (status === 'connected') {
        messageBtn.textContent = "Open Chat";
        messageBtn.disabled = false;
    } else if (status === 'pending') {
        messageBtn.textContent = "Request Sent";
        messageBtn.disabled = true;
    } else {
        messageBtn.textContent = "Message";
        messageBtn.disabled = false;
    }
}

function renderHeader() {
    if (profile.avatar_url) {
        avatarImg.src = profile.avatar_url;
        avatarImg.classList.remove("hidden");
        avatarFallback.classList.add("hidden");
    } else {
        avatarImg.classList.add("hidden");
        avatarFallback.classList.remove("hidden");
        avatarFallback.textContent = (profile.full_name || "P").charAt(0).toUpperCase();
    }

    fullNameEl.textContent = profile.full_name || "Unknown User";

    const kind = profile.account_type || "seafarer";
    typeBadge.textContent = kind.charAt(0).toUpperCase() + kind.slice(1);
    typeBadge.classList.remove("hidden");

    if (kind === "employer" || kind === "company") {
        rankEl.textContent = "Company";
    } else {
        rankEl.textContent = profile.rank || profile.role || "Maritime Professional";
    }
}

function buildTabs() {
    const kind = profile.account_type || "seafarer";
    const tabs = [{ id: "about", label: "About" }];

    if (kind === "employer" || kind === "company") {
        tabs.push({ id: "jobs", label: "Jobs" });
    } else if (kind === "seafarer") {
        tabs.push({ id: "documents", label: "Documents" });
        tabs.push({ id: "sea", label: "Sea Service" });
    } else if (kind === "shore" || kind === "professional") {
        tabs.push({ id: "experience", label: "Experience" });
    }

    tabs.push({ id: "posts", label: "Posts" });

    tabsEl.innerHTML = tabs.map(t => `
        <div class="tab ${t.id === currentTab ? 'active' : ''}" data-tab="${t.id}">${t.id === 'posts' ? 'Posts' : t.label}</div>
    `).join("");

    tabsEl.querySelectorAll(".tab").forEach(tab => {
        tab.onclick = () => showPane(tab.dataset.tab);
    });
}

function showPane(id) {
    currentTab = id;
    document.querySelectorAll(".pane").forEach(p => p.classList.add("hidden"));
    document.getElementById(`tab_${id}`)?.classList.remove("hidden");

    document.querySelectorAll(".tab").forEach(t => {
        t.classList.toggle("active", t.dataset.tab === id);
    });

    if (id === "posts") loadPosts();
    if (id === "jobs") loadJobs();
    if (id === "documents") loadDocuments();
    if (id === "sea") loadSeaService();
    if (id === "experience") loadExperience();
}

function renderAbout() {
    const kind = profile.account_type || "seafarer";
    document.getElementById("about_seafarer").classList.add("hidden");
    document.getElementById("about_company").classList.add("hidden");
    document.getElementById("about_professional").classList.add("hidden");

    if (kind === "employer" || kind === "company") {
        document.getElementById("about_company").classList.remove("hidden");
        document.getElementById("c_phone").textContent = safeText(profile.phone, "—");
        document.getElementById("c_services").textContent = safeText(profile.services, "—");
        document.getElementById("c_achievements").textContent = safeText(profile.achievements, "—");
        document.getElementById("c_vision").textContent = safeText(profile.vision, "—");
        document.getElementById("c_mission").textContent = safeText(profile.mission, "—");

        const emails = profile.company_emails || [];
        cEmailsWrap.innerHTML = emails.map(e => `
            <div class="summaryChip">${escapeHtml(e.email)} <small style="opacity:.7">(${escapeHtml(e.purpose)})</small></div>
        `).join("");
        if (emails.length === 0) cEmailsWrap.innerHTML = '<div class="muted">No contact emails listed.</div>';

    } else if (kind === "seafarer") {
        document.getElementById("about_seafarer").classList.remove("hidden");
        document.getElementById("s_nationality").textContent = safeText(profile.nationality, "—");
        document.getElementById("s_rank").textContent = safeText(profile.rank, "—");
        document.getElementById("s_bio").textContent = safeText(profile.bio, "—");
    } else {
        document.getElementById("about_professional").classList.remove("hidden");
        document.getElementById("p_position").textContent = safeText(profile.role, "—");
        document.getElementById("p_company").textContent = safeText(profile.company_name, "—");
        document.getElementById("p_bio").textContent = safeText(profile.bio, "—");
    }
}

async function loadPosts() {
    postsWrap.innerHTML = "<div class='muted'>Loading posts…</div>";
    const { data, error } = await supabase
        .from("posts")
        .select("*")
        .eq("user_id", profileId)
        .order("created_at", { ascending: false });

    if (error) {
        postsWrap.innerHTML = "<div class='muted'>Error loading posts.</div>";
        return;
    }

    postCounts.textContent = `${data.length} posts`;
    if (data.length === 0) {
        postsWrap.innerHTML = "<div class='muted'>No posts yet.</div>";
        return;
    }

    postsWrap.innerHTML = data.map(p => `
        <div style="margin-bottom:16px; padding:12px; border:1px solid rgba(0,0,0,.06); border-radius:12px; background:#fff;">
            <div style="font-size:12px; color:var(--muted); margin-bottom:8px;">${new Date(p.created_at).toLocaleDateString()}</div>
            <div style="font-size:14px; line-height:1.45;">${escapeHtml(p.content)}</div>
        </div>
    `).join("");
}

async function loadJobs() {
    jobsWrap.innerHTML = "<div class='muted'>Loading jobs…</div>";
    const { data, error } = await supabase
        .from("jobs")
        .select("*")
        .eq("poster_id", profileId)
        .order("created_at", { ascending: false });

    if (error) {
        jobsWrap.innerHTML = "<div class='muted'>Error loading jobs.</div>";
        return;
    }

    if (data.length === 0) {
        jobsWrap.innerHTML = "<div class='muted'>No active job openings.</div>";
        return;
    }

    jobsWrap.innerHTML = data.map(j => {
        const tags = j.tags || [];
        const isUrgent = tags.some(t => t.trim().toUpperCase() === 'URGENT');
        return `
        <div class="jobCard" style="margin-top:0; margin-bottom:14px;">
            <div class="jobHeader">
                <div class="jobTitleGroup">
                    <div class="jobTitleText">${escapeHtml(j.title)}</div>
                    <div class="jobSubText">
                        <span>${escapeHtml(j.rank || "Any Rank")}</span>
                        ${j.vessel_type ? `• <span>${escapeHtml(j.vessel_type)}</span>` : ""}
                    </div>
                </div>
                <div class="jobBadge ${isUrgent ? 'urgent' : ''}">${isUrgent ? 'Urgent' : 'Active'}</div>
            </div>
            <div class="jobGrid">
                <div class="jobItem"><div class="jobLabel">Salary</div><div class="jobValue">${escapeHtml(j.salary || "TBA")}</div></div>
                <div class="jobItem"><div class="jobLabel">Duration</div><div class="jobValue">${escapeHtml(j.contract_duration || "TBA")}</div></div>
                <div class="jobItem"><div class="jobLabel">Location</div><div class="jobValue">${escapeHtml(j.location || "TBA")}</div></div>
                <div class="jobItem"><div class="jobLabel">Joining</div><div class="jobValue">${j.joining_date || "TBA"}</div></div>
            </div>
            <div style="margin-top:12px;">
                <button class="btnPrimary" style="width:100%;" onclick="alert('Applications handled through PEPSVAL Messaging or Company Contact.')">Apply for this Job</button>
            </div>
        </div>
        `;
    }).join("");
}

// Stubs for privacy-sensitive tabs (could be expanded if profile is public)
async function loadDocuments() { document.getElementById("documentsWrap").innerHTML = '<div class="muted">Documents are only visible to the user.</div>'; }
async function loadSeaService() { document.getElementById("seaWrap").innerHTML = '<div class="muted">Sea Service records are private.</div>'; }
async function loadExperience() { document.getElementById("expWrap").innerHTML = '<div class="muted">Professional experience not shared publicly yet.</div>'; }

async function handleMessage() {
    messageBtn.disabled = true;
    messageBtn.textContent = "Connecting…";

    const { status, conversationId } = await getMessagingStatus(viewer.id, profileId);

    if (status === 'connected') {
        window.location.href = `/messages/index.html?convId=${conversationId}`;
    } else if (status === 'pending') {
        // do nothing, button should be disabled
    } else {
        // Send request
        await sendNotification(
            profileId,
            "Message Request",
            `${viewer.profile?.full_name || 'Someone'} wants to message you.`,
            { sender_id: viewer.id, sender_name: viewer.profile?.full_name || 'Someone' },
            "message_request"
        );
        messageBtn.textContent = "Request Sent";
        alert("Message request sent!");
    }
}

init();
