import { supabase } from "/js/supabase.js";
import { requireAuth, getMyProfile } from "/js/guard.js";

const jobsEl = document.getElementById("jobs");
const employerCard = document.getElementById("employerCard");

const jobBtn = document.getElementById("jobBtn");
const jobTitle = document.getElementById("jobTitle");
const jobCompany = document.getElementById("jobCompany");
const jobLocation = document.getElementById("jobLocation");
const jobDesc = document.getElementById("jobDesc");
const jobStatus = document.getElementById("jobStatus");

const searchInput = document.getElementById("searchInput");
const goSearch = document.getElementById("goSearch");

goSearch.addEventListener("click", () => {
  const q = (searchInput.value || "").trim();
  window.location.href = "/search/index.html?q=" + encodeURIComponent(q);
});
searchInput.addEventListener("keydown", (e) => { if (e.key === "Enter") goSearch.click(); });

let session=null;
let profile=null;

function escapeHtml(s){
  return (s||"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
}
function fmt(ts){ try { return new Date(ts).toLocaleDateString(); } catch { return ""; } }

async function loadJobs(){
  jobsEl.innerHTML = "Loading…";
  const { data, error } = await supabase
    .from("jobs")
    .select("id, title, company, location, description, created_at, poster_id")
    .order("created_at", { ascending: false })
    .limit(100);

  if (error){ jobsEl.innerHTML = "Error loading jobs: " + escapeHtml(error.message); return; }
  if (!data || data.length===0){ jobsEl.innerHTML = "<div class='muted'>No jobs yet.</div>"; return; }

  jobsEl.innerHTML = data.map(j => {
    const mine = j.poster_id === session.user.id;
    return `
      <div class="job">
        <div class="jobTop">
          <div class="jobTitle">${escapeHtml(j.title)}</div>
          <div class="badge">${escapeHtml(fmt(j.created_at))}</div>
        </div>
        <div class="jobMeta">${escapeHtml(j.company || "Company")} • ${escapeHtml(j.location || "Location")}${mine ? " • (you)" : ""}</div>
        <div class="jobDesc">${escapeHtml(j.description || "")}</div>
      </div>
    `;
  }).join("");
}

async function publishJob(){
  const title = (jobTitle.value||"").trim();
  const company = (jobCompany.value||"").trim();
  const location = (jobLocation.value||"").trim();
  const description = (jobDesc.value||"").trim();
  if (!title || !company) return;

  jobBtn.disabled = true;
  jobStatus.textContent = "Publishing…";

  const { error } = await supabase.from("jobs").insert({
    poster_id: session.user.id,
    title, company, location, description
  });

  jobBtn.disabled = false;
  if (error){ jobStatus.textContent = "Publish failed: " + error.message; return; }

  jobTitle.value=""; jobCompany.value=""; jobLocation.value=""; jobDesc.value="";
  jobStatus.textContent="Published ✅";
  setTimeout(()=>jobStatus.textContent="",1500);

  await loadJobs();
}

jobBtn?.addEventListener("click", publishJob);

(async function init(){
  session = await requireAuth();
  if (!session) return;

  profile = await getMyProfile(session.user.id);
  if (!profile || profile.setup_complete !== true){
    window.location.href = "/setup/profile-setup.html";
    return;
  }

  const acct = (profile.account_type || "").toLowerCase();
  if (acct === "employer" || acct === "shore") {
    employerCard.style.display = "block";
    if (profile.company_name && !jobCompany.value) jobCompany.value = profile.company_name;
  }

  await loadJobs();
})();