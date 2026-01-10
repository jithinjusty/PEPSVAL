import { supabase } from "/js/supabase.js";
import { requireAuth, getMyProfile } from "/js/guard.js";

const qEl = document.getElementById("q");
const btn = document.getElementById("btn");
const peopleEl = document.getElementById("people");
const jobsEl = document.getElementById("jobs");

function escapeHtml(s){
  return (s||"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
}

async function run(){
  const q = (qEl.value || "").trim();
  if (!q){
    peopleEl.innerHTML = "<div class='muted'>Type something to search.</div>";
    jobsEl.innerHTML = "<div class='muted'>Type something to search.</div>";
    return;
  }

  peopleEl.innerHTML = "Searching…";
  const { data: people, error: pe } = await supabase
    .from("profiles")
    .select("id, full_name, rank, job_title, company_name, account_type")
    .ilike("full_name", `%${q}%`)
    .limit(20);

  if (pe){
    peopleEl.innerHTML = "Error: " + escapeHtml(pe.message);
  } else if (!people || people.length===0){
    peopleEl.innerHTML = "<div class='muted'>No people found.</div>";
  } else {
    peopleEl.innerHTML = people.map(p => `
      <a class="item" href="/profile/user.html?id=${encodeURIComponent(p.id)}">
        <div class="title">${escapeHtml(p.full_name || "Member")}</div>
        <div class="meta">${escapeHtml((p.rank||p.job_title||""))} ${p.company_name ? "• " + escapeHtml(p.company_name) : ""} ${p.account_type ? "• " + escapeHtml(p.account_type) : ""}</div>
      </a>
    `).join("");
  }

  jobsEl.innerHTML = "Searching…";
  const { data: jobs, error: je } = await supabase
    .from("jobs")
    .select("id, title, company, location, created_at")
    .or(`title.ilike.%${q}%,company.ilike.%${q}%,location.ilike.%${q}%`)
    .limit(20);

  if (je){
    jobsEl.innerHTML = "Error: " + escapeHtml(je.message);
  } else if (!jobs || jobs.length===0){
    jobsEl.innerHTML = "<div class='muted'>No jobs found.</div>";
  } else {
    jobsEl.innerHTML = jobs.map(j => `
      <div class="item">
        <div class="title">${escapeHtml(j.title)}</div>
        <div class="meta">${escapeHtml(j.company || "")} ${j.location ? "• " + escapeHtml(j.location) : ""}</div>
      </div>
    `).join("");
  }
}

btn.addEventListener("click", run);
qEl.addEventListener("keydown", (e) => { if (e.key === "Enter") run(); });

(async function init(){
  const session = await requireAuth();
  if (!session) return;

  const profile = await getMyProfile(session.user.id);
  if (!profile || profile.setup_complete !== true){
    window.location.href = "/setup/profile-setup.html";
    return;
  }

  const params = new URLSearchParams(window.location.search);
  qEl.value = params.get("q") || "";
  await run();
})();