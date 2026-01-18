import { supabase } from "/js/supabase.js";

const list = document.getElementById("list");
const tabCommunity = document.getElementById("tabCommunity");
const tabMessages = document.getElementById("tabMessages");
const tabNotifications = document.getElementById("tabNotifications");
const chatInputWrap = document.getElementById("chatInputWrap");
const chatInput = document.getElementById("chatInput");
const sendBtn = document.getElementById("sendBtn");
const notifCount = document.getElementById("notifCount");

let currentTab = "community"; // Default tab
let currentUser = null;
let currentConversationId = null;
let subscriptions = [];

const params = new URLSearchParams(window.location.search);
const urlConvId = params.get("convId");

// Tab switching
tabCommunity.onclick = () => switchTab("community");
tabMessages.onclick = () => switchTab("messages");
tabNotifications.onclick = () => switchTab("notifications");

async function switchTab(tab) {
  currentTab = tab;
  currentConversationId = null;
  tabCommunity.classList.toggle("active", tab === "community");
  tabMessages.classList.toggle("active", tab === "messages");
  tabNotifications.classList.toggle("active", tab === "notifications");

  // Reset UI
  list.innerHTML = "";
  chatInputWrap.style.display = (tab === "community" || (tab === "messages" && currentConversationId)) ? "flex" : "none";

  cleanupSubscriptions();
  load();
}

function cleanupSubscriptions() {
  subscriptions.forEach(s => supabase.removeChannel(s));
  subscriptions = [];
}

async function initLoad() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    window.location.href = "/auth/login.html";
    return;
  }
  currentUser = user;

  if (urlConvId) {
    currentTab = "messages";
    currentConversationId = urlConvId;
    tabCommunity.classList.remove("active");
    tabMessages.classList.add("active");
    tabNotifications.classList.remove("active");
    chatInputWrap.style.display = "flex";
    loadPrivateChat(urlConvId);
  } else {
    load();
  }
}

async function load() {
  if (currentTab === "community") loadCommunity();
  else if (currentTab === "messages") {
    if (currentConversationId) loadPrivateChat(currentConversationId);
    else loadConversations();
  }
  else if (currentTab === "notifications") loadNotifications();
}

// --- COMMUNITY CHAT ---
async function loadCommunity() {
  chatInputWrap.style.display = "flex";
  chatInput.placeholder = "Post to community…";

  const { data, error } = await supabase
    .from("community_chat")
    .select(`
      *,
      profiles:profile_id (full_name, avatar_url)
    `)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) console.error(error);
  renderCommunityMessages(data || []);

  // Real-time
  const sub = supabase.channel('community_chat_realtime')
    .on('postgres_changes', { event: 'INSERT', table: 'community_chat' }, async (payload) => {
      const { data: newMsg } = await supabase
        .from("community_chat")
        .select(`*, profiles:profile_id (full_name, avatar_url)`)
        .eq("id", payload.new.id)
        .single();

      if (newMsg && currentTab === "community") {
        // Simple duplicate prevent: check if content exists lately
        const already = [...list.querySelectorAll('.msg-bubble')].some(b => b.textContent === newMsg.content);
        if (already) return;

        const div = createCommunityMsgEl(newMsg);
        list.prepend(div);
      }
    })
    .subscribe();
  subscriptions.push(sub);
}

function renderCommunityMessages(messages) {
  list.innerHTML = "";
  messages.forEach(m => {
    list.appendChild(createCommunityMsgEl(m));
  });
}

function createCommunityMsgEl(m) {
  const isMe = m.profile_id === currentUser.id;
  const div = document.createElement("div");
  div.className = `msg-row ${isMe ? 'me' : ''}`;

  const name = m.profiles?.full_name || "Unknown Crew";
  const time = new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  div.innerHTML = `
    <div class="sender-name">${isMe ? 'You' : name}</div>
    <div class="msg-bubble">${m.content}</div>
    <div class="msg-info"><span>${time}</span></div>
  `;
  return div;
}

