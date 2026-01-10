// /dashboard/dashboard.js
import { supabase } from "/js/supabase.js";
import { requireAuth, getMyProfile } from "/js/guard.js";

const dashStatus = document.getElementById("dashStatus");
const helloLine = document.getElementById("helloLine");
const profileStatus = document.getElementById("profileStatus");

const postsCount = document.getElementById("postsCount");
const jobsCount = document.getElementById("jobsCount");
const msgCount = document.getElementById("msgCount");
const notiCount = document.getElementById("notiCount");

const logoutBtn = document.getElementById("logoutBtn");

logoutBtn?.addEventListener("click", async () => {
  await supabase.auth.signOut();
  window.location.href = "/auth/login.html";
});

function safeText(el, v){ if (el) el.textContent = (v ?? "—"); }

async function count(table){
  const { count, error } = await supabase
    .from(table)
    .select("*", { count: "exact", head: true });
  if (error) return null;
  return count ?? null;
}

async function countUnreadNotifications(userId){
  const { count, error } = await supabase
    .from("notifications")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("read", false);
  if (error) return null;
  return count ?? null;
}

(async function init(){
  const session = await requireAuth();
  if (!session) return;

  const profile = await getMyProfile(session.user.id);

  if (!profile || profile.setup_complete !== true){
    window.location.href = "/setup/profile-setup.html";
    return;
  }

  dashStatus.textContent = "Online ✅";

  const name = profile.full_name || profile.name || session.user.email || "Member";
  helloLine.textContent = `Hi ${name} — welcome back.`;
  profileStatus.textContent = profile.account_type ? `Account: ${profile.account_type}` : "Open & edit your profile";

  safeText(postsCount, await count("posts"));
  safeText(jobsCount, await count("jobs"));

  const { count: mc } = await supabase
    .from("messages")
    .select("*", { count: "exact", head: true })
    .or(`to_user.eq.${session.user.id},from_user.eq.${session.user.id}`);
  safeText(msgCount, mc ?? "—");

  safeText(notiCount, await countUnreadNotifications(session.user.id));
})();