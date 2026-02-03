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

let currentTab = "community";
let currentUser = null;
let currentProfile = null;
let currentConversationId = null;
let currentOtherId = null;

// Subscriptions
let globalSub = null;
let activeChatSub = null;
let communitySub = null;

// Tab switching
if (tabCommunity) tabCommunity.onclick = () => switchTab("community");
if (tabMessages) tabMessages.onclick = () => switchTab("messages");
if (tabNotifications) tabNotifications.onclick = () => switchTab("notifications");

async function switchTab(tab) {
  if (currentTab === tab && tab !== "messages") return; // Allow re-click on messages to go back to list

  // If clicking "messages" while in a chat, go back to list
  if (tab === "messages" && currentConversationId && currentTab === "messages") {
    currentConversationId = null;
    currentOtherId = null;
  } else if (tab !== "messages") {
    currentConversationId = null;
  }

  currentTab = tab;
  updateTabUI();

  // Cleanup specific subscriptions
  if (activeChatSub) { supabase.removeChannel(activeChatSub); activeChatSub = null; }
  if (communitySub) { supabase.removeChannel(communitySub); communitySub = null; }

  if (list) list.innerHTML = '<div class="item muted">Loading...</div>';

  if (tab === "community") loadCommunity();
  else if (tab === "messages") {
    if (currentConversationId) loadPrivateChat(currentConversationId);
    else loadConversations();
  }
  else if (tab === "notifications") loadNotifications();
}

function updateTabUI() {
  if (tabCommunity) tabCommunity.classList.toggle("active", currentTab === "community");
  if (tabMessages) tabMessages.classList.toggle("active", currentTab === "messages");
  if (tabNotifications) tabNotifications.classList.toggle("active", currentTab === "notifications");

  // Input visibility
  const showInput = (currentTab === "community") || (currentTab === "messages" && currentConversationId);
  if (chatInputWrap) chatInputWrap.style.display = showInput ? "flex" : "none";
}

async function initLoad() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    window.location.href = "/auth/login.html";
    return;
  }
  currentUser = user;

  // Load avatar
  const { data: prof } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
  currentProfile = prof;

  const avatarBtn = document.getElementById("meAvatarBtn");
  const avatarImg = avatarBtn?.querySelector("img");
  if (prof?.avatar_url && avatarImg) avatarImg.src = prof.avatar_url;
  avatarBtn?.addEventListener("click", () => window.location.href = "/profile/home.html");

  // Global Notification Listener (Optimization: Only one listener for the app lifecycle)
  setupGlobalNotifications();

  // Initial Route
  if (urlConvId) {
    currentTab = "messages";
    currentConversationId = urlConvId;
    updateTabUI();
    loadPrivateChat(urlConvId);
  } else {
    loadCommunity(); // Default
  }

  // Update badge immediately
  fetchNotificationCount();
}

// --- GLOBAL NOTIFICATIONS ---
function setupGlobalNotifications() {
  if (globalSub) return;

  globalSub = supabase.channel('global_notifs')
    .on('postgres_changes', {
      event: 'INSERT',
      table: 'notifications',
      filter: `user_id=eq.${currentUser.id}`
    }, (payload) => {
      console.log("New notification:", payload.new);
      fetchNotificationCount();

      // If on notifications tab, reload list
      if (currentTab === "notifications") {
        loadNotifications();
      }

      // Show Toast
      showToast(payload.new.title, payload.new.body);
    })
    .subscribe();
}

async function fetchNotificationCount() {
  const { count } = await supabase
    .from("notifications")
    .select("id", { count: 'exact', head: true })
    .eq("user_id", currentUser.id)
    .eq("is_read", false); // Assuming is_read is the flag

  if (notifCount) {
    notifCount.textContent = count || 0;
    notifCount.style.display = count > 0 ? 'inline-flex' : 'none';
  }
}

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

