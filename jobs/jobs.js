import { supabase } from "/js/supabase.js";
import { requireAuth, getMyProfile } from "/js/guard.js";

const jobsTitle = document.getElementById("jobsTitle");
const jobsNavLabel = document.getElementById("jobsNavLabel");
const jobsCard = document.getElementById("jobsCard");

function setCard(title, subtitle, extraHTML = "") {
  if (!jobsCard) return;
  jobsCard.innerHTML = `
    <div style="font-weight:900;font-size:18px;">${title}</div>
    <div class="muted" style="margin-top:6px;">${subtitle}</div>
    ${extraHTML ? `<div style="margin-top:12px;">${extraHTML}</div>` : ""}
  `;
}

function roleToJobsLabel(role) {
  if (role === "company") return "Post Jobs";
  if (role === "professional") return "Opportunities";
  return "Find Jobs"; // seafarer default
}

(async () => {
  const session = await requireAuth();
  if (!session) return;

  const me = await getMyProfile(session.user.id);
  if (!me || me.setup_complete !== true) {
    window.location.href = "/setup/profile-setup.html";
    return;
  }

  const role = (me.role || "").trim();

  const label = roleToJobsLabel(role);
  if (jobsTitle) jobsTitle.textContent = label;
  if (jobsNavLabel) jobsNavLabel.textContent = label;

  // Role-specific content (UI now, DB later)
  if (role === "company") {
    setCard(
      "Post a job (coming next)",
      "This space is for companies/institutes to create and manage job posts.",
      `
        <div class="muted">Next we’ll add: job post form → approvals → applicants → chat.</div>
        <div style="margin-top:10px;">
          <button class="pv-btn" type="button" disabled>+ Create job (soon)</button>
        </div>
      `
    );
  } else if (role === "professional") {
    setCard(
      "Opportunities (coming next)",
      "You’ll see shore-side roles and maritime opportunities here.",
      `<div class="muted">Next we’ll add: filters by location/role + save jobs.</div>`
    );
  } else {
    // Seafarer
    setCard(
      "Find jobs (coming next)",
      "You’ll see verified job posts here with vessel/contract details.",
      `<div class="muted">Next we’ll add: rank filters, company verification, and apply button.</div>`
    );
  }

  // --- SEARCH LOGIC ---
  const jobSearchInput = document.getElementById("jobSearchInput");
  const jobSearchDrop = document.getElementById("jobSearchDrop");

  if (jobSearchInput) {
    jobSearchInput.addEventListener("input", async () => {
      const q = jobSearchInput.value.trim();
      if (q.length < 2) {
        if (jobSearchDrop) jobSearchDrop.style.display = "none";
        return;
      }

      const { data, error } = await supabase
        .from("jobs")
        .select("*")
        .or(`title.ilike.%${q}%,rank.ilike.%${q}%,location.ilike.%${q}%,company.ilike.%${q}%`)
        .limit(10);

      if (error) {
        console.error("Job search error:", error);
        return;
      }

      if (jobSearchDrop) {
        if (!data || data.length === 0) {
          jobSearchDrop.innerHTML = `<div style="padding:10px; font-size:13px; color:#888;">No jobs found for "${q}"</div>`;
        } else {
          jobSearchDrop.innerHTML = data.map(j => `
            <div class="searchItem" style="display:flex; flex-direction:column; padding:10px; border-bottom:1px solid #eee; cursor:pointer;" onclick="alert('Job details for ${j.title} coming soon!')">
              <div style="font-weight:800; font-size:14px; color:#1F6F86;">${j.title}</div>
              <div style="font-size:12px; opacity:.7; color:#444;">${j.company || "Unknown Company"} • ${j.location || "Remote"}</div>
              <div style="font-size:11px; margin-top:2px; color:#888;">Rank: ${j.rank || "Any"}</div>
            </div>
          `).join("");
        }
        jobSearchDrop.style.display = "block";
      }
    });

    document.addEventListener("click", (e) => {
      if (jobSearchDrop && !jobSearchInput.contains(e.target) && !jobSearchDrop.contains(e.target)) {
        jobSearchDrop.style.display = "none";
      }
    });
  }
})();
