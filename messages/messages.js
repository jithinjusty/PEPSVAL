import { supabase } from "/js/supabase.js";

const list = document.getElementById("list");
const tabMessages = document.getElementById("tabMessages");
const tabNotifications = document.getElementById("tabNotifications");
const msgCount = document.getElementById("msgCount");
const notifCount = document.getElementById("notifCount");

let currentTab = "notifications";

tabMessages.onclick = () => switchTab("messages");
tabNotifications.onclick = () => switchTab("notifications");

function switchTab(tab) {
  currentTab = tab;
  tabMessages.classList.toggle("active", tab==="messages");
  tabNotifications.classList.toggle("active", tab==="notifications");
  load();
}

async function load() {
  const { data:user } = await supabase.auth.getUser();
  if(!user?.user) location.href="/auth/login.html";

  if(currentTab==="notifications") loadNotifications();
  else loadMessages();
}

async function loadNotifications() {
  const { data } = await supabase
    .from("notifications")
    .select("*")
    .order("created_at", { ascending:false });

  list.innerHTML = "";
  data?.forEach(n=>{
    const div = document.createElement("div");
    div.className="item";
    div.innerHTML = `
      <h4>${n.title}</h4>
      <p>${n.body}</p>
      <small>${new Date(n.created_at).toLocaleString()}</small>
    `;
    list.appendChild(div);
  });

  notifCount.textContent = data?.filter(n=>!n.is_read).length || 0;
}

async function loadMessages() {
  list.innerHTML = `<div class="item"><p>No messages yet</p></div>`;
  msgCount.textContent = 0;
}

load();