// --- COMMUNITY ---
async function loadCommunity() {
  if (chatInput) chatInput.placeholder = "Post to community…";

  const { data, error } = await supabase
    .from("community_chat")
    .select(`*, profiles:profile_id (full_name, avatar_url)`)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    if (list) list.innerHTML = `<div class="item error">Failed to load chat.</div>`;
    return;
  }

  renderCommunityMessages(data || []);

  // Community Realtime
  communitySub = supabase.channel('community_chat_realtime')
    .on('postgres_changes', { event: 'INSERT', table: 'community_chat' }, async (payload) => {
      // Fetch user details for the new message
      const { data: newMsg } = await supabase
        .from("community_chat")
        .select(`*, profiles:profile_id (full_name, avatar_url)`)
        .eq("id", payload.new.id)
        .single();

      if (newMsg && currentTab === "community") {
        const exists = document.getElementById(`msg_${newMsg.id}`);
        if (!exists && list) list.prepend(createCommunityMsgEl(newMsg));
      }
    })
    .subscribe();
}

function renderCommunityMessages(messages) {
  if (!list) return;
  list.innerHTML = "";
  messages.forEach(m => list.appendChild(createCommunityMsgEl(m)));
}

function createCommunityMsgEl(m) {
  const isMe = m.profile_id === currentUser.id;
  const div = document.createElement("div");
  div.className = `msg-row ${isMe ? 'me' : ''}`;
  if (m.id) div.id = `msg_${m.id}`;

  const name = m.profiles?.full_name || "Unknown";
  const time = formatTime(m.created_at);

  div.innerHTML = `
    <div class="sender-name">${isMe ? 'You' : name}</div>
    <div class="msg-bubble">${escapeHtml(m.content)}</div>
    <div class="msg-info"><span>${time}</span></div>
  `;
  return div;
}

// --- PRIVATE LIST ---
async function loadConversations() {
  const { data: convs, error } = await supabase
    .from("conversation_participants")
    .select(`conversation_id`)
    .eq("profile_id", currentUser.id);

  if (!list) return;

  if (!convs || convs.length === 0) {
    list.innerHTML = `<div class="item muted" style="text-align:center; padding: 40px;">No messages yet.<br>Visit profiles to start chatting.</div>`;
    return;
  }

  list.innerHTML = "";

  const items = [];

  for (const c of convs) {
    // 1. Get other participant
    const { data: parts } = await supabase
      .from("conversation_participants")
      .select(`profiles:profile_id (id, full_name, avatar_url)`)
      .eq("conversation_id", c.conversation_id);

    const other = parts?.find(p => p.profiles.id !== currentUser.id)?.profiles;
    if (!other) continue;

    // 2. Get last message
    const { data: msgs } = await supabase
      .from("private_messages")
      .select("content, created_at, is_read, sender_id")
      .eq("conversation_id", c.conversation_id)
      .order("created_at", { ascending: false })
      .limit(1);

    const lastMsg = msgs?.[0];
    items.push({
      convId: c.conversation_id,
      other,
      lastMsg
    });
  }

  // Sort by latest activity
  items.sort((a, b) => {
    const tA = new Date(a.lastMsg?.created_at || 0).getTime();
    const tB = new Date(b.lastMsg?.created_at || 0).getTime();
    return tB - tA;
  });

  items.forEach(item => {
    const div = document.createElement("div");
    div.className = "item";
    div.style.cursor = "pointer";
    div.onclick = () => {
      currentConversationId = item.convId;
      currentOtherId = item.other.id;
      switchTab("messages");
    };

    const initial = (item.other.full_name || "?")[0];
    const preview = item.lastMsg ? (item.lastMsg.sender_id === currentUser.id ? "You: " : "") + item.lastMsg.content : "Start a conversation";
    const time = item.lastMsg ? formatTime(item.lastMsg.created_at) : "";
    const isUnread = item.lastMsg && !item.lastMsg.is_read && item.lastMsg.sender_id !== currentUser.id;

    div.innerHTML = `
      <div style="display:flex; align-items:center; gap:12px;">
        <div style="width:48px; height:48px; border-radius:14px; background:var(--brand-light); color:var(--brand); display:flex; align-items:center; justify-content:center; font-weight:800; font-size:18px; flex-shrink:0;">
          ${item.other.avatar_url ? `<img src="${item.other.avatar_url}" style="width:100%; height:100%; border-radius:14px; object-fit:cover;">` : initial}
        </div>
        <div style="flex:1; min-width:0;">
          <div style="display:flex; justify-content:space-between; align-items:baseline;">
            <h4 style="margin:0; font-size:15px; font-weight:700; color:var(--text-main);">${item.other.full_name}</h4>
            <span style="font-size:11px; color:var(--text-muted);">${time}</span>
          </div>
          <p style="margin:2px 0 0; font-size:13px; color: ${isUnread ? 'var(--text-main)' : 'var(--text-muted)'}; font-weight: ${isUnread ? '700' : '400'}; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
            ${escapeHtml(preview)}
          </p>
        </div>
        ${isUnread ? `<div style="width:10px; height:10px; background:var(--brand); border-radius:50%;"></div>` : ''}
      </div>
    `;
    list.appendChild(div);
  });
}

