import { supabase, markNotificationAsRead, sendNotification, createConversation } from "/js/supabase.js";

const list = document.getElementById("list");
const tabCommunity = document.getElementById("tabCommunity");
const tabMessages = document.getElementById("tabMessages");
const tabNotifications = document.getElementById("tabNotifications");
const chatInputWrap = document.getElementById("chatInputWrap");
const chatInput = document.getElementById("chatInput");
const sendBtn = document.getElementById("sendBtn");
const notifCount = document.getElementById("notifCount");

const currentUrlParams = new URLSearchParams(window.location.search);
const urlConvId = currentUrlParams.get("convId");

// ... (Top of file)
let currentTab = "community";
let currentUser = null;
let currentProfile = null; // Add this
let currentConversationId = null;

// ...

async function initLoad() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    window.location.href = "/auth/login.html";
    return;
  }
  currentUser = user;

  // Load avatar
  const { data: prof } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
  currentProfile = prof; // Store globally
  const avatarBtn = document.getElementById("meAvatarBtn");
  const avatarImg = avatarBtn?.querySelector("img");
  if (prof?.avatar_url && avatarImg) avatarImg.src = prof.avatar_url;
  avatarBtn?.addEventListener("click", () => window.location.href = "/profile/home.html");

  // ...
}

// ...

function showToast(title, body) {
  const toast = document.createElement("div");
  toast.className = "toast-msg";
  toast.style.cssText = `
    position: fixed; top: 20px; left: 50%; transform: translateX(-50%);
    background: var(--brand-gradient, #007bff); color: #fff;
    padding: 12px 20px; border-radius: 50px;
    box-shadow: 0 8px 20px rgba(0,0,0,0.25);
    z-index: 10000; font-size: 14px; font-weight: 600;
    animation: slideDownFade 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
    display: flex; align-items: center; gap: 10px;
  `;
  toast.innerHTML = `<span>&#128276;</span> <div>${title}</div>`;
  document.body.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(-50%) translateY(-20px)';
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

// ... inside loadCommunity ...
chatInput.placeholder = "Post to community…";

// ... inside loadPrivateChat ...
const backDiv = document.createElement("div");
backDiv.className = "item";
backDiv.style = "background:transparent; border:none; padding:10px 0; margin-bottom:10px; cursor:pointer; color:var(--text-muted); font-size:14px; font-weight:600;";
backDiv.innerHTML = "&#8592; Back"; // arrow

// ... inside loadNotifications ...
<div style="padding:10px; border-radius:12px; background:var(--bg-body); box-shadow:var(--shadow-sm); font-size:20px;">
  ${n.type === 'message' ? '&#128172;' : (n.type === 'message_request' ? '&#128075;' : '&#128276;')}
</div>

// ... inside sendBtn keys ...
if (currentOtherId) {
  sendNotification(
    currentOtherId,
    "New Message",
    `${currentProfile?.full_name || currentUser.user_metadata?.full_name || 'Someone'} sent you a message.`,
    { conversationId: currentConversationId, sender_id: currentUser.id },
    "message"
  );
}

// --- SUBSCRIPTIONS CLEANUP ---
// No full cleanup needed as we want globalSub to persist. 
// Tab switches handle activeChatSub/communitySub cleanup.

// --- UTILS ---
function formatTime(iso) {
  const d = new Date(iso);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) {
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

function escapeHtml(text) {
  if (!text) return "";
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// Side effects
const sidebarLogoutBtn = document.getElementById("sidebarLogout");
if (sidebarLogoutBtn) {
  sidebarLogoutBtn.addEventListener("click", async () => {
    await supabase.auth.signOut();
    window.location.href = "/auth/login.html";
  });
}

// Start
initLoad();