// --- PRIVATE MESSAGES ---
async function loadConversations() {
  chatInputWrap.style.display = "none";
  const { data, error } = await supabase
    .from("conversation_participants")
    .select(`
      conversation_id,
      profiles:profile_id (id, full_name, avatar_url)
    `)
    .eq("profile_id", currentUser.id);

  list.innerHTML = "";
  if (data?.length === 0) {
    list.innerHTML = `<div class="item"><p>No conversations yet. Message someone from their profile!</p></div>`;
    return;
  }

  for (const conv of data) {
    const { data: allParts } = await supabase
      .from("conversation_participants")
      .select(`profiles:profile_id (id, full_name, avatar_url)`)
      .eq("conversation_id", conv.conversation_id);

    const other = allParts.find(p => p.profiles.id !== currentUser.id)?.profiles;
    if (other) {
      const div = document.createElement("div");
      div.className = "item";
      div.style.cursor = "pointer";
      div.onclick = () => {
        currentConversationId = conv.conversation_id;
        loadPrivateChat(conv.conversation_id, other.full_name);
      };
      div.innerHTML = `
        <h4>${other.full_name}</h4>
        <p>Click to open chat</p>
      `;
      list.appendChild(div);
    }
  }
}

async function loadPrivateChat(convId, otherName = "Chat") {
  currentConversationId = convId;
  chatInputWrap.style.display = "flex";
  chatInput.placeholder = "Message " + otherName + "…";

  const { data, error } = await supabase
    .from("private_messages")
    .select("*")
    .eq("conversation_id", convId)
    .order("created_at", { ascending: true });

  list.innerHTML = `<div class="item" style="cursor:pointer; background:#eee;" onclick="switchTab('messages')">← Back to conversations</div>`;

  data?.forEach(m => {
    const isMe = m.sender_id === currentUser.id;
    const div = document.createElement("div");
    div.className = `msg-row ${isMe ? 'me' : ''}`;
    const time = new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    div.innerHTML = `
      <div class="msg-bubble">${m.content}</div>
      <div class="msg-info"><span>${time}</span></div>
    `;
    list.appendChild(div);
  });

  const sub = supabase.channel(`dm_${convId}`)
    .on('postgres_changes', { event: 'INSERT', table: 'private_messages', filter: `conversation_id=eq.${convId}` }, (payload) => {
      const isMe = payload.new.sender_id === currentUser.id;
      const div = document.createElement("div");
      div.className = `msg-row ${isMe ? 'me' : ''}`;
      const time = new Date(payload.new.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      div.innerHTML = `
        <div class="msg-bubble">${payload.new.content}</div>
        <div class="msg-info"><span>${time}</span></div>
      `;
      list.appendChild(div);
      list.scrollTop = list.scrollHeight;
    })
    .subscribe();
  subscriptions.push(sub);
  window.scrollTo(0, document.body.scrollHeight);
}

// --- NOTIFICATIONS ---
async function loadNotifications() {
  const { data } = await supabase
    .from("notifications")
    .select("*")
    .order("created_at", { ascending: false });

  list.innerHTML = "";
  data?.forEach(n => {
    const div = document.createElement("div");
    div.className = "item";
    div.innerHTML = `
      <h4>${n.title}</h4>
      <p>${n.body}</p>
      <small>${new Date(n.created_at).toLocaleString()}</small>
    `;
    list.appendChild(div);
  });
  notifCount.textContent = data?.filter(n => !n.is_read).length || 0;
}

// --- SEND LOGIC ---
sendBtn.onclick = async () => {
  const text = chatInput.value.trim();
  if (!text || !currentUser) return;

  if (currentTab === "community") {
    const tempMsg = {
      profile_id: currentUser.id,
      content: text,
      created_at: new Date().toISOString(),
      profiles: {
        full_name: "You",
        avatar_url: null
      }
    };

    // Optimistic UI update
    const div = createCommunityMsgEl(tempMsg);
    div.id = "temp_sending_" + Date.now(); // identifier to check later if needed
    list.prepend(div);
    chatInput.value = "";

    const { error } = await supabase
      .from("community_chat")
      .insert({ profile_id: currentUser.id, content: text });

    if (error) {
      alert("Error posting: " + error.message);
      div.remove(); // Rollback if failed
    }
  }
  else {
    // Optimistic update for private
    const tempDiv = document.createElement("div");
    tempDiv.className = `msg-row me`;
    tempDiv.innerHTML = `
        <div class="msg-bubble">${text}</div>
        <div class="msg-info"><span>Just now</span></div>
      `;
    list.appendChild(tempDiv);
    list.scrollTop = list.scrollHeight;
    chatInput.value = "";

    const { error } = await supabase
      .from("private_messages")
      .insert({
        conversation_id: currentConversationId,
        sender_id: currentUser.id,
        content: text
      });
    if (error) {
      alert("Error sending: " + error.message);
      tempDiv.remove();
    }
  }
};

chatInput.onkeydown = (e) => {
  if (e.key === "Enter") sendBtn.click();
};

initLoad();