// --- PRIVATE CHAT ---
async function loadPrivateChat(convId) {
  if (chatInput) chatInput.placeholder = "Message...";
  if (!list) return;
  list.innerHTML = ""; // Clear list

  // Fetch Header info (Other user)
  if (!currentOtherId) {
    const { data: parts } = await supabase
      .from("conversation_participants")
      .select(`profiles:profile_id (id, full_name)`)
      .eq("conversation_id", convId);
    const other = parts?.find(p => p.profiles.id !== currentUser.id)?.profiles;
    if (other) {
      currentOtherId = other.id;
      if (chatInput) chatInput.placeholder = `Message ${other.full_name}...`;
    }
  }

  // Back Button
  const backDiv = document.createElement("div");
  backDiv.className = "item";
  backDiv.style = "background:transparent; border:none; padding:10px 0; margin-bottom:10px; cursor:pointer; color:var(--text-muted); font-size:14px; font-weight:600;";
  backDiv.innerHTML = "&#8592; Back";
  backDiv.onclick = () => {
    currentConversationId = null;
    switchTab("messages");
  };
  list.appendChild(backDiv);

  // Messages
  const { data, error } = await supabase
    .from("private_messages")
    .select("*")
    .eq("conversation_id", convId)
    .order("created_at", { ascending: true });

  if (data) {
    data.forEach(renderPrivateMessage);
    window.scrollTo(0, document.body.scrollHeight);
  }

  // Mark Read
  await supabase
    .from("private_messages")
    .update({ is_read: true })
    .eq("conversation_id", convId)
    .neq("sender_id", currentUser.id);

  // Subscribe
  activeChatSub = supabase.channel(`dm_${convId}`)
    .on('postgres_changes', { event: 'INSERT', table: 'private_messages', filter: `conversation_id=eq.${convId}` }, (payload) => {
      renderPrivateMessage(payload.new);
      window.scrollTo(0, document.body.scrollHeight);
      // Mark as read immediately if looking
      if (payload.new.sender_id !== currentUser.id) {
        supabase.from("private_messages").update({ is_read: true }).eq("id", payload.new.id);
      }
    })
    .subscribe();
}

function renderPrivateMessage(m) {
  if (!list) return;
  const isMe = m.sender_id === currentUser.id;
  const div = document.createElement("div");
  div.className = `msg-row ${isMe ? 'me' : ''}`;
  div.innerHTML = `
    <div class="msg-bubble">${escapeHtml(m.content)}</div>
    <div class="msg-info"><span>${formatTime(m.created_at)}</span></div>
  `;
  list.appendChild(div);
}

// --- NOTIFICATIONS ---
async function loadNotifications() {
  const { data } = await supabase
    .from("notifications")
    .select("*")
    .eq("user_id", currentUser.id)
    .order("created_at", { ascending: false });

  if (!list) return;
  list.innerHTML = "";
  if (!data?.length) {
    list.innerHTML = `<div class="item muted">No notifications.</div>`;
    fetchNotificationCount();
    return;
  }

  data.forEach(n => {
    const div = document.createElement("div");
    div.className = "item";
    const isUnread = !n.is_read;
    div.style.background = isUnread ? "rgba(var(--brand-rgb), 0.05)" : "transparent";

    div.innerHTML = `
      <div style="display:flex; gap:12px; align-items:flex-start;">
        <div style="padding:10px; border-radius:12px; background:var(--bg-body); box-shadow:var(--shadow-sm); font-size:20px;">
          ${n.type === 'message' ? '&#128172;' : (n.type === 'message_request' ? '&#128075;' : '&#128276;')}
        </div>
        <div style="flex:1;">
          <h4 style="margin:0; font-size:15px; font-weight:700; color:var(--text-main);">${escapeHtml(n.title)}</h4>
          <p style="margin:4px 0; font-size:14px; line-height:1.4; color:var(--text-soft);">${escapeHtml(n.body)}</p>
          <small style="color:var(--text-muted); font-size:11px;">${new Date(n.created_at).toLocaleString()}</small>
          
          ${n.type === 'message_request' ? `
            <div style="margin-top:12px; display:flex; gap:10px;">
              <button class="accept-btn pv-btn pv-primary-btn" style="padding:6px 16px; font-size:13px;">Accept</button>
              <button class="ignore-btn pv-btn pv-ghost-btn" style="padding:6px 16px; font-size:13px;">Dismiss</button>
            </div>
          ` : ''}
        </div>
        ${isUnread ? `<div style="width:8px; height:8px; background:var(--brand); border-radius:50%; margin-top:6px;"></div>` : ''}
      </div>
    `;

    const acceptBtn = div.querySelector('.accept-btn');
    const ignoreBtn = div.querySelector('.ignore-btn');

    if (acceptBtn) acceptBtn.onclick = () => acceptRequest(n.metadata?.sender_id, n.id);
    if (ignoreBtn) ignoreBtn.onclick = async () => {
      await markNotificationAsRead(n.id);
      div.style.opacity = '0.5';
      fetchNotificationCount();
    };

    list.appendChild(div);
  });

  // Mark all as read after a short delay so user sees them as "new" first
  setTimeout(async () => {
    const unreadIds = data.filter(n => !n.is_read).map(n => n.id);
    if (unreadIds.length > 0) {
      await supabase.from("notifications").update({ is_read: true }).in("id", unreadIds);
      fetchNotificationCount();
    }
  }, 2000);
}

async function acceptRequest(senderId, notifId) {
  if (!senderId) return;
  try {
    const cid = await createConversation(currentUser.id, senderId);
    await markNotificationAsRead(notifId);
    // Remove query params if any
    const url = new URL(window.location);
    url.searchParams.set("convId", cid);
    window.history.pushState({}, "", url);

    // Switch
    currentConversationId = cid;
    switchTab("messages");
  } catch (err) {
    alert("Error accepting request: " + err.message);
  }
}

// --- SEND LOGIC ---
if (sendBtn) sendBtn.onclick = async () => {
  const text = chatInput.value.trim();
  if (!text || !currentUser) return;

  chatInput.value = ""; // Clear immediately

  if (currentTab === "community") {
    const { error } = await supabase.from("community_chat").insert({ profile_id: currentUser.id, content: text });
    if (error) alert("Failed to send");
  } else {
    // Private
    if (!currentConversationId) return;

    // 1. Insert message
    const { error } = await supabase.from("private_messages").insert({
      conversation_id: currentConversationId,
      sender_id: currentUser.id,
      content: text
    });

    if (error) {
      alert("Failed to send");
    } else {
      // 2. Notify other user (fire and forget)
      if (currentOtherId) {
        sendNotification(
          currentOtherId,
          "New Message",
          `${currentProfile?.full_name || currentUser.user_metadata?.full_name || 'Someone'} sent you a message.`,
          { conversationId: currentConversationId, sender_id: currentUser.id },
          "message"
        );
      }
    }
  }
};

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
